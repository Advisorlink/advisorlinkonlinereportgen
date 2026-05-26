
# Booking & Calendar System

A full GoHighLevel-style booking system: clients pick a time from a branded, timezone-aware booking page, get a beautiful confirmation email, the meeting auto-writes to your Google Calendar, and they get reminder email + SMS 24h and 1h before. Reschedule and cancel via branded links.

## Defaults

- **Availability:** Mon–Fri, 10:00 AM – 7:00 PM (your local timezone, AEST)
- **Meeting length:** 45 minutes + 15 min buffer
- **Meeting link:** Your existing in-app screen-share room (not Google Meet)
- **Reminders:** Email + SMS at 24h before, Email + SMS at 1h before
- **Sender:** advisorlinkonline.com.au (already verified)
- **Google account:** Advisor Link calendar (connected via OAuth in next step)

## What You'll See in the App

1. **New "Calendar" page** in the sidebar with three tabs:
   - **Bookings** — list of upcoming/past meetings, status (booked / rescheduled / cancelled / completed)
   - **Availability** — edit your hours, meeting length, buffer, timezone, max bookings per day
   - **Reminder Templates** — edit the email + SMS reminder copy (24h and 1h), with merge fields like `{{client_name}}`, `{{time}}`, `{{reschedule_link}}`

2. **Public booking page** at `/book/travis` (also linkable from your dashboard):
   - Hero with logo, "Book a call with Travis Seckold", brand colours
   - Timezone auto-detected with picker to override
   - Calendar showing only valid days; click a day → time slots in client's timezone
   - Form: name, email, phone, notes
   - Beautiful confirmation screen with the meeting link

3. **Reschedule page** at `/reschedule/{token}` — same calendar UI, prefilled, branded
4. **Cancel page** at `/cancel/{token}` — confirms then frees the slot

## What Happens When a Booking is Made

1. Slot conflict check against existing bookings + Google Calendar busy times
2. Booking saved in DB
3. Event created in your Google Calendar (title, description, attendee = client email)
4. Confirmation email to client (branded, dark/cyan theme, logo, meeting link, add-to-calendar buttons, reschedule/cancel buttons)
5. Confirmation email to you (so you know it's booked)
6. Two reminders scheduled (24h + 1h before) — sent via cron

## Technical Section

**New DB tables**
- `booking_settings` (1 row) — availability JSON, timezone, meeting length, buffer, slug, max/day
- `bookings` — client info, start/end (UTC), client_timezone, status, google_event_id, reschedule_token, cancel_token, reminder_24h_sent_at, reminder_1h_sent_at, notes
- `booking_reminder_templates` — type (`email_24h`, `sms_24h`, `email_1h`, `sms_1h`), subject, body, is_active

**Connector**
- Google Calendar (via `standard_connectors--connect`) — the connection authorises your Advisor Link Google account so events write there.

**Edge functions**
- `booking-availability` (public) — returns free slots for a given date in the client's TZ
- `booking-create` (public) — validates, writes to Google Calendar, saves booking, enqueues confirmation emails
- `booking-reschedule` (public) — moves the booking + updates GCal event
- `booking-cancel` (public) — deletes GCal event, marks cancelled, frees slot
- `booking-reminders-cron` — runs every 5 min, sends due reminders (email via existing send-transactional-email, SMS via existing sms-send)
- Add new email templates: `booking-confirmation-client`, `booking-confirmation-host`, `booking-reminder-24h`, `booking-reminder-1h`, `booking-rescheduled`, `booking-cancelled`

**Cron** — pg_cron to ping `booking-reminders-cron` every 5 minutes.

**Routes**
- `/calendar` (authenticated, in app)
- `/book/:slug` (public)
- `/reschedule/:token` (public)
- `/cancel/:token` (public)

## Order of work

1. Migration: tables + RLS + cron
2. Connect Google Calendar (you'll click through OAuth)
3. Edge functions for availability / create / reschedule / cancel / reminders
4. Email templates (using transactional email infrastructure already set up)
5. Public booking + reschedule + cancel pages (branded)
6. In-app Calendar page (bookings list, availability editor, reminder template editor)
7. Test end-to-end

Once you approve, I'll start with step 1 (database). Step 2 will prompt you to authorise Google.
