import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "end", "quit"];

Deno.serve(async (req) => {
  // Twilio sends form-urlencoded POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = formData.get("Body") as string || "";
    const messageSid = formData.get("MessageSid") as string;
    const numMedia = parseInt(formData.get("NumMedia") as string || "0");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Collect media URLs
    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const url = formData.get(`MediaUrl${i}`) as string;
      if (url) mediaUrls.push(url);
    }

    // Check for opt-out keywords
    const isOptOut = OPT_OUT_KEYWORDS.includes(body.trim().toLowerCase());

    // Find or create contact
    let { data: contact } = await supabase
      .from("sms_contacts")
      .select("id, user_id, opt_out_status")
      .eq("phone", from)
      .limit(1)
      .single();

    // Get the owner user_id from app_config
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
      return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
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
        source: "inbound_sms",
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
      return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
    }

    const channel = numMedia > 0 ? "mms" : "sms";

    // Save message
    const { data: msg } = await supabase.from("sms_messages").insert({
      conversation_id: conversation.id,
      contact_id: contact.id,
      user_id: contact.user_id || ownerId,
      twilio_sid: messageSid,
      direction: "inbound",
      channel,
      from_number: from,
      to_number: to,
      body,
      media_urls: mediaUrls,
      status: "received",
    }).select("id").single();

    // Save media records
    if (msg && mediaUrls.length > 0) {
      for (const url of mediaUrls) {
        const contentType = formData.get(`MediaContentType${mediaUrls.indexOf(url)}`) as string;
        await supabase.from("sms_message_media").insert({
          message_id: msg.id,
          media_url: url,
          content_type: contentType,
        });
      }
    }

    // Update conversation
    await supabase.from("sms_conversations").update({
      last_message_body: body.substring(0, 200),
      last_message_at: new Date().toISOString(),
      last_message_direction: "inbound",
      is_unread: true,
      unread_count: (await supabase.from("sms_conversations").select("unread_count").eq("id", conversation.id).single()).data?.unread_count + 1 || 1,
      status: "open",
    }).eq("id", conversation.id);

    // Update contact
    await supabase.from("sms_contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contact.id);

    // Fire push notification to the owner's devices (no-op if FCM not configured)
    try {
      const deepLink = `/messages?phone=${encodeURIComponent(from)}&name=${encodeURIComponent(contact.full_name || "")}`;
      await supabase.functions.invoke("send-push", {
        body: {
          user_id: ownerId,
          title: `SMS from ${contact.full_name || from}`,
          body: body.slice(0, 140) || "(media message)",
          data: {
            type: "sms",
            route: deepLink,
            phone: from,
            name: contact.full_name || "",
            contact_id: contact.id,
            conversation_id: conversation.id,
          },
        },
      });
    } catch (e) {
      console.error("send-push invoke failed", e);
    }

    // Return empty TwiML response
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  } catch (err) {
    console.error("sms-inbound error:", err);
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }
});
