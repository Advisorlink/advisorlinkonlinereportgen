// deno-lint-ignore-file no-explicit-any
// Twilio Voice TwiML webhook.
// - Outbound from browser softphone (From starts with "client:"): dials the target number using caller_id.
// - Inbound from PSTN: rings the browser client; also sends a push notification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function normalizePhoneNumber(input: string) {
  const value = input.trim().replace(/[^\d+]/g, "");
  if (!value) return "";
  if (value.startsWith("+")) return value;
  if (value.startsWith("0011")) return `+${value.slice(4)}`;
  if (value.startsWith("00")) return `+${value.slice(2)}`;
  if (value.startsWith("61")) return `+${value}`;
  if (value.startsWith("0")) return `+61${value.slice(1)}`;
  if (/^4\d{8}$/.test(value)) return `+61${value}`;
  return `+${value}`;
}

function isE164(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const b64url = (buf: ArrayBuffer | Uint8Array | string) => {
    const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    let str = "";
    bytes.forEach((b) => (str += String.fromCharCode(b)));
    return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

function twiml(body = ""): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
    { headers: { ...cors, "Content-Type": "application/xml" } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const form = await req.formData();
  const From = (form.get("From") as string) || "Unknown";
  const To = (form.get("To") as string) || "";
  const CallSid = (form.get("CallSid") as string) || "";
  const CallStatus = (form.get("CallStatus") as string) || "";
  const CallerIdOverride = (form.get("CallerId") as string) || "";
  console.log("twilio-voice:", { From, To, CallSid, CallStatus, CallerIdOverride });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cfg } = await supa
    .from("twilio_voice_config")
    .select("caller_id, client_identity")
    .eq("id", 1)
    .maybeSingle();
  const clientIdentity = cfg?.client_identity || "crm_user";
  let callerId = cfg?.caller_id || "";

  // Outbound: browser → PSTN
  if (From.startsWith("client:")) {
    const normalizedTo = normalizePhoneNumber(To);
    if (!normalizedTo || !isE164(normalizedTo)) {
      return twiml("<Say>That phone number is not valid. Please use the full mobile number.</Say><Hangup/>");
    }
    // Allow the dialer to override the caller-id with any owned Twilio number
    if (CallerIdOverride) {
      const { data: owned } = await supa
        .from("sms_twilio_numbers")
        .select("phone_number")
        .eq("phone_number", CallerIdOverride)
        .eq("provider", "twilio")
        .maybeSingle();
      if (owned?.phone_number) callerId = owned.phone_number;
    }
    await supa.from("voice_call_logs").insert({
      call_sid: CallSid,
      direction: "outbound",
      from_number: callerId,
      to_number: normalizedTo,
      status: "initiated",
    });
    const safeTo = xmlEscape(normalizedTo);
    const safeCaller = xmlEscape(callerId);
    return twiml(
      `<Dial callerId="${safeCaller}" answerOnBridge="true" ringTone="au" timeout="30"><Number>${safeTo}</Number></Dial>`,
    );
  }

  // Inbound: PSTN → check if this number has an AI assistant assigned; otherwise ring the browser client.
  // Look up routing for the dialed number.
  try {
    const { data: routing } = await supa
      .from("inbound_ai_routing")
      .select("vapi_assistant_id, vapi_phone_number_id")
      .eq("phone_number", To)
      .maybeSingle();
    const assistantId = (routing as any)?.vapi_assistant_id as string | undefined;
    const vapiPhoneNumberId = (routing as any)?.vapi_phone_number_id as string | undefined;
    if (assistantId && vapiPhoneNumberId) {
      await supa.from("voice_call_logs").insert({
        call_sid: CallSid,
        direction: "inbound",
        from_number: From,
        to_number: To,
        status: "ai-answered",
      });
      // Vapi BYO SIP inbound routing expects the registered phone number as the SIP user.
      // Using the assistant id or Vapi phone-number resource id makes Vapi answer "number not found".
      const safeSipNumber = xmlEscape(To.replace(/^\+/, ""));
      return twiml(
        `<Dial answerOnBridge="true" timeout="30"><Sip>sip:${safeSipNumber}@sip.vapi.ai</Sip></Dial>`,
      );
    }
  } catch (e) {
    console.log("inbound routing lookup failed, falling back to softphone:", e);
  }

  // No AI assistant assigned - ring the browser softphone (with push notification fallback).
  // Attempt contact lookup for nicer logs
  let contactName: string | null = null;
  try {
    const digits = From.replace(/[^0-9]/g, "").slice(-9);
    if (digits) {
      const { data: c } = await supa
        .from("sms_contacts")
        .select("full_name")
        .ilike("phone", `%${digits}%`)
        .limit(1)
        .maybeSingle();
      contactName = (c as any)?.full_name ?? null;
    }
  } catch (_e) { /* noop */ }

  await supa.from("voice_call_logs").insert({
    call_sid: CallSid,
    direction: "inbound",
    from_number: From,
    to_number: To,
    status: "ringing",
    contact_name: contactName,
  });

  // Best-effort push notification to mobile devices
  try {
    const { data: tokens } = await supa
      .from("device_tokens")
      .select("token, token_type, platform");
    const expoMessages = (tokens ?? [])
      .filter((t: any) => t.token_type === "expo" && t.token?.startsWith("ExponentPushToken"))
      .map((t: any) => ({
        to: t.token,
        sound: "default",
        title: contactName ? `Call from ${contactName}` : "Incoming call",
        body: `Call from ${From}`,
        data: { type: "call", from: From, sid: CallSid, route: "/phone" },
        priority: "high",
        channelId: "calls",
      }));
    if (expoMessages.length > 0) {
      const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(expoMessages),
      });
      const expoText = await expoRes.text();
      console.log("expo push response:", expoRes.status, expoText);
    }
    const fcmTokens = (tokens ?? []).filter((t: any) => t.token_type === "fcm");
    const projectId = Deno.env.get("FCM_PROJECT_ID");
    const saJson = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (fcmTokens.length > 0 && projectId && saJson) {
      const accessToken = await getGoogleAccessToken(saJson);
      const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
      await Promise.allSettled(fcmTokens.map((t: any) => fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: t.token,
            notification: { title: contactName ? `Call from ${contactName}` : "Incoming call", body: `Call from ${From}` },
            data: { type: "call", from: From, sid: CallSid, route: "/phone" },
            android: { priority: "HIGH", notification: { channel_id: "calls", sound: "default", priority: "PRIORITY_MAX" } },
            apns: { payload: { aps: { sound: "default", category: "INCOMING_CALL" } } },
          },
        }),
      })));
    }
  } catch (e) {
    console.log("push notify failed:", e);
  }

  const safeIdentity = xmlEscape(clientIdentity);
  return twiml(
    `<Dial answerOnBridge="true" timeout="25"><Client>${safeIdentity}</Client></Dial>`,
  );
});
