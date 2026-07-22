import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

function gwHeaders() {
  const lk = Deno.env.get("LOVABLE_API_KEY");
  const dk = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!lk) throw new Error("LOVABLE_API_KEY missing");
  if (!dk) throw new Error("GOOGLE_DRIVE_API_KEY missing");
  return { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": dk };
}

async function findOrCreateFolder(name: string, parent = "root"): Promise<string> {
  const q = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${name.replace(/'/g, "\\'")}' and '${parent}' in parents`;
  const url = new URL(`${GATEWAY}/drive/v3/files`);
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const r = await fetch(url, { headers: gwHeaders() });
  const data = await r.json();
  if (!r.ok) throw new Error(`Drive list failed [${r.status}]: ${JSON.stringify(data)}`);
  if (data.files?.length) return data.files[0].id;

  const cr = await fetch(`${GATEWAY}/drive/v3/files?supportsAllDrives=true`, {
    method: "POST",
    headers: { ...gwHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parent] }),
  });
  const cd = await cr.json();
  if (!cr.ok) throw new Error(`Folder create failed [${cr.status}]: ${JSON.stringify(cd)}`);
  return cd.id;
}

async function uploadPdf(folderId: string, filename: string, bytes: Uint8Array) {
  const boundary = "lovable_" + crypto.randomUUID().replace(/-/g, "");
  const meta = JSON.stringify({ name: filename, parents: [folderId] });
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0); body.set(bytes, head.length); body.set(tail, head.length + bytes.length);

  const r = await fetch(`${GATEWAY}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: "POST",
    headers: { ...gwHeaders(), "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Drive upload failed [${r.status}]: ${JSON.stringify(data)}`);
  return data;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { name, email, phone, selected, selected_titles, filename, pdf_base64 } = body ?? {};

    if (!name || !email || !pdf_base64 || !filename) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof name !== "string" || name.length > 200 || typeof email !== "string" || email.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid field lengths" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parent = await findOrCreateFolder("Settled & Sound - Advice Requests");
    const bytes = b64ToBytes(pdf_base64);
    const uploaded = await uploadPdf(parent, filename, bytes);

    // Best-effort DB log (optional, ignore failures)
    try {
      const sup = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await sup.from("advice_requests").insert({
        client_name: name, client_email: email, client_phone: phone ?? null,
        selected_ids: selected ?? [], selected_titles: selected_titles ?? [],
        drive_file_id: uploaded.id, drive_view_link: uploaded.webViewLink ?? null,
      });
    } catch (_e) { /* table optional */ }

    return new Response(JSON.stringify({ ok: true, drive: uploaded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("submit-advice-request error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
