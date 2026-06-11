import { supabase } from "@/integrations/supabase/client";

/**
 * Moves (or creates) a pipeline deal into the given stage by name.
 * Matches existing deals by email or phone (case-insensitive, normalised).
 * Optional extraFields are applied to the matched deal (or new deal) so
 * report data like super_fund_name, super_balance, age etc. is persisted
 * onto the client profile.
 */
export async function moveDealToStage(stageName: string, opts: {
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  extraFields?: Record<string, unknown>;
}) {
  try {
    const name = (opts.clientName || "").trim() || "Unnamed client";
    const email = (opts.clientEmail || "").trim().toLowerCase() || null;
    const phoneDigits = (opts.clientPhone || "").replace(/\D+/g, "");

    if (phoneDigits.length >= 6) {
      const phoneCandidates = new Set<string>([phoneDigits, phoneDigits.slice(-9)]);
      if (phoneDigits.startsWith("0") && phoneDigits.length === 10) {
        phoneCandidates.add(`61${phoneDigits.slice(1)}`);
      }
      if (phoneDigits.length === 9) {
        phoneCandidates.add(`61${phoneDigits}`);
      }

      const { data: deletedImports } = await supabase
        .from("sheet_lead_imports")
        .select("phone_digits")
        .not("deleted_at", "is", null)
        .in("phone_digits", Array.from(phoneCandidates));

      if ((deletedImports || []).length > 0) return;
    }

    // Strip undefined/null/blank entries so we never overwrite real data with blanks.
    const cleanedExtra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(opts.extraFields ?? {})) {
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && !v.trim()) continue;
      cleanedExtra[k] = typeof v === "string" ? v.trim() : v;
    }

    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("name", stageName)
      .maybeSingle();
    if (!stage?.id) return;

    const matchIds = new Set<string>();

    if (email) {
      const { data } = await supabase
        .from("pipeline_deals")
        .select("id")
        .ilike("client_email", email);
      (data || []).forEach((d: { id: string }) => matchIds.add(d.id));
    }

    if (phoneDigits.length >= 6) {
      const { data: allWithPhone } = await supabase
        .from("pipeline_deals")
        .select("id, client_phone")
        .not("client_phone", "is", null);
      (allWithPhone || []).forEach((d: { id: string; client_phone: string | null }) => {
        if ((d.client_phone || "").replace(/\D+/g, "").endsWith(phoneDigits.slice(-9))) {
          matchIds.add(d.id);
        }
      });
    }

    if (matchIds.size === 0 && name && name !== "Unnamed client") {
      const { data } = await supabase
        .from("pipeline_deals")
        .select("id")
        .ilike("client_name", name);
      (data || []).forEach((d: { id: string }) => matchIds.add(d.id));
    }

    if (matchIds.size > 0) {
      const update: Record<string, unknown> = {
        stage_id: stage.id,
        updated_at: new Date().toISOString(),
        ...cleanedExtra,
      };
      if (email) update.client_email = email;
      if (opts.clientPhone && opts.clientPhone.trim()) update.client_phone = opts.clientPhone;
      await supabase
        .from("pipeline_deals")
        .update(update as never)
        .in("id", Array.from(matchIds));
    } else {
      const { data: maxRow } = await supabase
        .from("pipeline_deals")
        .select("position")
        .eq("stage_id", stage.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPos = ((maxRow as { position?: number } | null)?.position ?? -1) + 1;
      await supabase.from("pipeline_deals").insert({
        client_name: name,
        client_email: email,
        client_phone: opts.clientPhone || null,
        stage_id: stage.id,
        position: nextPos,
        ...cleanedExtra,
      } as never);
    }

    try {
      await supabase.functions.invoke("workflow-trigger", {
        body: {
          triggerType: "pipeline_stage_changed",
          context: {
            client_name: name,
            client_email: email,
            client_phone: opts.clientPhone || null,
            stage_name: stageName,
          },
        },
      });
    } catch (e) {
      console.warn("workflow trigger failed", e);
    }
  } catch (e) {
    console.error("moveDealToStage failed", e);
  }
}

export const moveDealToReportGenerated = (opts: Parameters<typeof moveDealToStage>[1]) =>
  moveDealToStage("Report Generated", opts);

export const moveDealToReportSent = (opts: Parameters<typeof moveDealToStage>[1]) =>
  moveDealToStage("Report Sent", opts);
