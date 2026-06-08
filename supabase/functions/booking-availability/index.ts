import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  CORS, json, GCAL_BASE, gcalHeaders,
  generateSlotsForDate, formatInTz, isoDateInTz,
} from "../_shared/booking-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const fromDate = url.searchParams.get("from"); // YYYY-MM-DD (host tz)
    const days = Math.min(Number(url.searchParams.get("days") || 14), 60);
    const clientTz = url.searchParams.get("tz") || "Australia/Sydney";
    const slug = url.searchParams.get("slug") || "travis";
    if (!fromDate) return json({ error: "from required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: settings } = await supabase
      .from("booking_settings")
      .select("*")
      .eq("slug", slug)
      .single();
    if (!settings) return json({ error: "settings not found" }, 404);

    const hostTz = settings.timezone;
    const meetingMin = settings.meeting_duration_minutes;
    const bufferMin = settings.buffer_minutes;
    const minNoticeMs = settings.min_notice_hours * 3600 * 1000;
    const now = new Date();
    const minStart = new Date(now.getTime() + minNoticeMs);

    // Collect candidate slots across the date range
    const [fy, fm, fd] = fromDate.split("-").map(Number);
    const dayList: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.UTC(fy, fm - 1, fd + i));
      const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
      dayList.push(ymd);
    }
    const allSlots: Date[] = [];
    const slotIntervalMin = settings.slot_interval_minutes ?? 30;
    for (const ymd of dayList) {
      const slots = generateSlotsForDate(ymd, hostTz, settings.weekly_availability, meetingMin, bufferMin, slotIntervalMin);
      for (const s of slots) {
        if (s.getTime() >= minStart.getTime()) allSlots.push(s);
      }
    }
    if (allSlots.length === 0) return json({ slots: {}, hostTz, clientTz });

    const rangeStart = allSlots[0].toISOString();
    const rangeEnd = new Date(allSlots[allSlots.length - 1].getTime() + meetingMin * 60000).toISOString();

    // Existing DB bookings
    const { data: existing } = await supabase
      .from("bookings")
      .select("start_at, end_at")
      .in("status", ["booked", "rescheduled"])
      .gte("end_at", rangeStart)
      .lte("start_at", rangeEnd);

    // GCal busy windows
    let gcalBusy: { start: string; end: string }[] = [];
    try {
      const r = await fetch(`${GCAL_BASE}/freeBusy`, {
        method: "POST",
        headers: gcalHeaders(),
        body: JSON.stringify({
          timeMin: rangeStart,
          timeMax: rangeEnd,
          items: [{ id: "primary" }],
          timeZone: hostTz,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        gcalBusy = data.calendars?.primary?.busy ?? [];
      } else {
        console.warn("freeBusy failed", r.status, await r.text());
      }
    } catch (e) {
      console.warn("freeBusy error", e);
    }

    function isBusy(slotStart: Date): boolean {
      const slotEnd = new Date(slotStart.getTime() + meetingMin * 60000);
      // buffer overlap check: anything overlapping [slotStart - buffer, slotEnd + buffer]
      const guardStart = slotStart.getTime() - bufferMin * 60000;
      const guardEnd = slotEnd.getTime() + bufferMin * 60000;
      for (const b of existing ?? []) {
        const bs = new Date(b.start_at).getTime();
        const be = new Date(b.end_at).getTime();
        if (bs < guardEnd && be > guardStart) return true;
      }
      for (const b of gcalBusy) {
        const bs = new Date(b.start).getTime();
        const be = new Date(b.end).getTime();
        if (bs < guardEnd && be > guardStart) return true;
      }
      return false;
    }

    // Per-day cap
    const perDayCount = new Map<string, number>();
    for (const b of existing ?? []) {
      const k = isoDateInTz(new Date(b.start_at), hostTz);
      perDayCount.set(k, (perDayCount.get(k) || 0) + 1);
    }

    // Group output by date in client tz
    const out: Record<string, string[]> = {};
    for (const s of allSlots) {
      if (isBusy(s)) continue;
      const dayKeyHost = isoDateInTz(s, hostTz);
      if ((perDayCount.get(dayKeyHost) || 0) >= settings.max_per_day) continue;
      const clientDayKey = isoDateInTz(s, clientTz);
      (out[clientDayKey] ||= []).push(s.toISOString());
    }

    return json({
      slots: out,
      hostTz,
      clientTz,
      settings: {
        host_name: settings.host_name,
        host_title: settings.host_title,
        meeting_title: settings.meeting_title,
        meeting_description: settings.meeting_description,
        meeting_duration_minutes: meetingMin,
      },
    });
  } catch (e) {
    console.error("availability error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
