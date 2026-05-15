
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const EMAIL_LOGO_URL = "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png";
const EMAIL_LOGO_CID = "advisorlink-logo";
const REQUIRED_REVIEW_MESSAGE = "Please have a read through it, and if anything concerns you or if you have any questions at all, feel free to reach out. We can arrange a free review and, if you would like to speak with someone, connect you with a fully licensed financial advisor at no extra cost.";

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
  pdfBase64?: string,
  pdfFileName?: string,
  inlineImages: InlineImage[] = [],
): string {
  const boundary = `----=_Mixed_${crypto.randomUUID().replace(/-/g, "")}`;
  const relatedBoundary = `----=_Related_${crypto.randomUUID().replace(/-/g, "")}`;
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    inlineImages.length > 0 ? `Content-Type: multipart/related; boundary="${relatedBoundary}"` : 'Content-Type: text/html; charset="UTF-8"',
    ...(inlineImages.length > 0 ? ["", `--${relatedBoundary}`, 'Content-Type: text/html; charset="UTF-8"'] : []),
    "Content-Transfer-Encoding: 8bit",
    "",
    bodyHtml,
    "",
  ];

  for (const image of inlineImages) {
    messageParts.push(
      `--${relatedBoundary}`,
      `Content-Type: ${image.contentType}; name="${image.fileName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${image.cid}>`,
      `Content-Disposition: inline; filename="${image.fileName}"`,
      "",
      image.base64,
      "",
    );
  }

  if (inlineImages.length > 0) {
    messageParts.push(`--${relatedBoundary}--`, "");
  }

  if (pdfBase64 && pdfFileName) {
    messageParts.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFileName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${pdfFileName}"`,
      "",
      pdfBase64,
      "",
    );
  }

  messageParts.push(`--${boundary}--`);
  const message = messageParts.join("\r\n");

  const encoded = btoa(
    unescape(encodeURIComponent(message)),
  );
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function fetchInlineLogo(): Promise<InlineImage | null> {
  try {
    const res = await fetch(EMAIL_LOGO_URL);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { cid: EMAIL_LOGO_CID, contentType, fileName: "logo-email.png", base64: btoa(binary) };
  } catch (e) {
    console.warn("[send-report-email] Logo inline fetch failed:", e);
    return null;
  }
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

    if (!recipientEmail) {
      return json({ error: "Missing recipientEmail" }, 400);
    }
    if (!isHtml && (!pdfBase64 || !fileName)) {
      return json({ error: "Missing pdfBase64 or fileName" }, 400);
    }

    const name = (clientName ?? "").trim() || "there";
    const subject = customSubject ?? "Super Performance Report";

    // Fetch Gmail signature
    const signatureHtml = await fetchSignature(LOVABLE_API_KEY, GOOGLE_MAIL_API_KEY);

    let fullHtml: string;

    if (isHtml && customBody) {
      // Already formatted HTML — use as-is, append signature
      fullHtml = customBody;
      const lowerHtml = fullHtml.toLowerCase();
      if (!lowerHtml.includes("free review") && !lowerHtml.includes("fully licensed financial advisor")) {
        fullHtml += `\n<br>\n<p style="margin:0">${REQUIRED_REVIEW_MESSAGE}</p>`;
      }
      if (signatureHtml) {
        fullHtml += `\n<br>\n<div class="gmail_signature">${signatureHtml}</div>`;
      }
    } else {
      // Plain text — convert to simple HTML
      const plainBody = customBody ??
        `Hi ${name},

Here is your free superannuation performance report.

${REQUIRED_REVIEW_MESSAGE}

Kind regards,`;
      const finalPlainBody = plainBody.toLowerCase().includes("free review") && plainBody.toLowerCase().includes("fully licensed financial advisor")
        ? plainBody
        : `${plainBody}\n\n${REQUIRED_REVIEW_MESSAGE}`;
      const bodyHtmlParts = finalPlainBody.split("\n").map((line: string) => line === "" ? "<br>" : `<p style="margin:0">${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`);
      fullHtml = bodyHtmlParts.join("\n");
      if (signatureHtml) {
        fullHtml += `\n<br>\n<div class="gmail_signature">${signatureHtml}</div>`;
      }
    }

    const inlineLogo = isHtml ? await fetchInlineLogo() : null;
    if (inlineLogo) {
      fullHtml = fullHtml.replaceAll(EMAIL_LOGO_URL, `cid:${EMAIL_LOGO_CID}`);
    }

    const raw = buildRawEmail(recipientEmail, subject, fullHtml, pdfBase64, fileName, inlineLogo ? [inlineLogo] : []);

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
