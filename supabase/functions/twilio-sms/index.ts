// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  const Body = (form.get("Body") as string) || "";
  const MessageSid = (form.get("MessageSid") as string) || "";
  console.log("twilio-sms hit:", { From, To, Body, MessageSid });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: tokens, error } = await supa
    .from("device_tokens")
    .select("token")
    .eq("token_type", "expo");
  if (error) console.log("device_tokens query error:", error);
  console.log("tokens found:", tokens?.length ?? 0);

  const messages = (tokens ?? [])
    .filter((t: any) => t.token?.startsWith("ExponentPushToken"))
    .map((t: any) => ({
      to: t.token,
      sound: "default",
      title: `SMS from ${From}`,
      body: Body.slice(0, 240) || "(no content)",
      data: { type: "sms", from: From, to: To, sid: MessageSid, route: "/sms-hub" },
      priority: "high",
      channelId: "default",
    }));

  if (messages.length > 0) {
    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    console.log("expo push response:", resp.status, await resp.text());
  }

  return twiml();
});
