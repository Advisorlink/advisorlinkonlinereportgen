// Shared helpers for booking edge functions.
// Time math, Google Calendar API, and templating.

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export const GCAL_BASE = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export function gcalHeaders() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gcalKey = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!lovableKey || !gcalKey) {
    throw new Error("Google Calendar not configured");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gcalKey,
    "Content-Type": "application/json",
  };
}

/**
 * Get the offset in minutes for a given IANA timezone at a given UTC instant.
 * Positive = ahead of UTC (e.g. Sydney = +600 or +660).
 */
export function tzOffsetMinutes(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const asUTC = Date.UTC(
    +map.year, +map.month - 1, +map.day,
    +map.hour === 24 ? 0 : +map.hour, +map.minute, +map.second,
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** Convert a local date+time in a given IANA tz to a UTC Date. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  // First guess: treat the values as UTC.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = tzOffsetMinutes(tz, guess);
  // The instant we want has local time = (year,month,day,hour,minute) in tz.
  // local = utc + offset → utc = guess - offset
  return new Date(guess.getTime() - offset * 60000);
}

/** Format a UTC instant in a given tz. */
export function formatInTz(date: Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, ...opts }).format(date);
}

/** Get ISO date key (YYYY-MM-DD) for a UTC instant in a given tz. */
export function isoDateInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

export interface AvailabilityWindow { start: string; end: string }
export type WeeklyAvailability = Record<string, AvailabilityWindow[]>;

/**
 * Generate candidate slot start instants (UTC) for a given local date in the host's tz.
 * Honors weekly availability windows, meeting duration + buffer.
 */
export function generateSlotsForDate(
  localDateYmd: string, // YYYY-MM-DD interpreted in host tz
  hostTz: string,
  weekly: WeeklyAvailability,
  meetingMinutes: number,
  bufferMinutes: number,
  slotIntervalMinutes?: number,
): Date[] {
  const [y, m, d] = localDateYmd.split("-").map(Number);
  // Determine day-of-week in host tz (use noon to be safe re: DST edges).
  const noonUtc = zonedToUtc(y, m, d, 12, 0, hostTz);
  const dow = Number(formatInTz(noonUtc, hostTz, { weekday: "short" }) // Mon..
    && new Intl.DateTimeFormat("en-US", { timeZone: hostTz, weekday: "long" }).format(noonUtc));
  // Use a more reliable day index:
  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: hostTz, weekday: "long" }).format(noonUtc);
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dowIdx = days.indexOf(dayName);
  const windows = weekly[String(dowIdx)] || [];
  const step = slotIntervalMinutes ?? (meetingMinutes + bufferMinutes);
  const slots: Date[] = [];
  for (const w of windows) {
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    let cursorMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (cursorMin + meetingMinutes <= endMin) {
      const h = Math.floor(cursorMin / 60);
      const mm = cursorMin % 60;
      slots.push(zonedToUtc(y, m, d, h, mm, hostTz));
      cursorMin += step;
    }
  }
  return slots;
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

