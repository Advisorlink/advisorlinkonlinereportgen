import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  CORS, json, brandedEmailHtml, sendGmail, sendSmsViaTwilio,
  renderTemplate, normalizePhone, appBaseUrl,
} from "../_shared/booking-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { kind, email, phone } = await req.json();
    if (!kind) return json({ error: "Missing kind" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: settings } = await supabase.from("booking_settings").select("*").eq("slug", "travis").single();
    const { data: tpl } = await supabase.from("booking_reminder_templates").select("*").eq("kind", kind).single();
    if (!tpl) return json({ error: `Template "${kind}" not found` }, 404);

    const tz = settings?.timezone ?? "Australia/Sydney";
    const sampleStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(sampleStart);
    const timeStr = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(sampleStart);
    const base = appBaseUrl();

    const vars = {
      client_name: "Travis (test)",
      date: dateStr,
      time: timeStr,
      client_timezone: tz,
      meeting_link: settings?.meeting_link ?? `${base}/meeting/test`,
      reschedule_link: `${base}/reschedule/test-token`,
      cancel_link: `${base}/cancel/test-token`,
    };
    const bodyText = renderTemplate(tpl.body ?? "", vars);
    const subject = renderTemplate(tpl.subject ?? "Test reminder", vars);

    const results: Record<string, unknown> = {};

    if (kind.startsWith("email")) {
      const to = email || settings?.host_email;
      if (!to) return json({ error: "No email address" }, 400);
      const html = brandedEmailHtml({
        preheader: "Test reminder from Advisor Link Online",
        heading: subject,
        intro: bodyText.split("\n")[0] || "This is a test reminder so you can preview what clients receive.",
        details: [
          { label: "Date", value: dateStr },
          { label: "Time", value: `${timeStr} (${tz})` },
          { label: "With", value: settings?.host_name ?? "Travis Seckold" },
        ],
        primaryCta: { label: "Join the meeting", url: vars.meeting_link },
        secondaryLinks: [
          { label: "Reschedule", url: vars.reschedule_link },
          { label: "Cancel", url: vars.cancel_link },
        ],
        footerNote: "TEST — no real booking was created.",
      });
      results.email = await sendGmail(to, `[TEST] ${subject}`, html);
      results.email_to = to;
    } else if (kind.startsWith("sms")) {
      const raw = phone || settings?.host_phone;
      const to = normalizePhone(raw);
      if (!to) return json({ error: "No phone number" }, 400);
      results.sms = await sendSmsViaTwilio(to, `[TEST] ${bodyText}`);
      results.sms_to = to;
    } else {
      return json({ error: "Unknown kind" }, 400);
    }

    return json({ ok: true, ...results });
  } catch (e) {
    console.error("test reminder error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
