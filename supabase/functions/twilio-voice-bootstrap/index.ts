// Auto-provisions Twilio Voice for the browser softphone.
// Idempotent: reuses existing config row; only creates resources if missing.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!ACCOUNT_SID || !AUTH_TOKEN) return json(500, { error: "Missing Twilio credentials" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Unauthorized" });
    const supaUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await supaUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub) return json(401, { error: "Unauthorized" });

    const supa = createClient(SUPABASE_URL, SERVICE);
    const basic = "Basic " + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
    const base = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}`;
    const voiceUrl = `${SUPABASE_URL}/functions/v1/twilio-voice`;

    // Load existing config
    const { data: existing } = await supa.from("twilio_voice_config").select("*").eq("id", 1).maybeSingle();
    const update: Record<string, unknown> = {};

    // 1. Caller ID — pick first owned number if not set
    let callerId = existing?.caller_id as string | null | undefined;
    if (!callerId) {
      const r = await fetch(`${base}/IncomingPhoneNumbers.json?PageSize=1`, { headers: { Authorization: basic } });
      const j = await r.json();
      callerId = j.incoming_phone_numbers?.[0]?.phone_number ?? null;
      if (callerId) update.caller_id = callerId;
    }

    // 2. API Key (cannot retrieve secret after creation, so always create new if missing)
    let apiKeySid = existing?.api_key_sid as string | null | undefined;
    let apiKeySecret = existing?.api_key_secret as string | null | undefined;
    if (!apiKeySid || !apiKeySecret) {
      const r = await fetch(`${base}/Keys.json`, {
        method: "POST",
        headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ FriendlyName: "Lovable CRM Softphone" }),
      });
      const j = await r.json();
      if (!r.ok) return json(500, { error: "Failed to create API Key", detail: j });
      apiKeySid = j.sid;
      apiKeySecret = j.secret;
      update.api_key_sid = apiKeySid;
      update.api_key_secret = apiKeySecret;
    }

    // 3. TwiML App pointing at our voice webhook
    let appSid = existing?.twiml_app_sid as string | null | undefined;
    if (!appSid) {
      const r = await fetch(`${base}/Applications.json`, {
        method: "POST",
        headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          FriendlyName: "Lovable CRM Softphone",
          VoiceUrl: voiceUrl,
          VoiceMethod: "POST",
        }),
      });
      const j = await r.json();
      if (!r.ok) return json(500, { error: "Failed to create TwiML App", detail: j });
      appSid = j.sid;
      update.twiml_app_sid = appSid;
    } else {
      // Make sure the URL is current
      await fetch(`${base}/Applications/${appSid}.json`, {
        method: "POST",
        headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ VoiceUrl: voiceUrl, VoiceMethod: "POST" }),
      });
    }

    // 4. Bind incoming number to TwiML app
    if (callerId) {
      const list = await fetch(
        `${base}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(callerId)}`,
        { headers: { Authorization: basic } },
      ).then((r) => r.json());
      const num = list.incoming_phone_numbers?.[0];
      if (num?.sid && num.voice_application_sid !== appSid) {
        await fetch(`${base}/IncomingPhoneNumbers/${num.sid}.json`, {
          method: "POST",
          headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ VoiceApplicationSid: appSid!, VoiceUrl: "", VoiceMethod: "POST" }),
        });
      }
    }

    if (Object.keys(update).length > 0) {
      await supa.from("twilio_voice_config").update(update).eq("id", 1);
    }

    return json(200, {
      ok: true,
      caller_id: callerId,
      api_key_sid: apiKeySid,
      twiml_app_sid: appSid,
      bound_number: !!callerId,
    });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
