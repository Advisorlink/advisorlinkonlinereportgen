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
  let value = input.trim().replace(/[^\d+]/g, "");
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
  console.log("twilio-voice:", { From, To, CallSid, CallStatus });

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
  const callerId = cfg?.caller_id || "";

  // Outbound: browser → PSTN
  if (From.startsWith("client:")) {
    const normalizedTo = normalizePhoneNumber(To);
    if (!normalizedTo || !isE164(normalizedTo)) {
      return twiml("<Say>That phone number is not valid. Please use the full mobile number.</Say><Hangup/>");
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
      `<Dial callerId="${safeCaller}" answerOnBridge="true" timeout="30"><Number>${safeTo}</Number></Dial>`,
    );
  }

  // Inbound: PSTN → browser client (with push notification fallback)
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
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(expoMessages),
      });
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
