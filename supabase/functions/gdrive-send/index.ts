import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

function gwHeaders() {
  const lk = Deno.env.get("LOVABLE_API_KEY");
  const dk = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!lk) throw new Error("LOVABLE_API_KEY missing");
  if (!dk) throw new Error("GOOGLE_DRIVE_API_KEY missing");
  return {
    Authorization: `Bearer ${lk}`,
    "X-Connection-Api-Key": dk,
  };
}

async function listFolders(parent: string | null, q: string | null) {
  const clauses: string[] = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ];
  if (parent) clauses.push(`'${parent}' in parents`);
  else clauses.push("'root' in parents");
  if (q) clauses.push(`name contains '${q.replace(/'/g, "\\'")}'`);

  const url = new URL(`${GATEWAY}/drive/v3/files`);
  url.searchParams.set("q", clauses.join(" and "));
  url.searchParams.set("fields", "files(id,name,parents,modifiedTime)");
  url.searchParams.set("orderBy", "name");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const r = await fetch(url, { headers: gwHeaders() });
  const data = await r.json();
  if (!r.ok) throw new Error(`Drive list failed [${r.status}]: ${JSON.stringify(data)}`);
  return data.files ?? [];
}

async function uploadOne(folderId: string, name: string, mime: string, bytes: Uint8Array) {
  // Multipart upload
  const boundary = "lovable_" + crypto.randomUUID().replace(/-/g, "");
  const meta = JSON.stringify({ name, parents: [folderId] });

  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${meta}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mime || "application/octet-stream"}\r\n\r\n`
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const r = await fetch(
    `${GATEWAY}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        ...gwHeaders(),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const data = await r.json();
  if (!r.ok) throw new Error(`Drive upload failed [${r.status}]: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body?.action as string;

    if (action === "list_folders") {
      const folders = await listFolders(body.parent ?? null, body.q ?? null);
      return new Response(JSON.stringify({ folders }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send") {
      const folderId = body.folder_id as string;
      const docIds = (body.doc_ids as string[]) || [];
      if (!folderId) throw new Error("folder_id required");
      if (!docIds.length) throw new Error("doc_ids required");

      // Verify caller is authenticated
      const authHeader = req.headers.get("Authorization") ?? "";
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = createClient(supabaseUrl, serviceKey);
      const { data: docs, error } = await admin
        .from("client_documents")
        .select("*")
        .in("id", docIds);
      if (error) throw error;

      const results: any[] = [];
      for (const d of docs || []) {
        const { data: signed, error: sErr } = await admin.storage
          .from("client-documents")
          .createSignedUrl(d.file_path, 60);
        if (sErr || !signed) {
          results.push({ id: d.id, ok: false, error: sErr?.message || "signed url failed" });
          continue;
        }
        const fileRes = await fetch(signed.signedUrl);
        if (!fileRes.ok) {
          results.push({ id: d.id, ok: false, error: `download ${fileRes.status}` });
          continue;
        }
        const buf = new Uint8Array(await fileRes.arrayBuffer());
        try {
          const up = await uploadOne(folderId, d.file_name, d.mime_type || "application/octet-stream", buf);
          results.push({ id: d.id, ok: true, drive_id: up.id });
        } catch (e) {
          results.push({ id: d.id, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