export function brandedEmailHtml(opts: {
  preheader?: string;
  heading: string;
  intro: string;
  details: { label: string; value: string }[];
  primaryCta?: { label: string; url: string };
  secondaryLinks?: { label: string; url: string }[];
  footerNote?: string;
}): string {
  const { preheader = "", heading, intro, details, primaryCta, secondaryLinks = [], footerNote } = opts;
  const detailRows = details.map(d => `
    <tr>
      <td style="padding:6px 0;color:#64748b;font:500 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:120px;">${d.label}</td>
      <td style="padding:6px 0;color:#0f172a;font:600 14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${d.value}</td>
    </tr>`).join("");
  const cta = primaryCta ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
      <tr><td style="border-radius:10px;background:linear-gradient(135deg,#06b6d4,#0ea5e9);">
        <a href="${primaryCta.url}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;border-radius:10px;">${primaryCta.label}</a>
      </td></tr>
    </table>` : "";
  const links = secondaryLinks.length ? `
    <p style="margin:18px 0 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;">
      ${secondaryLinks.map(l => `<a href="${l.url}" style="color:#0ea5e9;text-decoration:none;margin-right:14px;">${l.label}</a>`).join("")}
    </p>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title></head>
  <body style="margin:0;padding:0;background:#f1f5f9;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px -4px rgba(15,23,42,0.08);">
          <tr><td style="background:linear-gradient(135deg,#0c1b3d 0%,#0f172a 60%,#082030 100%);padding:32px 32px 28px;text-align:center;">
            <div style="font:700 22px/1.1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;letter-spacing:-0.02em;">Settled & Sound <span style="color:#22d3ee;">Online</span></div>
            <div style="font:500 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;margin-top:6px;letter-spacing:0.06em;text-transform:uppercase;">Travis Seckold</div>
          </td></tr>
          <tr><td style="padding:36px 32px 16px;">
            <h1 style="margin:0 0 12px;font:700 24px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;letter-spacing:-0.01em;">${heading}</h1>
            <p style="margin:0 0 20px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">${intro}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:10px 0;margin:8px 0;">
              ${detailRows}
            </table>
            ${cta}
            ${links}
          </td></tr>
          ${footerNote ? `<tr><td style="padding:16px 32px 28px;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">${footerNote}</td></tr>` : ""}
          <tr><td style="background:#f8fafc;padding:18px 32px;text-align:center;font:400 11px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;border-top:1px solid #e2e8f0;">
            Settled & Sound
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

export function appBaseUrl(): string {
  return Deno.env.get("PUBLIC_APP_URL") || "https://advisorlinkonlinereportgen.lovable.app";
}

export interface IcsAttachment { filename: string; content: string; }

export async function sendGmail(to: string, subject: string, html: string, ics?: IcsAttachment) {
  // Strip em/en dashes and normalize narrow/no-break spaces to regular spaces.
  subject = subject.replace(/[-–]/g, "-").replace(/[\u202F\u00A0\u2009]/g, " ");
  html = html.replace(/[-–]/g, "-").replace(/[\u202F\u00A0\u2009]/g, " ");
  // RFC 2047 encode the subject so non-ASCII chars don't display as mojibake.
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gmailKey = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!lovableKey || !gmailKey) {
    console.warn("Gmail not configured, skipping email to", to);
    return { skipped: true };
  }
  let message: string;
  if (ics) {
    const boundary = `bnd_${crypto.randomUUID().replace(/-/g, "")}`;
    const icsB64 = btoa(unescape(encodeURIComponent(ics.content)));
    message = [
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      html,
      ``,
      `--${boundary}`,
      `Content-Type: text/calendar; method=REQUEST; name="${ics.filename}"`,
      `Content-Disposition: attachment; filename="${ics.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      icsB64.match(/.{1,76}/g)?.join("\r\n") ?? icsB64,
      ``,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    message = [
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset="UTF-8"`,
      ``,
      html,
    ].join("\r\n");
  }
  const raw = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmailKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Gmail send failed:", res.status, err);
    throw new Error(`Gmail send failed: ${res.status}`);
  }
  return await res.json();
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Format a Date as a floating local time string YYYYMMDDTHHMMSS in the given tz (no Z). */
function icsLocalDate(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const m: Record<string,string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  const hh = m.hour === "24" ? "00" : m.hour;
  return `${m.year}${m.month}${m.day}T${hh}${m.minute}${m.second}`;
}

