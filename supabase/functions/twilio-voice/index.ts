import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const TWIML_HEADERS = { "Content-Type": "application/xml" };
const HANGUP_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;

async function sendExpoPush(tokens: string[], title: string, body: string, data: Record<string, unknown>) {
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
    channelId: "default",
  }));
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => null);
    console.log("Expo push response", res.status, JSON.stringify(json));
  } catch (e) {
    console.error("Expo push failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(HANGUP_TWIML, { headers: TWIML_HEADERS });
  }

  try {
    const form = await req.formData();
    const from = (form.get("From") as string) || "";
    const to = (form.get("To") as string) || "";
    const callSid = (form.get("CallSid") as string) || "";
    const callStatus = (form.get("CallStatus") as string) || "";

    console.log("Incoming call", { from, to, callSid, callStatus });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows, error } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("token_type", "expo");

    if (error) console.error("device_tokens query error", error);

    const tokens = (rows ?? []).map((r) => r.token as string).filter(Boolean);

    await sendExpoPush(
      tokens,
      "Incoming call",
      `Call from ${from}`,
      { type: "call", from, route: "/calls" },
    );

    return new Response(HANGUP_TWIML, { headers: TWIML_HEADERS });
  } catch (err) {
    console.error("twilio-voice error", err);
    return new Response(HANGUP_TWIML, { headers: TWIML_HEADERS });
  }
});
