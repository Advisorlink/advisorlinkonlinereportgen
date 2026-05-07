import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify auth
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

    const { to, body, mediaUrls, contactId, conversationId, fromNumber } = await req.json();

    if (!to || !body) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'body'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get default from number if not provided
    let from = fromNumber;
    if (!from) {
      const { data: numData } = await supabase
        .from("sms_twilio_numbers")
        .select("phone_number")
        .eq("is_default", true)
        .limit(1)
        .single();
      from = numData?.phone_number;
      if (!from) {
        const { data: anyNum } = await supabase
          .from("sms_twilio_numbers")
          .select("phone_number")
          .limit(1)
          .single();
        from = anyNum?.phone_number;
      }
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

    // Build Twilio request
    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/sms-status-callback`;
    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: body,
      StatusCallback: statusCallbackUrl,
    });

    if (mediaUrls && mediaUrls.length > 0) {
      for (const url of mediaUrls) {
        params.append("MediaUrl", url);
      }
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio error:", twilioData);
      return new Response(JSON.stringify({ error: "Failed to send SMS", details: twilioData }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find or create conversation
    let convId = conversationId;
    let contId = contactId;

    if (!contId) {
      // Try to find contact by phone
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

    // Save message
    const { data: msg, error: msgErr } = await supabase.from("sms_messages").insert({
      conversation_id: convId,
      contact_id: contId,
      user_id: userId,
      twilio_sid: twilioData.sid,
      direction: "outbound",
      channel,
      from_number: from,
      to_number: to,
      body,
      media_urls: mediaUrls || [],
      status: twilioData.status || "queued",
      sent_by_user_id: userId,
      segment_count: twilioData.num_segments ? parseInt(twilioData.num_segments) : 1,
    }).select("id").single();

    if (msgErr) console.error("DB error saving message:", msgErr);

    // Update conversation
    await supabase.from("sms_conversations").update({
      last_message_body: body.substring(0, 200),
      last_message_at: new Date().toISOString(),
      last_message_direction: "outbound",
      status: "open",
    }).eq("id", convId);

    // Update contact last_message_at
    await supabase.from("sms_contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contId);

    return new Response(JSON.stringify({ success: true, messageSid: twilioData.sid, messageId: msg?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sms-send error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
