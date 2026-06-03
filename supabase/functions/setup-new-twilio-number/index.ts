// One-shot helper: import a Twilio number into VAPI, set it as the default
// SMS/voice number, and bind it to the softphone TwiML app.
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
    const { number, friendlyName, makeDefault = true } = await req.json();
    if (!number || !number.startsWith("+")) {
      return json(400, { error: "E.164 number required (e.g. +61480891603)" });
    }

    const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(SUPABASE_URL, SERVICE);

    const result: Record<string, unknown> = { number };

    // 1. Import into VAPI (idempotent: ignore "already exists" 400s)
    const vapiRes = await fetch("https://api.vapi.ai/phone-number", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "twilio",
        number,
        twilioAccountSid: ACCOUNT_SID,
        twilioAuthToken: AUTH_TOKEN,
        name: friendlyName || `Twilio AU ${number}`,
      }),
    });
    const vapiBody = await vapiRes.text();
    result.vapi_status = vapiRes.status;
    result.vapi_response = vapiBody.slice(0, 500);

    // 2. Save into sms_twilio_numbers; make it default if requested.
    const { data: ownerCfg } = await supa.from("app_config").select("owner_user_id").eq("id", 1).maybeSingle();
    const ownerId = ownerCfg?.owner_user_id;
    if (!ownerId) return json(500, { error: "No owner configured" });

    if (makeDefault) {
      await supa.from("sms_twilio_numbers").update({ is_default: false }).neq("phone_number", number);
    }
    const { data: existing } = await supa.from("sms_twilio_numbers")
      .select("id").eq("phone_number", number).maybeSingle();
    if (existing) {
      await supa.from("sms_twilio_numbers").update({
        provider: "twilio",
        is_default: makeDefault,
        sms_enabled: true,
        mms_enabled: true,
        friendly_name: friendlyName || `Twilio AU ${number}`,
      }).eq("id", existing.id);
    } else {
      await supa.from("sms_twilio_numbers").insert({
        phone_number: number,
        provider: "twilio",
        user_id: ownerId,
        is_default: makeDefault,
        sms_enabled: true,
        mms_enabled: true,
        friendly_name: friendlyName || `Twilio AU ${number}`,
      });
    }
    result.sms_numbers_updated = true;

    // 3. Update softphone caller_id and re-bind incoming number to TwiML app.
    const { data: voiceCfg } = await supa.from("twilio_voice_config").select("*").eq("id", 1).maybeSingle();
    if (voiceCfg) {
      const basic = "Basic " + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
      const base = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}`;

      // Find this number in Twilio
      const list = await fetch(
        `${base}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`,
        { headers: { Authorization: basic } },
      ).then((r) => r.json());
      const num = list.incoming_phone_numbers?.[0];
      if (num?.sid && voiceCfg.twiml_app_sid) {
        const bind = await fetch(`${base}/IncomingPhoneNumbers/${num.sid}.json`, {
          method: "POST",
          headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            VoiceApplicationSid: voiceCfg.twiml_app_sid,
            VoiceUrl: "",
            VoiceMethod: "POST",
          }),
        });
        result.twilio_bind_status = bind.status;
      } else {
        result.twilio_bind_status = "number not found in Twilio account";
      }

      if (makeDefault) {
        await supa.from("twilio_voice_config").update({
          caller_id: number,
          updated_at: new Date().toISOString(),
        }).eq("id", 1);
        result.voice_config_caller_id = number;
      }
    }

    return json(200, { ok: true, ...result });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