export function buildIcs(opts: {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location?: string;
  organizerEmail?: string;
  attendeeEmail?: string;
  attendeeName?: string;
  status?: "CONFIRMED" | "CANCELLED";
  sequence?: number;
  tz?: string;
}): string {
  const {
    uid, start, end, summary, description, location = "",
    organizerEmail, attendeeEmail, attendeeName,
    status = "CONFIRMED", sequence = 0, tz,
  } = opts;
  // Scrub dashes from human-facing strings.
  const clean = (s: string) => s.replace(/[-–]/g, "-");
  const esc = (s: string) =>
    clean(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const dtStart = tz ? `DTSTART;TZID=${tz}:${icsLocalDate(start, tz)}` : `DTSTART:${icsDate(start)}`;
  const dtEnd   = tz ? `DTEND;TZID=${tz}:${icsLocalDate(end, tz)}`     : `DTEND:${icsDate(end)}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Settled & Sound//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    dtStart,
    dtEnd,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    location ? `LOCATION:${esc(location)}` : "",
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    organizerEmail ? `ORGANIZER;CN=Travis Seckold:mailto:${organizerEmail}` : "",
    attendeeEmail ? `ATTENDEE;CN=${esc(attendeeName ?? attendeeEmail)};RSVP=TRUE:mailto:${attendeeEmail}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

/** Strip em-dashes / en-dashes from any user-facing copy. */
export function stripDashes(s: string): string {
  return s.replace(/[-–]/g, "-");
}

export async function sendSmsViaTwilio(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !tok) {
    console.warn("Twilio not configured, skipping SMS");
    return { skipped: true } as any;
  }
  // Find default sender number
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const numRes = await fetch(`${supabaseUrl}/rest/v1/sms_twilio_numbers?is_default=eq.true&select=phone_number,user_id&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const nums = await numRes.json();
  const from = nums[0]?.phone_number;
  if (!from) {
    console.warn("No default SMS sender configured");
    return { skipped: true } as any;
  }
  const cleanBody = stripDashes(body);
  const params = new URLSearchParams({ To: to, From: from, Body: cleanBody });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${tok}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Twilio SMS failed:", data);
    throw new Error(`Twilio error: ${data.message || res.status}`);
  }
  return { ...data, from, body: cleanBody, ownerUserId: nums[0]?.user_id };
}

/**
 * Send an SMS and also log it into the in-app conversation thread
 * (sms_contacts / sms_conversations / sms_messages) so it appears
 * in the Messages tab alongside other SMS history.
 */
export async function sendAndLogSms(
  supabase: any,
  opts: { to: string; body: string; clientName?: string; clientEmail?: string | null },
) {
  const result = await sendSmsViaTwilio(opts.to, opts.body);
  if ((result as any)?.skipped) return result;
  try {
    const ownerUserId = (result as any).ownerUserId;
    if (!ownerUserId) return result;

    // Find or create the contact (one per phone, scoped to owner).
    let contactId: string | null = null;
    const { data: existing } = await supabase
      .from("sms_contacts").select("id")
      .eq("user_id", ownerUserId).eq("phone", opts.to).maybeSingle();
    if (existing?.id) {
      contactId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("sms_contacts").insert({
          user_id: ownerUserId,
          phone: opts.to,
          full_name: opts.clientName ?? opts.to,
          first_name: opts.clientName?.split(" ")[0] ?? null,
          email: opts.clientEmail ?? null,
          lead_source: "booking",
          opt_in_status: true,
          opt_in_source: "booking",
          opt_in_date: new Date().toISOString(),
        }).select("id").single();
      contactId = created?.id ?? null;
    }
    if (!contactId) return result;

    // Find or create the conversation.
    let convoId: string | null = null;
    const { data: convo } = await supabase
      .from("sms_conversations").select("id")
      .eq("user_id", ownerUserId).eq("contact_id", contactId).maybeSingle();
    if (convo?.id) {
      convoId = convo.id;
    } else {
      const { data: newConvo } = await supabase
        .from("sms_conversations").insert({
          user_id: ownerUserId,
          contact_id: contactId,
          status: "open",
        }).select("id").single();
      convoId = newConvo?.id ?? null;
    }
    if (!convoId) return result;

    const nowIso = new Date().toISOString();
    await supabase.from("sms_messages").insert({
      user_id: ownerUserId,
      conversation_id: convoId,
      contact_id: contactId,
      twilio_sid: (result as any).sid ?? null,
      direction: "outbound",
      channel: "sms",
      from_number: (result as any).from,
      to_number: opts.to,
      body: (result as any).body ?? opts.body,
      status: (result as any).status ?? "sent",
    });
    await supabase.from("sms_conversations").update({
      last_message_at: nowIso,
      last_message_body: (result as any).body ?? opts.body,
      last_message_direction: "outbound",
      updated_at: nowIso,
    }).eq("id", convoId);
    await supabase.from("sms_contacts").update({
      last_message_at: nowIso, updated_at: nowIso,
    }).eq("id", contactId);
  } catch (e) {
    console.warn("sms conversation log failed", e);
  }
  return result;
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let n = String(input).trim().replace(/[\s\-().]/g, "");
  if (n.startsWith("+")) return n;
  if (n.startsWith("00")) return "+" + n.slice(2);
  if (n.startsWith("0")) return "+61" + n.slice(1);
  if (/^4\d{8}$/.test(n)) return "+61" + n;
  if (n.startsWith("61")) return "+" + n;
  return "+" + n;
}
