
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/**
 * Fetch the primary send-as signature from Gmail settings.
 */
async function fetchSignature(lovableKey: string, gmailKey: string): Promise<string> {
  try {
    const res = await fetch(`${GATEWAY_URL}/users/me/settings/sendAs`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
      },
    });
    if (!res.ok) {
      console.warn("[send-report-email] Could not fetch sendAs settings:", res.status);
      return "";
    }
    const data = await res.json();
    const sendAs = data.sendAs as Array<{ isPrimary?: boolean; signature?: string }> | undefined;
    if (!sendAs) return "";
    const primary = sendAs.find(s => s.isPrimary) ?? sendAs[0];
    return primary?.signature ?? "";
  } catch (e) {
    console.warn("[send-report-email] Signature fetch error:", e);
    return "";
  }
}

/**
 * Build an RFC 2822 message with a PDF attachment and base64url-encode it
 * so it can be sent via the Gmail API's messages/send endpoint.
 * The body is HTML so the signature (which is HTML) renders properly.
 */
function buildRawEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  pdfBase64: string,
  pdfFileName: string,
): string {
  const boundary = `----=_Part_${crypto.randomUUID().replace(/-/g, "")}`;

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyHtml,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFileName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${pdfFileName}"`,
    "",
    pdfBase64,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const encoded = btoa(
    unescape(encodeURIComponent(message)),
  );
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    if (!GOOGLE_MAIL_API_KEY) return json({ error: "GOOGLE_MAIL_API_KEY not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const { recipientEmail, clientName, pdfBase64, fileName, customBody, isHtml, customSubject } = body as {
      recipientEmail?: string;
      clientName?: string;
      pdfBase64?: string;
      fileName?: string;
      customBody?: string;
      isHtml?: boolean;
      customSubject?: string;
    };

    if (!recipientEmail || !pdfBase64 || !fileName) {
      return json({ error: "Missing recipientEmail, pdfBase64, or fileName" }, 400);
    }

    const name = (clientName ?? "").trim() || "there";
    const subject = customSubject ?? "Super Performance Report";

    // Fetch Gmail signature
    const signatureHtml = await fetchSignature(LOVABLE_API_KEY, GOOGLE_MAIL_API_KEY);

    let fullHtml: string;

    if (isHtml && customBody) {
      // Already formatted HTML — use as-is, append signature
      fullHtml = customBody;
      if (signatureHtml) {
        fullHtml += `\n<br>\n<div class="gmail_signature">${signatureHtml}</div>`;
      }
    } else {
      // Plain text — convert to simple HTML
      const plainBody = customBody ??
        `Hi ${name}\n\nHere is your Free performance report. Please note that this document is NOT to be taken as financial advice. It is just to help you understand if there is potential improvements you could be missing out on.`;
      const bodyHtmlParts = plainBody.split("\n").map((line: string) => line === "" ? "<br>" : `<p style="margin:0">${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`);
      fullHtml = bodyHtmlParts.join("\n");
      if (signatureHtml) {
        fullHtml += `\n<br>\n<div class="gmail_signature">${signatureHtml}</div>`;
      }
    }

    const raw = buildRawEmail(recipientEmail, subject, fullHtml, pdfBase64, fileName);

    console.log("[send-report-email] Sending to", recipientEmail, "file:", fileName, "signature:", signatureHtml ? "yes" : "no");

    const gmailRes = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    const gmailData = await gmailRes.json().catch(() => ({}));
    if (!gmailRes.ok) {
      console.error("[send-report-email] Gmail API error:", gmailRes.status, JSON.stringify(gmailData));
      return json({ error: `Gmail API error [${gmailRes.status}]`, details: gmailData }, 502);
    }

    console.log("[send-report-email] Sent successfully, messageId:", gmailData.id);
    return json({ success: true, messageId: gmailData.id });
  } catch (e) {
    console.error("[send-report-email] Error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
