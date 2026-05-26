import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  CORS, json, formatInTz, brandedEmailHtml, sendGmail, sendAndLogSms,
  renderTemplate, appBaseUrl,
} from "../_shared/booking-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Booking {
  id: string; client_name: string; client_email: string; client_phone: string | null;
  client_timezone: string; start_at: string; meeting_link: string | null;
  reschedule_token: string; cancel_token: string;
  reminder_24h_sent_at: string | null; reminder_1h_sent_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const now = new Date();
  // 24h window: send when 23h–25h until start
  const t24Lo = new Date(now.getTime() + 23 * 3600 * 1000).toISOString();
  const t24Hi = new Date(now.getTime() + 25 * 3600 * 1000).toISOString();
  // 1h window: send when 45min–75min until start
  const t1Lo = new Date(now.getTime() + 45 * 60 * 1000).toISOString();
  const t1Hi = new Date(now.getTime() + 75 * 60 * 1000).toISOString();

  const { data: due24 } = await supabase
    .from("bookings").select("*")
    .in("status", ["booked","rescheduled"])
    .is("reminder_24h_sent_at", null)
    .gte("start_at", t24Lo).lte("start_at", t24Hi);

  const { data: due1 } = await supabase
    .from("bookings").select("*")
    .in("status", ["booked","rescheduled"])
    .is("reminder_1h_sent_at", null)
    .gte("start_at", t1Lo).lte("start_at", t1Hi);

  const { data: templates } = await supabase
    .from("booking_reminder_templates").select("kind, subject, body, is_active");
  const tpl = (kind: string) => templates?.find((t: any) => t.kind === kind);

  let sent = 0;

  async function send(b: Booking, kind: "24h" | "1h") {
    const tz = b.client_timezone;
    const start = new Date(b.start_at);
    const vars: Record<string,string> = {
      client_name: b.client_name,
      date: formatInTz(start, tz, { weekday: "long", day: "numeric", month: "long" }),
      time: formatInTz(start, tz, { hour: "numeric", minute: "2-digit", hour12: true }),
      client_timezone: tz,
      meeting_link: b.meeting_link || `${appBaseUrl()}/phone`,
      reschedule_link: `${appBaseUrl()}/reschedule/${b.reschedule_token}`,
      cancel_link: `${appBaseUrl()}/cancel/${b.cancel_token}`,
    };

    const emailTpl = tpl(`email_${kind}`);
    if (emailTpl?.is_active) {
      try {
        const subject = renderTemplate(emailTpl.subject || `Reminder: your call with Travis`, vars);
        const intro = renderTemplate(emailTpl.body, vars).split("\n\n")[0] || "Quick reminder about your upcoming call.";
        const html = brandedEmailHtml({
          heading: kind === "24h" ? "Your call with Travis is tomorrow" : "Your call starts in 1 hour",
          intro,
          details: [
            { label: "Date", value: vars.date },
            { label: "Time", value: `${vars.time} (${tz})` },
          ],
          primaryCta: { label: "Join the meeting", url: vars.meeting_link },
          secondaryLinks: [
            { label: "Reschedule", url: vars.reschedule_link },
            { label: "Cancel", url: vars.cancel_link },
          ],
        });
        await sendGmail(b.client_email, subject, html);
      } catch (e) { console.warn("email reminder failed", e); }
    }

    const smsTpl = tpl(`sms_${kind}`);
    if (smsTpl?.is_active && b.client_phone) {
      try {
        await sendAndLogSms(supabase, {
          to: b.client_phone,
          body: renderTemplate(smsTpl.body, vars),
          clientName: b.client_name,
          clientEmail: b.client_email,
        });
      } catch (e) { console.warn("sms reminder failed", e); }
    }

    const col = kind === "24h" ? "reminder_24h_sent_at" : "reminder_1h_sent_at";
    await supabase.from("bookings").update({ [col]: new Date().toISOString() }).eq("id", b.id);
    sent++;
  }

  for (const b of (due24 ?? [])) await send(b as Booking, "24h");
  for (const b of (due1 ?? [])) await send(b as Booking, "1h");

  return json({ ok: true, sent, due24: due24?.length || 0, due1: due1?.length || 0 });
});
