// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "end", "quit"];

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
  const NumMedia = parseInt((form.get("NumMedia") as string) || "0", 10);
  console.log("twilio-sms hit:", { From, To, Body, MessageSid, NumMedia });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---------- Persist inbound message ----------
  try {
    const mediaUrls: string[] = [];
    for (let i = 0; i < NumMedia; i++) {
      const u = form.get(`MediaUrl${i}`) as string;
      if (u) mediaUrls.push(u);
    }

    const { data: appConfig } = await supa
      .from("app_config")
      .select("owner_user_id")
      .eq("id", 1)
      .single();
    const ownerId = appConfig?.owner_user_id;

    let { data: contact } = await supa
      .from("sms_contacts")
      .select("id, user_id, full_name")
      .eq("phone", From)
      .maybeSingle();

    if (!contact && ownerId) {
      const { data: newContact } = await supa
        .from("sms_contacts")
        .insert({
          user_id: ownerId,
          full_name: From,
          phone: From,
          opt_in_status: true,
          opt_in_date: new Date().toISOString(),
        })
        .select("id, user_id, full_name")
        .single();
      contact = newContact;
    }

    if (contact) {
      const isOptOut = OPT_OUT_KEYWORDS.includes(Body.trim().toLowerCase());
      if (isOptOut) {
        await supa
          .from("sms_contacts")
          .update({ opt_out_status: true, opt_out_date: new Date().toISOString() })
          .eq("id", contact.id);
        await supa.from("sms_opt_records").insert({
          contact_id: contact.id,
          action: "opt_out",
          method: "keyword",
          keyword: Body.trim().toLowerCase(),
          phone: From,
          source: "inbound_sms_twilio",
        });
      }

      let { data: conversation } = await supa
        .from("sms_conversations")
        .select("id, unread_count")
        .eq("contact_id", contact.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conversation) {
        const { data: newConv } = await supa
          .from("sms_conversations")
          .insert({
            contact_id: contact.id,
            user_id: contact.user_id || ownerId,
            status: "open",
          })
          .select("id, unread_count")
          .single();
        conversation = newConv;
      }

      if (conversation) {
        const channel = NumMedia > 0 ? "mms" : "sms";
        const { data: msg, error: msgErr } = await supa
          .from("sms_messages")
          .insert({
            conversation_id: conversation.id,
            contact_id: contact.id,
            user_id: contact.user_id || ownerId,
            twilio_sid: MessageSid,
            direction: "inbound",
            channel,
            from_number: From,
            to_number: To,
            body: Body,
            media_urls: mediaUrls,
            status: "received",
          })
          .select("id")
          .single();
        if (msgErr) console.log("insert sms_messages error:", msgErr);

        if (msg && mediaUrls.length > 0) {
          for (let i = 0; i < mediaUrls.length; i++) {
            const contentType =
              (form.get(`MediaContentType${i}`) as string) || null;
            await supa.from("sms_message_media").insert({
              message_id: msg.id,
              media_url: mediaUrls[i],
              content_type: contentType,
            });
          }
        }

        await supa
          .from("sms_conversations")
          .update({
            last_message_body: Body.substring(0, 200),
            last_message_at: new Date().toISOString(),
            last_message_direction: "inbound",
            is_unread: true,
            unread_count: (conversation.unread_count || 0) + 1,
            status: "open",
          })
          .eq("id", conversation.id);

        await supa
          .from("sms_contacts")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", contact.id);
      }
    } else {
      console.log("twilio-sms: no contact and no owner; skipped persistence");
    }
  } catch (e) {
    console.log("twilio-sms persistence error:", e);
  }

  // ---------- Push notifications ----------
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
