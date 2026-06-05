// Sync Google Sheet rows into pipeline as "New Lead" with configurable tag.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function digits(s: string | null | undefined) {
  return (s ?? "").replace(/\D+/g, "");
}

function normaliseAuPhone(raw: string) {
  const d = digits(raw);
  if (!d) return "";
  if (d.startsWith("61")) return "+" + d;
  if (d.startsWith("0")) return "+61" + d.slice(1);
  if (d.length === 9) return "+61" + d;
  return raw.startsWith("+") ? raw : "+" + d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const sheetsKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    if (!lovableKey || !sheetsKey) {
      throw new Error("Google Sheets connection not configured");
    }

    const { data: cfg, error: cfgErr } = await admin
      .from("sheet_lead_sync_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) throw new Error("No sync config row");
    if (!cfg.is_active) {
      return new Response(JSON.stringify({ ok: true, skipped: "inactive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve target stage
    const { data: stage } = await admin
      .from("pipeline_stages")
      .select("id")
      .ilike("name", cfg.target_stage_name)
      .maybeSingle();
    if (!stage?.id) throw new Error(`Stage '${cfg.target_stage_name}' not found`);

    // Fetch rows
    const range = `${cfg.sheet_name}!A1:Z2000`;
    const url = `${GATEWAY}/spreadsheets/${cfg.spreadsheet_id}/values/${range}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": sheetsKey,
      },
    });
    const json = await r.json();
    if (!r.ok) throw new Error(`Sheets fetch failed [${r.status}]: ${JSON.stringify(json)}`);

    const rows: string[][] = json.values ?? [];
    if (rows.length < 2) {
      await admin.from("sheet_lead_sync_config").update({
        last_synced_at: new Date().toISOString(),
        last_imported_count: 0,
        last_error: null,
      }).eq("id", 1);
      return new Response(JSON.stringify({ ok: true, imported: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headerIdx = Math.max(0, (cfg.header_row ?? 1) - 1);
    const header = rows[headerIdx].map((h) => (h ?? "").toString().trim().toLowerCase());
    const col = (name: string) => header.findIndex((h) => h === name.toLowerCase());
    const idxName = col("name");
    const idxPhone = col("number");
    const idxAge = col("age");
    const idxState = col("state");
    const idxFund = col("fund name");
    const idxBalance = col("fund balance");
    const idxEmployment = col("employment");
    const idxComments = col("comments");

    // Already-imported phone digits
    const { data: existingImports } = await admin
      .from("sheet_lead_imports")
      .select("phone_digits")
      .eq("spreadsheet_id", cfg.spreadsheet_id)
      .eq("sheet_name", cfg.sheet_name);
    const imported = new Set<string>((existingImports ?? []).map((r: { phone_digits: string }) => r.phone_digits));

    // Existing pipeline phones (last 9 digits match) — paginate to bypass 1000-row default
    const existingTails = new Set<string>();
    {
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: pageErr } = await admin
          .from("pipeline_deals")
          .select("client_phone")
          .not("client_phone", "is", null)
          .range(from, from + pageSize - 1);
        if (pageErr) throw pageErr;
        if (!page || page.length === 0) break;
        for (const d of page as { client_phone: string | null }[]) {
          const t = digits(d.client_phone).slice(-9);
          if (t.length >= 9) existingTails.add(t);
        }
        if (page.length < pageSize) break;
        from += pageSize;
      }
    }

    // Find max position so new rows are appended at the bottom, preserving
    // the sheet order (top of sheet → top of column) and keeping older
    // leads above newer ones so you call the oldest inquiries first.
    const { data: maxRow } = await admin
      .from("pipeline_deals")
      .select("position")
      .eq("stage_id", stage.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextPos = ((maxRow as { position?: number } | null)?.position ?? -1) + 1;
    let imports = 0;

    const toInsert: Array<Record<string, unknown>> = [];
    const trackInsert: Array<Record<string, unknown>> = [];

    // Iterate top-to-bottom so the sheet order is preserved in the pipeline.
    // The first row in the sheet lands at the top; later rows trail beneath.
    for (let i = headerIdx + 1; i < rows.length; i++) {
      if (i === headerIdx) continue;
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const name = (row[idxName] ?? "").toString().trim();
      const phoneRaw = (row[idxPhone] ?? "").toString().trim();
      const d = digits(phoneRaw);
      if (!name || d.length < 6) continue;
      // NOTE: intentionally do NOT skip on historical sheet_lead_imports
      // tracking — only skip if the lead currently exists in pipeline_deals
      // (existingTails check below). This allows leads that were deleted from
      // the pipeline to be re-imported when the sheet is synced again.
      const tail = d.slice(-9);
      if (tail && existingTails.has(tail)) {
        trackInsert.push({
          spreadsheet_id: cfg.spreadsheet_id,
          sheet_name: cfg.sheet_name,
          phone_digits: d,
          client_name: name,
          deal_id: null,
        });
        continue;
      }

      const phone = normaliseAuPhone(phoneRaw);
      const balanceStr = idxBalance >= 0 ? (row[idxBalance] ?? "").toString() : "";
      const balanceNum = parseFloat(balanceStr.replace(/[^0-9.]/g, "")) || null;

      toInsert.push({
        client_name: name,
        client_phone: phone,
        stage_id: stage.id,
        position: nextPos++,
        tags: [cfg.source_tag],
        source: cfg.source_label,
        age: idxAge >= 0 ? (row[idxAge] ?? "").toString() || null : null,
        state: idxState >= 0 ? (row[idxState] ?? "").toString() || null : null,
        super_fund_name: idxFund >= 0 ? (row[idxFund] ?? "").toString() || null : null,
        super_balance: balanceNum,
        notes: idxComments >= 0 ? (row[idxComments] ?? "").toString() || null : null,
        progress_stages: [],
      });
      trackInsert.push({
        spreadsheet_id: cfg.spreadsheet_id,
        sheet_name: cfg.sheet_name,
        phone_digits: d,
        client_name: name,
      });
      imported.add(d);
      existingTails.add(tail);
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insErr } = await admin
        .from("pipeline_deals")
        .insert(toInsert)
        .select("id, client_phone");
      if (insErr) throw insErr;
      imports = inserted?.length ?? 0;

      const phoneToDeal = new Map<string, string>();
      (inserted ?? []).forEach((d: { id: string; client_phone: string | null }) => {
        phoneToDeal.set(digits(d.client_phone), d.id);
      });
      trackInsert.forEach((t) => {
        const did = phoneToDeal.get(t.phone_digits as string);
        if (did) t.deal_id = did;
      });
    }

    if (trackInsert.length > 0) {
      await admin.from("sheet_lead_imports").upsert(trackInsert, {
        onConflict: "spreadsheet_id,sheet_name,phone_digits",
        ignoreDuplicates: true,
      });
    }

    await admin.from("sheet_lead_sync_config").update({
      last_synced_at: new Date().toISOString(),
      last_imported_count: imports,
      last_error: null,
    }).eq("id", 1);

    return new Response(JSON.stringify({ ok: true, imported: imports, scanned: rows.length - 1 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("gsheet-leads-sync error:", msg);
    await admin.from("sheet_lead_sync_config").update({
      last_synced_at: new Date().toISOString(),
      last_error: msg,
    }).eq("id", 1);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
