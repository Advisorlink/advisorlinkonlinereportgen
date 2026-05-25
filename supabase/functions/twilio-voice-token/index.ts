// Mints a Twilio Voice access token (JWT) for the browser softphone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function signJwt(payload: Record<string, unknown>, secret: string, headerExtras: Record<string, unknown> = {}) {
  const header = { alg: "HS256", typ: "JWT", ...headerExtras };
  const enc = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(enc)));
  return `${enc}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    if (!ACCOUNT_SID) return json(500, { error: "TWILIO_ACCOUNT_SID missing" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Unauthorized" });
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await supa.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub) return json(401, { error: "Unauthorized" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await admin.from("twilio_voice_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg?.api_key_sid || !cfg?.api_key_secret || !cfg?.twiml_app_sid) {
      return json(400, { error: "Voice not provisioned. Run bootstrap first." });
    }

    const identity = cfg.client_identity || "crm_user";
    const now = Math.floor(Date.now() / 1000);
    const ttl = 60 * 60; // 1 hour

    const grants = {
      identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: cfg.twiml_app_sid },
      },
    };

    const payload = {
      jti: `${cfg.api_key_sid}-${now}`,
      iss: cfg.api_key_sid,
      sub: ACCOUNT_SID,
      iat: now,
      nbf: now,
      exp: now + ttl,
      grants,
    };

    const token = await signJwt(payload, cfg.api_key_secret, { cty: "twilio-fpa;v=1" });
    return json(200, { token, identity, caller_id: cfg.caller_id, expires_in: ttl });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
