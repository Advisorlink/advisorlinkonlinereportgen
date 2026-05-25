import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token, path } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Validate token → look up document
    const { data: doc, error } = await supa
      .from("esign_documents")
      .select("original_pdf_path,signed_pdf_path")
      .eq("signing_token", token)
      .maybeSingle();
    if (error || !doc) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const requested = typeof path === "string" ? path : doc.original_pdf_path;
    // Only allow paths that belong to this document
    if (requested !== doc.original_pdf_path && requested !== doc.signed_pdf_path) {
      return new Response(JSON.stringify({ error: "path not allowed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!requested) {
      return new Response(JSON.stringify({ error: "no pdf for document" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: signed, error: urlErr } = await supa.storage
      .from("esign-documents")
      .createSignedUrl(requested, 3600);
    if (urlErr || !signed) {
      return new Response(JSON.stringify({ error: urlErr?.message || "url failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ signedUrl: signed.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
