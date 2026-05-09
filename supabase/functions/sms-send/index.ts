import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendViaTwilio(to: string, from: string, body: string, mediaUrls: string[], statusCallbackUrl: string) {
  const params = new URLSearchParams({ To: to, From: from, Body: body, StatusCallback: statusCallbackUrl });
  if (mediaUrls?.length > 0) {
    for (const url of mediaUrls) params.append("MediaUrl", url);
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio error: ${JSON.stringify(data)}`);
  return { sid: data.sid, status: data.status || "queued", segments: data.num_segments ? parseInt(data.num_segments) : 1 };
}

async function sendViaTelnyx(to: string, from: string, body: string, mediaUrls: string[], webhookUrl: string) {
  if (!TELNYX_API_KEY) throw new Error("TELNYX_API_KEY is not configured");
  const payload: any = { from, to, text: body, webhook_url: webhookUrl };
  if (mediaUrls?.length > 0) payload.media_urls = mediaUrls;
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Telnyx error: ${JSON.stringify(data)}`);
  const msg = data.data || data;
  return { sid: msg.id, status: msg.to?.[0]?.status || "queued", segments: msg.parts || 1 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.user.id;

    const { to: rawTo, body, mediaUrls, contactId, conversationId, fromNumber } = await req.json();

    if (!rawTo || !body) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'body'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Normalize destination number to E.164. Defaults to AU (+61) for local-format numbers.
    function normalizePhone(input: string, defaultCountry: "AU" | "US" = "AU"): string {
      let n = String(input).trim().replace(/[\s\-().]/g, "");
      if (n.startsWith("+")) return n;
      if (n.startsWith("00")) return "+" + n.slice(2);
      if (defaultCountry === "AU") {
        if (n.startsWith("0")) return "+61" + n.slice(1);
        if (/^4\d{8}$/.test(n)) return "+61" + n;
        if (n.startsWith("61")) return "+" + n;
      }
      if (defaultCountry === "US") {
        if (n.length === 10) return "+1" + n;
        if (n.length === 11 && n.startsWith("1")) return "+" + n;
      }
      return "+" + n;
    }
    const to = normalizePhone(rawTo);
    if (!/^\+\d{8,15}$/.test(to)) {
      return new Response(JSON.stringify({ error: `Invalid 'to' phone number: ${rawTo}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get default from number and its provider
    let from = fromNumber;
    let provider = "twilio";
    if (!from) {
      const { data: numData } = await supabase
        .from("sms_twilio_numbers")
        .select("phone_number, provider")
        .eq("is_default", true)
        .limit(1)
        .single();
      from = numData?.phone_number;
      provider = numData?.provider || "twilio";
      if (!from) {
        const { data: anyNum } = await supabase
          .from("sms_twilio_numbers")
          .select("phone_number, provider")
          .limit(1)
          .single();
        from = anyNum?.phone_number;
        provider = anyNum?.provider || "twilio";
      }
    } else {
      // Look up provider for the specified number
      const { data: numLookup } = await supabase
        .from("sms_twilio_numbers")
        .select("provider")
        .eq("phone_number", from)
        .limit(1)
        .single();
      provider = numLookup?.provider || "twilio";
    }

    if (!from) {
      return new Response(JSON.stringify({ error: "No sending number configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check opt-out status
    if (contactId) {
      const { data: contact } = await supabase.from("sms_contacts").select("opt_out_status").eq("id", contactId).single();
      if (contact?.opt_out_status) {
        return new Response(JSON.stringify({ error: "Contact has opted out of SMS" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Send via the appropriate provider
    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/sms-status-callback`;
    const telnyxWebhookUrl = `${SUPABASE_URL}/functions/v1/sms-inbound-telnyx`;
    let result: { sid: string; status: string; segments: number };

    if (provider === "telnyx") {
      result = await sendViaTelnyx(to, from, body, mediaUrls, telnyxWebhookUrl);
    } else {
      result = await sendViaTwilio(to, from, body, mediaUrls, statusCallbackUrl);
    }

    // Find or create conversation
    let convId = conversationId;
    let contId = contactId;

    if (!contId) {
      const { data: existingContact } = await supabase
        .from("sms_contacts")
        .select("id")
        .eq("phone", to)
        .limit(1)
        .single();

      if (existingContact) {
        contId = existingContact.id;
      } else {
        const { data: newContact } = await supabase
          .from("sms_contacts")
          .insert({ user_id: userId, full_name: to, phone: to })
          .select("id")
          .single();
        contId = newContact?.id;
      }
    }

    if (!convId && contId) {
      const { data: existingConv } = await supabase
        .from("sms_conversations")
        .select("id")
        .eq("contact_id", contId)
        .neq("status", "archived")
        .limit(1)
        .single();

      if (existingConv) {
        convId = existingConv.id;
      } else {
        const { data: newConv } = await supabase
          .from("sms_conversations")
          .insert({ contact_id: contId, user_id: userId, status: "open" })
          .select("id")
          .single();
        convId = newConv?.id;
      }
    }

    const channel = (mediaUrls && mediaUrls.length > 0) ? "mms" : "sms";

    const { data: msg, error: msgErr } = await supabase.from("sms_messages").insert({
      conversation_id: convId,
      contact_id: contId,
      user_id: userId,
      twilio_sid: result.sid,
      direction: "outbound",
      channel,
      from_number: from,
      to_number: to,
      body,
      media_urls: mediaUrls || [],
      status: result.status,
      sent_by_user_id: userId,
      segment_count: result.segments,
    }).select("id").single();

    if (msgErr) console.error("DB error saving message:", msgErr);

    await supabase.from("sms_conversations").update({
      last_message_body: body.substring(0, 200),
      last_message_at: new Date().toISOString(),
      last_message_direction: "outbound",
      status: "open",
    }).eq("id", convId);

    await supabase.from("sms_contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contId);

    return new Response(JSON.stringify({ success: true, messageSid: result.sid, messageId: msg?.id, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sms-send error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
