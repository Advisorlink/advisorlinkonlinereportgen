// Edge function: upload a generated PDF to GoHighLevel as a contact file.
// Looks up the contact by email; if not found, returns { skipped: true }.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GHL_API = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GHL_API_KEY");
    const locationId = Deno.env.get("GHL_LOCATION_ID");
    if (!apiKey || !locationId) {
      return json({ error: "GHL credentials not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { email, fileName, pdfBase64 } = body as {
      email?: string; fileName?: string; pdfBase64?: string;
    };
    if (!email || !fileName || !pdfBase64) {
      return json({ error: "Missing email, fileName, or pdfBase64" }, 400);
    }

    // 1) Lookup contact by email
    const lookupUrl = `${GHL_API}/contacts/search/duplicate?locationId=${encodeURIComponent(locationId)}&email=${encodeURIComponent(email)}`;
    const lookup = await fetch(lookupUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_VERSION,
        Accept: "application/json",
      },
    });

    let contactId: string | null = null;
    if (lookup.ok) {
      const j = await lookup.json().catch(() => ({}));
      contactId = j?.contact?.id ?? j?.contacts?.[0]?.id ?? null;
    }

    if (!contactId) {
      // Fallback: search endpoint
      const searchRes = await fetch(`${GHL_API}/contacts/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_VERSION,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          locationId,
          pageLimit: 1,
          filters: [{ field: "email", operator: "eq", value: email }],
        }),
      });
      if (searchRes.ok) {
        const sj = await searchRes.json().catch(() => ({}));
        contactId = sj?.contacts?.[0]?.id ?? null;
      }
    }

    if (!contactId) {
      return json({ skipped: true, reason: "no_contact" }, 200);
    }

    // 2) Decode base64 → blob and upload via multipart
    // GHL v2 endpoint: POST /conversations/messages/upload
    // Required field key: "fileAttachment". Max 5MB per file.
    const bin = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
    if (bin.byteLength > 5 * 1024 * 1024) {
      return json({
        skipped: true,
        reason: "file_too_large",
        sizeBytes: bin.byteLength,
      }, 200);
    }
    const fd = new FormData();
    fd.append("locationId", locationId);
    fd.append("contactId", contactId);
    fd.append(
      "fileAttachment",
      new Blob([bin], { type: "application/pdf" }),
      fileName,
    );

    const up = await fetch(`${GHL_API}/conversations/messages/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_VERSION,
        Accept: "application/json",
      },
      body: fd,
    });

    if (!up.ok) {
      const t = await up.text();
      if (up.status === 401 && t.toLowerCase().includes("scope")) {
        return json({
          skipped: true,
          reason: "ghl_scope_missing",
          message: "Your Go High Level token is missing permission to upload conversation message attachments. Add the Conversations / Messages write scope to the Private Integration token, then update the GHL_API_KEY secret if GHL issues a new token.",
          ghlStatus: up.status,
          ghlResponse: t,
        }, 200);
      }
      return json({ error: `GHL upload failed: ${up.status} ${t}` }, 502);
    }

    const upJson = await up.json().catch(() => ({}));
    return json({ success: true, contactId, ghl: upJson }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
