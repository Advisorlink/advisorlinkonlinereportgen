// Edge function: upload a generated PDF to GoHighLevel as a contact file.
// Looks up the contact by email; if not found, returns { skipped: true }.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GHL_API = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[ghl-upload] Request received", req.method);
    const apiKey = Deno.env.get("GHL_API_KEY");
    const locationId = Deno.env.get("GHL_LOCATION_ID");
    const configuredDocumentsFieldKey = Deno.env.get("GHL_DOCUMENTS_FIELD_KEY");
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

    console.log("[ghl-upload] Email:", email, "File:", fileName, "Base64 length:", pdfBase64.length);
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
      console.log("[ghl-upload] No contact found for", email);
      return json({ skipped: true, reason: "no_contact" }, 200);
    }
    console.log("[ghl-upload] Contact found:", contactId);

    // 2) Decode base64 → blob and upload into the contact's Documents/File Upload custom field.
    // GHL powers the contact "Documents" area with a File Upload custom field, not conversation attachments.
    const bin = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
    if (bin.byteLength > 50 * 1024 * 1024) {
      return json({
        skipped: true,
        reason: "file_too_large",
        sizeBytes: bin.byteLength,
      }, 200);
    }
    const fieldId = await resolveDocumentsFieldId(apiKey, locationId, contactId, configuredDocumentsFieldKey);
    console.log("[ghl-upload] Resolved field ID:", fieldId, "configured key:", configuredDocumentsFieldKey);
    if (!fieldId) {
      return json({
        skipped: true,
        reason: "documents_field_not_found",
        message: "No Go High Level File Upload custom field was found. Add the Documents field Unique Key or field ID as GHL_DOCUMENTS_FIELD_KEY in Lovable Cloud secrets.",
      }, 200);
    }

    const fd = new FormData();
    fd.append(`${fieldId}_${crypto.randomUUID()}`, new Blob([bin], { type: "application/pdf" }), fileName);

    const up = await fetch(`${GHL_API}/forms/upload-custom-files?contactId=${encodeURIComponent(contactId)}&locationId=${encodeURIComponent(locationId)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_VERSION,
        Accept: "application/json",
      },
      body: fd,
    });

    console.log("[ghl-upload] Upload response status:", up.status);
    if (!up.ok) {
      const t = await up.text();
      console.log("[ghl-upload] Upload failed:", up.status, t);
      if (up.status === 401 && t.toLowerCase().includes("scope")) {
        return json({
          skipped: true,
          reason: "ghl_scope_missing",
          message: "Your Go High Level token needs Forms: Write and Locations Custom Fields: Read permissions to upload into the contact Documents section.",
          ghlStatus: up.status,
          ghlResponse: t,
        }, 200);
      }
      return json({ error: `GHL documents upload failed: ${up.status} ${t}` }, 502);
    }

    const upJson = await up.json().catch(() => ({}));
    const uploadedUrl = extractUploadedFileUrl(upJson, fileName, fieldId);

    let noteResult: { created: boolean; status?: number; response?: string } = { created: false };
    if (uploadedUrl) {
      const noteRes = await fetch(`${GHL_API}/contacts/${encodeURIComponent(contactId)}/notes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_VERSION,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          body: `Performance report uploaded: ${uploadedUrl}`,
          title: fileName,
          pinned: false,
        }),
      });

      noteResult = {
        created: noteRes.ok,
        status: noteRes.status,
        response: await noteRes.text().catch(() => ""),
      };
    }

    return json({ success: true, contactId, uploadedUrl, documentsFieldId: fieldId, note: noteResult, ghl: upJson }, 200);
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

async function resolveDocumentsFieldId(apiKey: string, locationId: string, contactId: string, configuredKey?: string): Promise<string | null> {
  const fields = await getLocationCustomFields(apiKey, locationId);
  const rawConfiguredKey = cleanConfiguredFieldKey(configuredKey);
  const normalizedConfiguredKey = normalizeFieldKey(rawConfiguredKey);
  if (normalizedConfiguredKey) {
    const configuredField = fields.find((field: Record<string, unknown>) => {
      const keys = [field.id, field.fieldKey, field.key, field.uniqueKey, field.name, field.label, field.fieldName]
        .map((value) => normalizeFieldKey(String(value ?? "")));
      return keys.includes(normalizedConfiguredKey);
    });
    if (configuredField?.id) return String(configuredField.id);
    if (/^[A-Za-z0-9]{12,}$/.test(rawConfiguredKey)) return rawConfiguredKey;
  }

  const fileFields = fields.filter((field: Record<string, unknown>) => {
    const type = String(field.dataType ?? field.fieldType ?? field.type ?? "").toLowerCase();
    return type.includes("file") || type.includes("upload");
  });
  const docsField = fileFields.find((field: Record<string, unknown>) => {
    const name = String(field.name ?? field.label ?? field.fieldName ?? "").toLowerCase();
    return name.includes("document") || name.includes("review") || name.includes("super health");
  }) ?? fileFields[0];

  return String(docsField?.id ?? "") || await findExistingContactFileFieldId(apiKey, contactId);
}

async function getLocationCustomFields(apiKey: string, locationId: string): Promise<Record<string, unknown>[]> {
  const fieldsById = new Map<string, Record<string, unknown>>();
  for (const suffix of ["?model=contact", "?model=all", ""]) {
    const res = await fetch(`${GHL_API}/locations/${encodeURIComponent(locationId)}/customFields${suffix}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2023-02-21",
        Accept: "application/json",
      },
    });

    console.log("[ghl-upload] Custom fields lookup", suffix || "default", "status:", res.status);
    if (!res.ok) continue;
    const data = await res.json().catch(() => ({}));
    const fields = Array.isArray(data?.customFields) ? data.customFields : Array.isArray(data) ? data : [];
    for (const field of fields) {
      const id = String(field?.id ?? crypto.randomUUID());
      fieldsById.set(id, field);
    }
  }
  return [...fieldsById.values()];
}

async function findExistingContactFileFieldId(apiKey: string, contactId: string): Promise<string | null> {
  const res = await fetch(`${GHL_API}/contacts/${encodeURIComponent(contactId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const fields = Array.isArray(data?.contact?.customFields) ? data.contact.customFields : [];
  const fileField = fields.find((field: Record<string, unknown>) => {
    const value = field.value;
    return Boolean(value && typeof value === "object" && JSON.stringify(value).includes("documentId"));
  });
  return String(fileField?.id ?? "") || null;
}

function normalizeFieldKey(value?: string): string {
  return cleanConfiguredFieldKey(value)
    .replace(/^contact\./i, "")
    .trim()
    .toLowerCase();
}

function cleanConfiguredFieldKey(value?: string): string {
  return String(value ?? "")
    .replace(/[{}]/g, "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function extractUploadedFileUrl(data: unknown, fileName: string, fieldId: string): string | null {
  const walk = (value: unknown): string | null => {
    if (typeof value === "string") return value.startsWith("http") ? value : null;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record[fileName] === "string") return record[fileName] as string;
    const customFields = Array.isArray(record.customFields) ? record.customFields : [];
    const uploadedField = customFields.find((field: Record<string, unknown>) => field.id === fieldId);
    if (uploadedField?.value) return walk(uploadedField.value);
    for (const nested of Object.values(record)) {
      const found = walk(nested);
      if (found) return found;
    }
    return null;
  };
  return walk(data);
}
