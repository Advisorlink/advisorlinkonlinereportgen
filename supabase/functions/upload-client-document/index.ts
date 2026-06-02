import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["license", "statement", "screenshot", "super_statement", "other"]);

const clean = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");
const safePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9@._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "client";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!req.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
    return json({ error: "Upload must be sent as form data" }, 400);
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const clientName = clean(form.get("clientName"));
    const clientEmail = clean(form.get("clientEmail")).toLowerCase();
    const clientPhone = clean(form.get("clientPhone")) || null;
    const notes = clean(form.get("notes")) || null;
    const documentType = clean(form.get("documentType"));

    if (!(file instanceof File)) return json({ error: "Missing file" }, 400);
    if (!clientName || clientName.length > 100) return json({ error: "Client name is required" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail) || clientEmail.length > 255) return json({ error: "Valid email is required" }, 400);
    if (!ALLOWED_TYPES.has(documentType)) return json({ error: "Unsupported document type" }, 400);
    if (file.size <= 0 || file.size > MAX_BYTES) return json({ error: "File must be 25MB or smaller" }, 400);

    const ext = safePart(file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg"));
    const folder = `${safePart(clientEmail)}/${Date.now()}`;
    const path = `${folder}/${safePart(documentType)}-${crypto.randomUUID()}.${ext}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: uploadError } = await supabase.storage
      .from("client-documents")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) throw uploadError;

    const { data, error: dbError } = await supabase
      .from("client_documents")
      .insert({
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        document_type: documentType,
        file_path: path,
        file_name: file.name || `${documentType}.${ext}`,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        consent_given: true,
        notes,
      })
      .select("id, file_path")
      .single();
    if (dbError) throw dbError;

    return json({ id: data.id, path: data.file_path });
  } catch (err) {
    console.error("upload-client-document error", err);
    return json({ error: err instanceof Error ? err.message : "Upload failed" }, 500);
  }
});