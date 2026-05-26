// Register / refresh a Google Calendar push notification channel.
// POST with no body. Returns the channel info.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { CORS, json, GCAL_BASE, gcalHeaders } from "../_shared/booking-utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const channelId = crypto.randomUUID();
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gcal-webhook`;

    const res = await fetch(`${GCAL_BASE}/calendars/primary/events/watch`, {
      method: "POST",
      headers: gcalHeaders(),
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        // Channels last up to ~7 days for events.
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[gcal-watch-register] failed", res.status, t);
      return json({ error: t, status: res.status }, 500);
    }
    const data = await res.json();
    await supabase.from("gcal_sync_state").upsert({
      id: 1,
      channel_id: data.id,
      resource_id: data.resourceId,
      expires_at: data.expiration ? new Date(Number(data.expiration)).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    return json({ ok: true, channelId: data.id, expires: data.expiration });
  } catch (e) {
    console.error("[gcal-watch-register] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
