import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SigningField = {
  kind: "text" | "signature";
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, signatureData } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "Signing token is required" }, 400);
    if (!signatureData || typeof signatureData !== "string") return json({ error: "Signature is required" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: doc, error: docError } = await supa
      .from("esign_documents")
      .select("id, document_name, client_name, client_email, status, original_pdf_path, client_data")
      .eq("signing_token", token)
      .maybeSingle();

    if (docError) throw docError;
    if (!doc) return json({ error: "Invalid signing link" }, 404);
    if (doc.status !== "sent") return json({ error: "This document has already been signed" }, 409);
    if (!doc.original_pdf_path) return json({ error: "Original PDF is missing" }, 422);

    const signingFields = ((doc.client_data as { signing_fields?: SigningField[] } | null)?.signing_fields || [])
      .filter((field) => field.kind === "signature");

    if (signingFields.length === 0) return json({ error: "No signing position was found for this document" }, 422);

    const { data: originalPdf, error: downloadError } = await supa.storage
      .from("esign-documents")
      .download(doc.original_pdf_path);
    if (downloadError || !originalPdf) throw downloadError || new Error("Could not load original PDF");

    const pdfDoc = await PDFDocument.load(await originalPdf.arrayBuffer(), { ignoreEncryption: true });
    const signatureImage = await pdfDoc.embedPng(signatureData);
    const pages = pdfDoc.getPages();

    for (const field of signingFields) {
      const page = pages[field.pageIndex];
      if (!page) continue;

      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const w = field.width * pageWidth;
      const h = field.height * pageHeight;
      const fx = field.x * pageWidth;
      const fy = pageHeight - field.y * pageHeight - h;

      page.drawRectangle({
        x: fx - 2,
        y: fy - 2,
        width: w + 4,
        height: h + 4,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });

      page.drawImage(signatureImage, {
        x: fx + 6,
        y: fy + 4,
        width: Math.max(w - 12, 1),
        height: Math.max(h - 8, 1),
      });
    }

    const completedBytes = await pdfDoc.save();
    const signedPdfPath = doc.original_pdf_path.replace(/\.pdf$/i, "_signed.pdf");

    const { error: uploadError } = await supa.storage
      .from("esign-documents")
      .upload(signedPdfPath, new Blob([completedBytes], { type: "application/pdf" }), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const signatureRows = signingFields.map((_, index) => ({
      document_id: doc.id,
      signer_name: doc.client_name || "Unknown",
      signer_email: doc.client_email,
      signature_data: signatureData,
      field_index: index + 1,
    }));

    const { error: signatureError } = await supa.from("esign_signatures").insert(signatureRows);
    if (signatureError) throw signatureError;

    const { error: updateError } = await supa
      .from("esign_documents")
      .update({ status: "signed", signed_at: new Date().toISOString(), signed_pdf_path: signedPdfPath })
      .eq("id", doc.id)
      .eq("status", "sent");
    if (updateError) throw updateError;

    return json({ ok: true, signedPdfPath });
  } catch (e) {
    console.error("complete-esign-signing failed", e);
    return json({ error: "Failed to upload signed document" }, 500);
  }
});