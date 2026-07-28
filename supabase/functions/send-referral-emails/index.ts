const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const LOGO_URL = "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png";
const LOGO_CID = "advisorlink-logo";

// The public URL where the referral landing form lives
const APP_URL = "https://report.advisorlinkonline.com.au";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function buildReferralEmailHtml(referrerName: string, leadName: string, token: string): string {
  const safeName = leadName.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
  const safeReferrer = referrerName.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
  const formUrl = `${APP_URL}/refer/claim?token=${token}`;

  const brandBlue = "#29B6F6";
  const brandBlueDark = "#1E88E5";
  const darkText = "#1a1a2e";
  const bodyText = "#444455";
  const mutedText = "#7a7a8e";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .outer { padding: 0 !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer" style="background-color:#f0f2f5;padding:24px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;background-color:#ffffff;">

  <!-- LOGO -->
  <tr><td style="padding:32px 32px 20px;text-align:center;background-color:#ffffff;">
    <img src="cid:${LOGO_CID}" alt="Settled & Sound" width="180" style="display:inline-block;width:180px;max-width:70%;height:auto;border:0;" />
  </td></tr>

  <!-- HERO BANNER -->
  <tr><td class="px" style="padding:0 32px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:40px 32px;text-align:center;background:linear-gradient(135deg, ${brandBlueDark}, ${brandBlue});border-radius:16px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.85);">You've Been Referred!</p>
        <p style="margin:8px 0 0;font-size:28px;font-weight:bold;color:#ffffff;line-height:34px;">Free Super<br>Performance Report</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- GREETING -->
  <tr><td class="px" style="padding:0 32px 20px;">
    <p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:${darkText};line-height:26px;">Hi ${safeName},</p>
    <p style="margin:0;font-size:15px;color:${bodyText};line-height:25px;">
      Great news! <strong style="color:${brandBlue};">${safeReferrer}</strong> has just done a free superannuation review with us and got a lot of value, so they have referred you for a completely free Superannuation Report!
    </p>
    <p style="margin:16px 0 0;font-size:15px;color:${bodyText};line-height:25px;">
      This report is completely free and gives you a detailed analysis of how your super fund is performing, how much you will potentially retire on, highlighting potential improvements that could make a real difference to your retirement.
    </p>
  </td></tr>

  <!-- CTA BUTTON -->
  <tr><td class="px" style="padding:8px 32px 32px;text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;border-collapse:separate;">
      <tr>
        <td style="border-radius:12px;background:linear-gradient(135deg, ${brandBlueDark}, ${brandBlue});">
          <a href="${formUrl}" style="display:inline-block;padding:16px 40px;color:#ffffff;font-size:18px;font-weight:bold;text-decoration:none;letter-spacing:0.5px;">
            Click Here for Your Free Report →
          </a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- FINE PRINT -->
  <tr><td class="px" style="padding:0 32px 24px;">
    <p style="margin:0;font-size:13px;color:${mutedText};line-height:20px;text-align:center;">
      No cost · No obligation · Takes just 2 minutes
    </p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background-color:#f7f7fa;padding:20px 32px;text-align:center;border-top:1px solid #e8e8ee;">
    <p style="margin:0;font-size:11px;color:${mutedText};line-height:18px;">Settled & Sound · Helping you get the most from your super</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

interface InlineImage {
  cid: string;
  contentType: string;
  fileName: string;
  base64: string;
}

function buildRawEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  inlineImages: InlineImage[] = [],
): string {
  const boundary = `----=_Mixed_${crypto.randomUUID().replace(/-/g, "")}`;
  const relatedBoundary = `----=_Related_${crypto.randomUUID().replace(/-/g, "")}`;

  const parts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    inlineImages.length > 0
      ? `Content-Type: multipart/related; boundary="${relatedBoundary}"`
      : 'Content-Type: text/html; charset="UTF-8"',
    ...(inlineImages.length > 0
      ? ["", `--${relatedBoundary}`, 'Content-Type: text/html; charset="UTF-8"']
      : []),
    "Content-Transfer-Encoding: 8bit",
    "",
    bodyHtml,
    "",
  ];

  for (const img of inlineImages) {
    parts.push(
      `--${relatedBoundary}`,
      `Content-Type: ${img.contentType}; name="${img.fileName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${img.cid}>`,
      `Content-Disposition: inline; filename="${img.fileName}"`,
      "",
      img.base64,
      "",
    );
  }
  if (inlineImages.length > 0) parts.push(`--${relatedBoundary}--`, "");
  parts.push(`--${boundary}--`);

  const message = parts.join("\r\n");
  const encoded = btoa(unescape(encodeURIComponent(message)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function fetchInlineLogo(): Promise<InlineImage | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { cid: LOGO_CID, contentType: ct, fileName: "logo-email.png", base64: btoa(binary) };
  } catch {
    return null;
  }
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing configuration" }, 500);
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { submissionId } = body as { submissionId?: string };

    if (!submissionId) return json({ error: "Missing submissionId" }, 400);

    // Fetch leads for this submission
    const { data: leads, error: leadsErr } = await sb
      .from("referral_leads")
      .select("*")
      .eq("submission_id", submissionId)
      .eq("email_sent", false);

    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) return json({ message: "No leads to email" });

    const inlineLogo = await fetchInlineLogo();
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const lead of leads) {
      try {
        const html = buildReferralEmailHtml(lead.referrer_name, lead.lead_name, lead.token);
        const subject = `REFERRED BY ${lead.referrer_name} for a Free Superannuation Report`;
        const raw = buildRawEmail(lead.lead_email, subject, html, inlineLogo ? [inlineLogo] : []);

        const gmailRes = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        });

        if (!gmailRes.ok) {
          const err = await gmailRes.text();
          results.push({ email: lead.lead_email, success: false, error: err });
          continue;
        }

        // Mark as sent
        await sb
          .from("referral_leads")
          .update({ email_sent: true, status: "email_sent" })
          .eq("id", lead.id);

        results.push({ email: lead.lead_email, success: true });
      } catch (e: any) {
        results.push({ email: lead.lead_email, success: false, error: e.message });
      }
    }

    console.log("[send-referral-emails] Results:", JSON.stringify(results));
    return json({ success: true, results });
  } catch (e) {
    console.error("[send-referral-emails] Error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
