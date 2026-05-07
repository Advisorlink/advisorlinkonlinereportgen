import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string;
    const errorMessage = formData.get("ErrorMessage") as string;

    if (!messageSid || !messageStatus) {
      return new Response("Missing required fields", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const updateData: Record<string, unknown> = { status: messageStatus };

    if (messageStatus === "delivered") {
      updateData.delivered_at = new Date().toISOString();
    } else if (["failed", "undelivered"].includes(messageStatus)) {
      updateData.failed_at = new Date().toISOString();
      if (errorCode) updateData.error_code = errorCode;
      if (errorMessage) updateData.error_message = errorMessage;
    }

    // Update message by Twilio SID
    await supabase.from("sms_messages").update(updateData).eq("twilio_sid", messageSid);

    // Also update campaign recipient if applicable
    const { data: msg } = await supabase.from("sms_messages").select("campaign_id").eq("twilio_sid", messageSid).single();
    if (msg?.campaign_id) {
      await supabase.from("sms_campaign_recipients").update({
        status: messageStatus,
        ...(messageStatus === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
        ...(["failed", "undelivered"].includes(messageStatus) ? { error_message: errorMessage } : {}),
      }).eq("twilio_sid", messageSid);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("sms-status-callback error:", err);
    return new Response("Error", { status: 500 });
  }
});
