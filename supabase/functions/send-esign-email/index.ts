import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOGO_URL = "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-white.svg";

function createRawEmail(to: string, subject: string, htmlBody: string): string {
  const boundary = "boundary_" + Date.now();
  const email = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "",
    htmlBody,
    `--${boundary}--`,
  ].join("\r\n");
  const encoder = new TextEncoder();
  const bytes = encoder.encode(email);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendEmail(to: string, subject: string, htmlBody: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!GOOGLE_MAIL_API_KEY) throw new Error("GOOGLE_MAIL_API_KEY is not configured");

  const raw = createRawEmail(to, subject, htmlBody);
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
    },
    body: JSON.stringify({ raw }),
  });

  const data = await res.text();
  if (!res.ok) {
    throw new Error(`Gmail API failed [${res.status}]: ${data}`);
  }
  return data;
}

// ─── Branded email wrapper ───
function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:28px 32px;border-radius:16px 16px 0 0;text-align:center;">
            <img src="${LOGO_URL}" alt="Advisor Link Online" width="180" style="max-width:180px;height:auto;" />
          </td>
        </tr>
        <!-- Cyan accent -->
        <tr>
          <td style="height:4px;background:linear-gradient(90deg,#0ea5e9,#0284c7);font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px;border-radius:0 0 16px 16px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">Powered by <strong style="color:#0f172a;">Advisor Link Online</strong></p>
            <p style="margin:0;font-size:11px;color:#cbd5e1;">This is an automated message. Please do not reply directly to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email 1: Signing request to client ───
function signingRequestEmail(clientName: string, documentName: string, signingUrl: string): string {
  return emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;font-family:'Helvetica Neue',Arial,sans-serif;">
      Document Ready for You
    </h1>
    <div style="width:48px;height:4px;background:#0ea5e9;border-radius:2px;margin:0 0 24px;"></div>
    <p style="margin:0 0 16px;font-size:16px;color:#334155;line-height:1.6;">
      Hi <strong>${clientName}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      Your adviser has prepared <strong style="color:#0f172a;">${documentName}</strong> for your review and signature.
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">
      Please take a moment to review the document carefully, then sign it electronically. The process is quick, easy and fully secure.
    </p>
    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center">
        <a href="${signingUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;font-size:17px;font-weight:700;padding:16px 48px;border-radius:12px;text-decoration:none;box-shadow:0 8px 24px -4px rgba(14,165,233,0.35);">
          Review &amp; Sign Document
        </a>
      </td></tr>
    </table>
    <div style="margin:28px 0 0;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td width="40" valign="top">
            <div style="width:36px;height:36px;background:#ecfdf5;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">🔒</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0f172a;">Secure Electronic Signature</p>
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">Your signature is encrypted and legally binding. A copy of the signed document will be sent to you for your records.</p>
          </td>
        </tr>
      </table>
    </div>
  `);
}

// ─── Email 2: Confirmation to client after signing (with download link) ───
function clientSignedEmail(clientName: string, documentName: string, signedPdfUrl: string | null): string {
  const downloadSection = signedPdfUrl ? `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
      <tr><td align="center">
        <a href="${signedPdfUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;">
          📄 Download Signed Document
        </a>
      </td></tr>
    </table>` : "";

  return emailWrapper(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;background:#ecfdf5;border-radius:50%;text-align:center;line-height:64px;font-size:32px;">✅</div>
    </div>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif;">
      Document Signed Successfully
    </h1>
    <div style="width:48px;height:4px;background:#10b981;border-radius:2px;margin:12px auto 24px;"></div>
    <p style="margin:0 0 16px;font-size:16px;color:#334155;line-height:1.6;">
      Hi <strong>${clientName}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      Thank you for signing <strong style="color:#0f172a;">${documentName}</strong>. Your signature has been recorded and your adviser has been notified.
    </p>
    <div style="padding:20px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin:16px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td width="40" valign="top">
            <div style="width:36px;height:36px;background:#dcfce7;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">📋</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0f172a;">What happens next?</p>
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">Your adviser will review the signed document and will be in touch to discuss the next steps. No further action is required from you at this time.</p>
          </td>
        </tr>
      </table>
    </div>
    ${downloadSection}
  `);
}

// ─── Email 3: Notification to host/adviser (with download link) ───
function hostNotificationEmail(clientName: string, documentName: string, signedPdfUrl: string | null): string {
  const downloadSection = signedPdfUrl ? `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
      <tr><td align="center">
        <a href="${signedPdfUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;box-shadow:0 4px 12px -2px rgba(14,165,233,0.3);">
          📄 Download Signed Document
        </a>
      </td></tr>
    </table>` : "";

  return emailWrapper(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;background:#ecfdf5;border-radius:50%;text-align:center;line-height:64px;font-size:32px;">🎉</div>
    </div>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif;">
      Document Signed!
    </h1>
    <div style="width:48px;height:4px;background:#0ea5e9;border-radius:2px;margin:12px auto 24px;"></div>
    <p style="margin:0 0 16px;font-size:16px;color:#334155;line-height:1.6;">
      Great news! <strong style="color:#0ea5e9;">${clientName}</strong> has successfully signed <strong style="color:#0f172a;">${documentName}</strong>.
    </p>
    <div style="padding:20px;background:#f0f9ff;border-radius:12px;border:1px solid #bae6fd;margin:16px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td width="40" valign="top">
            <div style="width:36px;height:36px;background:#e0f2fe;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">📝</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0f172a;">Signing Details</p>
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
              <strong>Client:</strong> ${clientName}<br/>
              <strong>Document:</strong> ${documentName}<br/>
              <strong>Signed:</strong> ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </td>
        </tr>
      </table>
    </div>
    ${downloadSection}
    <p style="margin:16px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
      You can also view this document in your <strong>E-Sign Docs</strong> dashboard under "Review Docs".
    </p>
  `);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, to, clientName, signingUrl, documentName, documentId } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (type === "signed-notification") {
      const { data: doc } = await supabase
        .from("esign_documents")
        .select("*, esign_signatures(*)")
        .eq("id", documentId)
        .single();
      if (!doc) throw new Error("Document not found");

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", doc.host_user_id)
        .single();
      if (!profile) throw new Error("Host not found");

      // Generate signed PDF download URL if available
      let signedPdfUrl: string | null = null;
      if (doc.signed_pdf_path) {
        const { data: urlData } = await supabase.storage
          .from("esign-documents")
          .createSignedUrl(doc.signed_pdf_path, 60 * 60 * 24 * 7); // 7 days
        if (urlData?.signedUrl) signedPdfUrl = urlData.signedUrl;
      }

      // Notify host with download link
      await sendEmail(
        profile.email,
        `✅ Document Signed: ${doc.document_name}`,
        hostNotificationEmail(clientName || doc.client_name || "Client", doc.document_name, signedPdfUrl)
      );

      // Send confirmation copy to client with download link
      if (doc.client_email) {
        await sendEmail(
          doc.client_email,
          `Your signed document: ${doc.document_name}`,
          clientSignedEmail(doc.client_name || "there", doc.document_name, signedPdfUrl)
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send signing request to client
    if (!to || !signingUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, signingUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendEmail(
      to,
      `Action Required: Please sign ${documentName || "your document"}`,
      signingRequestEmail(clientName || "there", documentName || "your document", signingUrl)
    );

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
