import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  CORS, json, GCAL_BASE, gcalHeaders,
  formatInTz, brandedEmailHtml, sendGmail, sendSmsViaTwilio, appBaseUrl,
} from "../_shared/booking-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { token, startAt } = await req.json();
    if (!token || !startAt) return json({ error: "Missing token or startAt" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: booking } = await supabase
      .from("bookings").select("*").eq("reschedule_token", token).single();
    if (!booking) return json({ error: "Not found" }, 404);
    if (booking.status === "cancelled") return json({ error: "Booking is cancelled" }, 400);

    const { data: settings } = await supabase
      .from("booking_settings").select("*").eq("slug","travis").single();
    if (!settings) return json({ error: "settings missing" }, 500);

    const start = new Date(startAt);
    const end = new Date(start.getTime() + settings.meeting_duration_minutes * 60000);
    if (isNaN(start.getTime()) || start.getTime() < Date.now()) return json({ error: "Invalid time" }, 400);

    // conflict check (exclude this booking)
    const { data: clash } = await supabase
      .from("bookings").select("id")
      .in("status", ["booked","rescheduled"])
      .neq("id", booking.id)
      .lt("start_at", end.toISOString())
      .gt("end_at", start.toISOString())
      .limit(1);
    if (clash && clash.length > 0) return json({ error: "Slot taken" }, 409);

    await supabase.from("bookings").update({
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status: "rescheduled",
      reminder_24h_sent_at: null,
      reminder_1h_sent_at: null,
    }).eq("id", booking.id);

    // Update GCal event
    if (booking.google_event_id) {
      try {
        await fetch(`${GCAL_BASE}/calendars/primary/events/${booking.google_event_id}?sendUpdates=none`, {
          method: "PATCH", headers: gcalHeaders(),
          body: JSON.stringify({
            start: { dateTime: start.toISOString(), timeZone: "UTC" },
            end: { dateTime: end.toISOString(), timeZone: "UTC" },
          }),
        });
      } catch (e) { console.warn("gcal patch failed", e); }
    }

    const tz = booking.client_timezone;
    const dateStr = formatInTz(start, tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const timeStr = formatInTz(start, tz, { hour: "numeric", minute: "2-digit", hour12: true });
    const meetingLink = booking.meeting_link || `${appBaseUrl()}/phone`;

    try {
      const html = brandedEmailHtml({
        heading: "Your call has been rescheduled",
        intro: `All set — your call with Travis is now booked for the new time below.`,
        details: [
          { label: "Date", value: dateStr },
          { label: "Time", value: `${timeStr} (${tz})` },
        ],
        primaryCta: { label: "Join the meeting", url: meetingLink },
        secondaryLinks: [
          { label: "Reschedule again", url: `${appBaseUrl()}/reschedule/${booking.reschedule_token}` },
          { label: "Cancel", url: `${appBaseUrl()}/cancel/${booking.cancel_token}` },
        ],
      });
      await sendGmail(booking.client_email, `Rescheduled: ${dateStr} at ${timeStr} with Travis`, html);
    } catch (e) { console.warn("email failed", e); }

    if (booking.client_phone) {
      try {
        await sendSmsViaTwilio(booking.client_phone, `Hi ${booking.client_name.split(" ")[0]}, your call with Travis has been rescheduled to ${dateStr} at ${timeStr} (${tz}). Link: ${meetingLink}`);
      } catch (e) { console.warn("sms failed", e); }
    }

    return json({ ok: true, dateStr, timeStr, tz });
  } catch (e) {
    console.error("reschedule error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
