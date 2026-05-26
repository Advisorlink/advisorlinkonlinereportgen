import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  CORS, json, GCAL_BASE, gcalHeaders,
  formatInTz, brandedEmailHtml, sendGmail, sendSmsViaTwilio,
} from "../_shared/booking-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { token, reason } = await req.json();
    if (!token) return json({ error: "Missing token" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: booking } = await supabase
      .from("bookings").select("*").eq("cancel_token", token).single();
    if (!booking) return json({ error: "Not found" }, 404);
    if (booking.status === "cancelled") return json({ ok: true, alreadyCancelled: true });

    await supabase.from("bookings").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      notes: reason ? `${booking.notes ?? ""}\n[Cancelled] ${reason}` : booking.notes,
    }).eq("id", booking.id);

    if (booking.google_event_id) {
      try {
        await fetch(`${GCAL_BASE}/calendars/primary/events/${booking.google_event_id}?sendUpdates=none`, {
          method: "DELETE", headers: gcalHeaders(),
        });
      } catch (e) { console.warn("gcal delete failed", e); }
    }

    const tz = booking.client_timezone;
    const dateStr = formatInTz(new Date(booking.start_at), tz, { weekday: "long", day: "numeric", month: "long" });
    const timeStr = formatInTz(new Date(booking.start_at), tz, { hour: "numeric", minute: "2-digit", hour12: true });

    try {
      const html = brandedEmailHtml({
        heading: "Your call has been cancelled",
        intro: `We've cancelled your call with Travis. If this wasn't intentional, just reply and we'll get you rebooked.`,
        details: [
          { label: "Was scheduled", value: `${dateStr}, ${timeStr} (${tz})` },
        ],
      });
      await sendGmail(booking.client_email, `Cancelled: your call with Travis`, html);
    } catch (e) { console.warn("email failed", e); }

    if (booking.client_phone) {
      try {
        await sendSmsViaTwilio(booking.client_phone, `Your call with Travis on ${dateStr} at ${timeStr} has been cancelled. Reply if you'd like to rebook.`);
      } catch (e) { console.warn("sms failed", e); }
    }

    return json({ ok: true });
  } catch (e) {
    console.error("cancel error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
