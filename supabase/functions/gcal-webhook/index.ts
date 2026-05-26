// Receives Google Calendar push notifications and syncs to bookings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  CORS, json, GCAL_BASE, gcalHeaders,
  formatInTz, brandedEmailHtml, sendGmail, sendAndLogSms, appBaseUrl,
} from "../_shared/booking-utils.ts";
import { fireWorkflowTrigger } from "../_shared/workflow-shared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // Google sends sync pings with no body but with headers.
  const channelId = req.headers.get("x-goog-channel-id");
  const resourceState = req.headers.get("x-goog-resource-state"); // "sync" | "exists" | "not_exists"
  console.log("[gcal-webhook]", { channelId, resourceState });

  if (resourceState === "sync") {
    return new Response("ok", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Fetch incremental changes
    const { data: state } = await supabase.from("gcal_sync_state").select("*").eq("id", 1).single();
    const params = new URLSearchParams();
    if (state?.sync_token) {
      params.set("syncToken", state.sync_token);
    } else {
      // No token; pull recent changes only
      params.set("updatedMin", new Date(Date.now() - 7 * 86400000).toISOString());
      params.set("showDeleted", "true");
    }
    params.set("singleEvents", "true");

    const res = await fetch(`${GCAL_BASE}/calendars/primary/events?${params.toString()}`, {
      headers: gcalHeaders(),
    });
    if (!res.ok) {
      console.warn("[gcal-webhook] fetch failed", res.status, await res.text());
      return json({ ok: false }, 200);
    }
    const data = await res.json() as {
      items?: Array<{ id: string; status?: string; start?: { dateTime?: string }; end?: { dateTime?: string }; summary?: string }>;
      nextSyncToken?: string;
    };

    for (const ev of data.items || []) {
      const { data: booking } = await supabase
        .from("bookings").select("*").eq("google_event_id", ev.id).maybeSingle();
      if (!booking) continue;

      if (ev.status === "cancelled") {
        if (booking.status === "cancelled") continue;
        await supabase.from("bookings").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        }).eq("id", booking.id);

        try {
          const tz = booking.client_timezone;
          const dateStr = formatInTz(new Date(booking.start_at), tz, { weekday: "long", day: "numeric", month: "long" });
          const timeStr = formatInTz(new Date(booking.start_at), tz, { hour: "numeric", minute: "2-digit", hour12: true });
          const html = brandedEmailHtml({
            heading: "Your call has been cancelled",
            intro: "Travis has cancelled your scheduled call. If you would like to book another time, use the link below.",
            details: [
              { label: "Was", value: `${dateStr} at ${timeStr}` },
            ],
            primaryCta: { label: "Book a new time", url: `${appBaseUrl()}/book/travis` },
          });
          await sendGmail(booking.client_email, `Cancelled: your call with Travis`, html);
          if (booking.client_phone) {
            await sendAndLogSms(supabase, {
              to: booking.client_phone,
              body: `Hi ${booking.client_name.split(" ")[0]}, Travis has cancelled your call. Rebook anytime: ${appBaseUrl()}/book/travis`,
              clientName: booking.client_name,
              clientEmail: booking.client_email,
            });
          }
        } catch (e) { console.warn("[gcal-webhook] notify failed", e); }

        await fireWorkflowTrigger("booking_cancelled", {
          client_name: booking.client_name,
          client_email: booking.client_email,
          client_phone: booking.client_phone,
          booking_id: booking.id,
        });
        continue;
      }

      // Time changed?
      const newStart = ev.start?.dateTime ? new Date(ev.start.dateTime).toISOString() : null;
      const newEnd = ev.end?.dateTime ? new Date(ev.end.dateTime).toISOString() : null;
      const oldStart = new Date(booking.start_at).toISOString();
      const oldEnd = new Date(booking.end_at).toISOString();
      if (newStart && newEnd && (newStart !== oldStart || newEnd !== oldEnd)) {
        await supabase.from("bookings").update({
          start_at: newStart, end_at: newEnd,
          status: "rescheduled",
          reminder_24h_sent_at: null, reminder_1h_sent_at: null,
        }).eq("id", booking.id);

        try {
          const tz = booking.client_timezone;
          const startDate = new Date(newStart);
          const dateStr = formatInTz(startDate, tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          const timeStr = formatInTz(startDate, tz, { hour: "numeric", minute: "2-digit", hour12: true });
          const meetingLink = booking.meeting_link || `${appBaseUrl()}/phone`;
          const html = brandedEmailHtml({
            heading: "Your call has been rescheduled",
            intro: "Travis has moved your call to a new time. The new details are below.",
            details: [
              { label: "Date", value: dateStr },
              { label: "Time", value: `${timeStr} (${tz})` },
            ],
            primaryCta: { label: "Join the meeting", url: meetingLink },
            secondaryLinks: [
              { label: "Reschedule", url: `${appBaseUrl()}/reschedule/${booking.reschedule_token}` },
              { label: "Cancel", url: `${appBaseUrl()}/cancel/${booking.cancel_token}` },
            ],
          });
          await sendGmail(booking.client_email, `Rescheduled: ${dateStr} at ${timeStr} with Travis`, html);
          if (booking.client_phone) {
            await sendAndLogSms(supabase, {
              to: booking.client_phone,
              body: `Hi ${booking.client_name.split(" ")[0]}, your call with Travis has been moved to ${dateStr} at ${timeStr} (${tz}). Link: ${meetingLink}`,
              clientName: booking.client_name,
              clientEmail: booking.client_email,
            });
          }
        } catch (e) { console.warn("[gcal-webhook] notify failed", e); }

        await fireWorkflowTrigger("booking_rescheduled", {
          client_name: booking.client_name,
          client_email: booking.client_email,
          client_phone: booking.client_phone,
          booking_id: booking.id,
        });
      }
    }

    if (data.nextSyncToken) {
      await supabase.from("gcal_sync_state").update({
        sync_token: data.nextSyncToken,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("[gcal-webhook] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
