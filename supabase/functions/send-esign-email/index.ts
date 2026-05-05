import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, to, clientName, signingUrl, documentName, documentId } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (type === "signed-notification") {
      // Notify the host that a document has been signed
      const { data: doc } = await supabase
        .from("esign_documents")
        .select("*, esign_signatures(*)")
        .eq("id", documentId)
        .single();

      if (!doc) throw new Error("Document not found");

      // Get host email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", doc.host_user_id)
        .single();

      if (!profile) throw new Error("Host not found");

      // Send notification to host via Google Mail connector
      const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      if (GOOGLE_MAIL_API_KEY && LOVABLE_API_KEY) {
        await fetch("https://connector-gateway.lovable.dev/google-mail/v1/messages/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
          },
          body: JSON.stringify({
            to: [{ email: profile.email }],
            subject: `✅ Document Signed: ${doc.document_name}`,
            htmlBody: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;">
                <h2 style="color:#0ea5e9;">Document Signed Successfully</h2>
                <p style="color:#333;">Great news! <strong>${clientName || doc.client_name}</strong> has signed the document <strong>${doc.document_name}</strong>.</p>
                <p style="color:#666;font-size:14px;">You can view the signed document in your E-Sign Docs dashboard.</p>
                <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
                <p style="color:#999;font-size:12px;">Advisor Link Online - E-Sign</p>
              </div>
            `,
          }),
        });

        // Also send a copy to the client
        if (doc.client_email) {
          await fetch("https://connector-gateway.lovable.dev/google-mail/v1/messages/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
            },
            body: JSON.stringify({
              to: [{ email: doc.client_email }],
              subject: `Your signed document: ${doc.document_name}`,
              htmlBody: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;">
                  <h2 style="color:#0ea5e9;">Thank You for Signing!</h2>
                  <p style="color:#333;">Hi ${doc.client_name},</p>
                  <p style="color:#333;">Your document <strong>${doc.document_name}</strong> has been signed and submitted successfully.</p>
                  <p style="color:#333;">A copy has been saved for your records. Your adviser will be in touch shortly.</p>
                  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
                  <p style="color:#999;font-size:12px;">Advisor Link Online</p>
                </div>
              `,
            }),
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: Send signing request email to client
    if (!to || !signingUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!GOOGLE_MAIL_API_KEY || !LOVABLE_API_KEY) {
      throw new Error("Email configuration not found");
    }

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;background:#fff;">
        <div style="text-align:center;padding:20px 0;">
          <h1 style="color:#0f172a;font-size:24px;margin:0;">Document Ready for Signing</h1>
        </div>
        <div style="padding:30px 20px;background:#f8fafc;border-radius:12px;margin:20px 0;">
          <p style="color:#333;font-size:16px;line-height:1.6;">Hi ${clientName || "there"},</p>
          <p style="color:#333;font-size:16px;line-height:1.6;">
            Please sign the <strong>${documentName || "attached document"}</strong> (ATC and TPA) to give us your consent to set up your client folder for the meeting with your adviser.
          </p>
          <p style="color:#666;font-size:14px;">This process is quick and easy — just click the button below to review and sign.</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${signingUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;font-size:18px;font-weight:bold;padding:16px 48px;border-radius:10px;text-decoration:none;">
              Sign Here
            </a>
          </div>
        </div>
        <p style="color:#999;font-size:12px;text-align:center;margin-top:20px;">
          If you did not expect this email, please ignore it.<br/>
          Advisor Link Online
        </p>
      </div>
    `;

    const res = await fetch("https://connector-gateway.lovable.dev/google-mail/v1/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
      },
      body: JSON.stringify({
        to: [{ email: to }],
        subject: `Action Required: Please sign ${documentName || "your document"}`,
        htmlBody: emailHtml,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Email send failed: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
