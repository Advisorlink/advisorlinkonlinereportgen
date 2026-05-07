import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "end", "quit"];

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();

    // Telnyx sends webhook events with data.event_type and data.payload
    const event = payload.data;
    if (!event) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const eventType = event.event_type;

    // Handle delivery status updates
    if (eventType === "message.sent" || eventType === "message.delivered" || eventType === "message.failed" || eventType === "message.finalized") {
      const msgPayload = event.payload;
      const msgId = msgPayload?.id;
      if (!msgId) return new Response(JSON.stringify({ ok: true }), { status: 200 });

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const statusMap: Record<string, string> = {
        "message.sent": "sent",
        "message.delivered": "delivered",
        "message.failed": "failed",
        "message.finalized": "delivered",
      };
      const status = statusMap[eventType] || "sent";
      const updateData: Record<string, unknown> = { status };
      if (status === "delivered") updateData.delivered_at = new Date().toISOString();
      if (status === "failed") {
        updateData.failed_at = new Date().toISOString();
        updateData.error_message = JSON.stringify(msgPayload.errors || []);
      }
      await supabase.from("sms_messages").update(updateData).eq("twilio_sid", msgId);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Handle inbound messages
    if (eventType !== "message.received") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const msgPayload = event.payload;
    const from = msgPayload?.from?.phone_number;
    const to = msgPayload?.to?.[0]?.phone_number || msgPayload?.to;
    const body = msgPayload?.text || "";
    const messageSid = msgPayload?.id;
    const mediaUrls: string[] = (msgPayload?.media || []).map((m: any) => m.url).filter(Boolean);

    if (!from) {
      console.error("No from number in Telnyx webhook");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const isOptOut = OPT_OUT_KEYWORDS.includes(body.trim().toLowerCase());

    // Find or create contact
    let { data: contact } = await supabase
      .from("sms_contacts")
      .select("id, user_id, opt_out_status")
      .eq("phone", from)
      .limit(1)
      .single();

    const { data: appConfig } = await supabase.from("app_config").select("owner_user_id").eq("id", 1).single();
    const ownerId = appConfig?.owner_user_id;

    if (!contact && ownerId) {
      const { data: newContact } = await supabase
        .from("sms_contacts")
        .insert({ user_id: ownerId, full_name: from, phone: from, opt_in_status: true, opt_in_date: new Date().toISOString() })
        .select("id, user_id")
        .single();
      contact = newContact ? { ...newContact, opt_out_status: false } : null;
    }

    if (!contact) {
      console.error("Could not find or create contact for", from);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Handle opt-out
    if (isOptOut) {
      await supabase.from("sms_contacts").update({ opt_out_status: true, opt_out_date: new Date().toISOString() }).eq("id", contact.id);
      await supabase.from("sms_opt_records").insert({
        contact_id: contact.id,
        action: "opt_out",
        method: "keyword",
        keyword: body.trim().toLowerCase(),
        phone: from,
        source: "inbound_sms_telnyx",
      });
    }

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("sms_conversations")
      .select("id")
      .eq("contact_id", contact.id)
      .neq("status", "archived")
      .limit(1)
      .single();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from("sms_conversations")
        .insert({ contact_id: contact.id, user_id: contact.user_id || ownerId, status: "open" })
        .select("id")
        .single();
      conversation = newConv;
    }

    if (!conversation) {
      console.error("Could not find or create conversation");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const channel = mediaUrls.length > 0 ? "mms" : "sms";

    const { data: msg } = await supabase.from("sms_messages").insert({
      conversation_id: conversation.id,
      contact_id: contact.id,
      user_id: contact.user_id || ownerId,
      twilio_sid: messageSid,
      direction: "inbound",
      channel,
      from_number: from,
      to_number: typeof to === "string" ? to : to?.phone_number || "",
      body,
      media_urls: mediaUrls,
      status: "received",
    }).select("id").single();

    // Save media records
    if (msg && mediaUrls.length > 0) {
      for (const url of mediaUrls) {
        await supabase.from("sms_message_media").insert({
          message_id: msg.id,
          media_url: url,
          content_type: "application/octet-stream",
        });
      }
    }

    // Update conversation
    const { data: convData } = await supabase.from("sms_conversations").select("unread_count").eq("id", conversation.id).single();
    await supabase.from("sms_conversations").update({
      last_message_body: body.substring(0, 200),
      last_message_at: new Date().toISOString(),
      last_message_direction: "inbound",
      is_unread: true,
      unread_count: (convData?.unread_count || 0) + 1,
      status: "open",
    }).eq("id", conversation.id);

    await supabase.from("sms_contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contact.id);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("sms-inbound-telnyx error:", err);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});
