import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  CORS, json, GCAL_BASE, gcalHeaders,
  formatInTz, brandedEmailHtml, sendGmail, sendAndLogSms,
  renderTemplate, appBaseUrl, normalizePhone, buildIcs,
} from "../_shared/booking-utils.ts";
import { fireWorkflowTrigger } from "../_shared/workflow-shared.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json();
    const {
      startAt, clientName, clientEmail, clientPhone, clientTimezone, notes,
      slug = "travis", dealId = null, source = "public",
    } = body;
    if (!startAt || !clientName || !clientEmail) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!/^\S+@\S+\.\S+$/.test(clientEmail)) return json({ error: "Invalid email" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: settings } = await supabase
      .from("booking_settings").select("*").eq("slug", slug).single();
    if (!settings) return json({ error: "settings not found" }, 404);

    const start = new Date(startAt);
    const end = new Date(start.getTime() + settings.meeting_duration_minutes * 60000);
    if (isNaN(start.getTime())) return json({ error: "Invalid start" }, 400);
    if (start.getTime() < Date.now()) return json({ error: "Start in the past" }, 400);

    const tz = clientTimezone || settings.timezone;
    const meetingLink = settings.meeting_link || `${appBaseUrl()}/phone`;
    const phoneNorm = normalizePhone(clientPhone);

    // Conflict check
    const { data: clash } = await supabase
      .from("bookings")
      .select("id")
      .in("status", ["booked", "rescheduled"])
      .lt("start_at", end.toISOString())
      .gt("end_at", start.toISOString())
      .limit(1);
    if (clash && clash.length > 0) return json({ error: "Slot no longer available" }, 409);

    // Auto-link to pipeline deal (by email or last 9 digits of phone).
    let linkedDealId: string | null = dealId;
    if (!linkedDealId) {
      const orParts: string[] = [];
      if (clientEmail) orParts.push(`client_email.ilike.${clientEmail}`);
      if (phoneNorm) orParts.push(`client_phone.ilike.%${phoneNorm.slice(-9)}%`);
      if (orParts.length) {
        const { data: deals } = await supabase
          .from("pipeline_deals").select("id").or(orParts.join(",")).limit(1);
        if (deals && deals.length) linkedDealId = deals[0].id;
      }
    }

    // If still no deal, create one so the client shows up in the pipeline
    // with the "presentation booked" milestone.
    if (!linkedDealId) {
      try {
        const { data: firstStage } = await supabase
          .from("pipeline_stages").select("id").order("position", { ascending: true }).limit(1).single();
        if (firstStage?.id) {
          const { data: newDeal } = await supabase
            .from("pipeline_deals").insert({
              stage_id: firstStage.id,
              client_name: clientName,
              client_email: clientEmail,
              client_phone: phoneNorm,
              source: "booking",
              progress_stages: ["presentation_booked"],
            }).select("id").single();
          if (newDeal?.id) linkedDealId = newDeal.id;
        }
      } catch (e) { console.warn("auto-create deal failed", e); }
    }

    // Insert booking
    const { data: booking, error: insErr } = await supabase
      .from("bookings")
      .insert({
        client_name: clientName,
        client_email: clientEmail,
        client_phone: phoneNorm,
        client_timezone: tz,
        notes: notes || null,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        meeting_link: meetingLink,
        contact_id: linkedDealId,
        source,
      })
      .select()
      .single();
    if (insErr || !booking) {
      console.error("insert error", insErr);
      return json({ error: "Failed to save booking" }, 500);
    }

    // Update linked deal: add a note + mark presentation_booked milestone.
    if (linkedDealId) {
      try {
        const dateLabel = formatInTz(start, tz, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
        await supabase.from("pipeline_deal_notes").insert({
          deal_id: linkedDealId,
          content: `Appointment booked for ${dateLabel} (${tz}). Meeting link: ${meetingLink}`,
        });
        const { data: d } = await supabase
          .from("pipeline_deals").select("progress_stages").eq("id", linkedDealId).single();
        const cur: string[] = Array.isArray((d as any)?.progress_stages) ? (d as any).progress_stages : [];
        if (!cur.includes("presentation_booked")) {
          await supabase.from("pipeline_deals")
            .update({ progress_stages: [...cur, "presentation_booked"] })
            .eq("id", linkedDealId);
        }
      } catch (e) { console.warn("deal link failed", e); }
    }

    // Create Google Calendar event (use host timezone so Calendar shows clean times).
    let gcalEventId: string | null = null;
    try {
      const ev = {
        summary: `${settings.meeting_title} with ${clientName}`,
        description: `${settings.meeting_description}\n\nClient: ${clientName}\nEmail: ${clientEmail}\nPhone: ${clientPhone || "n/a"}\n${notes ? `Notes: ${notes}\n` : ""}\nMeeting link: ${meetingLink}\nReschedule: ${appBaseUrl()}/reschedule/${booking.reschedule_token}\nCancel: ${appBaseUrl()}/cancel/${booking.cancel_token}`,
        start: { dateTime: start.toISOString(), timeZone: settings.timezone },
        end: { dateTime: end.toISOString(), timeZone: settings.timezone },
        attendees: [{ email: clientEmail, displayName: clientName }],
      };
      const r = await fetch(`${GCAL_BASE}/calendars/primary/events?sendUpdates=none`, {
        method: "POST", headers: gcalHeaders(), body: JSON.stringify(ev),
      });
      if (r.ok) {
        const data = await r.json();
        gcalEventId = data.id;
        await supabase.from("bookings").update({ google_event_id: gcalEventId }).eq("id", booking.id);
      } else {
        console.warn("GCal create failed", r.status, await r.text());
      }
    } catch (e) {
      console.warn("GCal create error", e);
    }

    // Build vars
    const dateStr = formatInTz(start, tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const timeStr = formatInTz(start, tz, { hour: "numeric", minute: "2-digit", hour12: true });
    const rescheduleLink = `${appBaseUrl()}/reschedule/${booking.reschedule_token}`;
    const cancelLink = `${appBaseUrl()}/cancel/${booking.cancel_token}`;
    const vars: Record<string,string> = {
      client_name: clientName,
      date: dateStr,
      time: timeStr,
      client_timezone: tz,
      meeting_link: meetingLink,
      reschedule_link: rescheduleLink,
      cancel_link: cancelLink,
    };

    // Build ICS for both emails (use host timezone so clients don't see UTC).
    const ics = {
      filename: "advisor-link-booking.ics",
      content: buildIcs({
        uid: `${booking.id}@advisorlinkonline.com.au`,
        start, end,
        tz: settings.timezone,
        summary: `${settings.meeting_title} with ${clientName}`,
        description: `Strategy call with Travis Seckold.\nJoin: ${meetingLink}\nReschedule: ${rescheduleLink}\nCancel: ${cancelLink}`,
        location: meetingLink,
        organizerEmail: settings.host_email || "travis@advisorlinkonline.com.au",
        attendeeEmail: clientEmail,
        attendeeName: clientName,
      }),
    };

    // Confirmation email (client) with .ics attachment.
    try {
      const html = brandedEmailHtml({
        preheader: `You're booked for ${dateStr} at ${timeStr}`,
        heading: `You're booked in, ${clientName.split(" ")[0]}!`,
        intro: `Your ${settings.meeting_duration_minutes}-minute strategy call with Travis is locked in. Add it to your calendar with the attached invite. Full details and your join link are below.`,
        details: [
          { label: "Date", value: dateStr },
          { label: "Time", value: `${timeStr} (${tz})` },
          { label: "With", value: "Travis Seckold" },
          { label: "Duration", value: `${settings.meeting_duration_minutes} minutes` },
        ],
        primaryCta: { label: "Join the meeting", url: meetingLink },
        secondaryLinks: [
          { label: "Reschedule", url: rescheduleLink },
          { label: "Cancel", url: cancelLink },
        ],
        footerNote: "If anything changes, use the reschedule or cancel links above. No need to email back.",
      });
      await sendGmail(clientEmail, `Confirmed: ${dateStr} at ${timeStr} with Travis`, html, ics);
    } catch (e) { console.warn("client email failed", e); }

    // Host notification with .ics.
    try {
      if (settings.host_email) {
        const html = brandedEmailHtml({
          heading: `New booking: ${clientName}`,
          intro: `A new strategy call was just booked through your calendar.`,
          details: [
            { label: "Client", value: `${clientName} (${clientEmail})` },
            { label: "Phone", value: clientPhone || "n/a" },
            { label: "Date", value: dateStr },
            { label: "Time", value: `${timeStr} (${tz})` },
            { label: "Notes", value: notes || "n/a" },
          ],
          primaryCta: { label: "Open Google Calendar", url: "https://calendar.google.com/" },
        });
        await sendGmail(settings.host_email, `New booking: ${clientName} on ${dateStr}`, html, ics);
      }
    } catch (e) { console.warn("host email failed", e); }

    // SMS confirmation (also logged into in-app Messages thread).
    if (booking.client_phone) {
      try {
        const { data: tpl } = await supabase
          .from("booking_reminder_templates")
          .select("body, is_active")
          .eq("kind", "sms_confirmation").maybeSingle();
        if (tpl?.is_active) {
          await sendAndLogSms(supabase, {
            to: booking.client_phone,
            body: renderTemplate(tpl.body, vars),
            clientName,
            clientEmail,
          });
        }
      } catch (e) { console.warn("sms confirmation failed", e); }
    }

    await supabase.from("bookings").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", booking.id);

    return json({
      ok: true,
      booking: {
        id: booking.id,
        start_at: booking.start_at,
        end_at: booking.end_at,
        meeting_link: meetingLink,
        reschedule_token: booking.reschedule_token,
        cancel_token: booking.cancel_token,
        dateStr, timeStr, tz,
      },
    });
  } catch (e) {
    console.error("booking-create error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
