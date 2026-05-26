
-- booking_settings: single-row owner config
CREATE TABLE public.booking_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  slug TEXT NOT NULL UNIQUE DEFAULT 'travis',
  host_name TEXT NOT NULL DEFAULT 'Travis Seckold',
  host_title TEXT DEFAULT 'Advisor Link Online',
  host_email TEXT,
  timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  meeting_duration_minutes INTEGER NOT NULL DEFAULT 45,
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  min_notice_hours INTEGER NOT NULL DEFAULT 2,
  max_days_ahead INTEGER NOT NULL DEFAULT 30,
  max_per_day INTEGER NOT NULL DEFAULT 8,
  -- availability: object keyed by 0..6 (Sun..Sat) → [{ start: "10:00", end: "19:00" }]
  weekly_availability JSONB NOT NULL DEFAULT '{
    "0": [],
    "1": [{"start":"10:00","end":"19:00"}],
    "2": [{"start":"10:00","end":"19:00"}],
    "3": [{"start":"10:00","end":"19:00"}],
    "4": [{"start":"10:00","end":"19:00"}],
    "5": [{"start":"10:00","end":"19:00"}],
    "6": []
  }'::jsonb,
  meeting_link TEXT,
  meeting_title TEXT NOT NULL DEFAULT '45 Min Strategy Call with Travis',
  meeting_description TEXT DEFAULT 'A focused 45-minute call to review your super and walk you through your personalised strategy.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read booking_settings"
  ON public.booking_settings FOR SELECT
  USING (true);

CREATE POLICY "Owner manages booking_settings"
  ON public.booking_settings FOR ALL
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

INSERT INTO public.booking_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  client_timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  notes TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','rescheduled','cancelled','completed','no_show')),
  google_event_id TEXT,
  meeting_link TEXT,
  reschedule_token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  cancel_token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_1h_sent_at TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  source TEXT DEFAULT 'public',
  contact_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_start_at ON public.bookings (start_at);
CREATE INDEX idx_bookings_status ON public.bookings (status);
CREATE INDEX idx_bookings_reminder_24 ON public.bookings (start_at) WHERE status = 'booked' AND reminder_24h_sent_at IS NULL;
CREATE INDEX idx_bookings_reminder_1 ON public.bookings (start_at) WHERE status = 'booked' AND reminder_1h_sent_at IS NULL;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages bookings"
  ON public.bookings FOR ALL
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- Public lookup by token (used by reschedule/cancel pages)
CREATE OR REPLACE FUNCTION public.get_booking_by_token(_token TEXT)
RETURNS TABLE (
  id UUID, client_name TEXT, client_email TEXT, client_phone TEXT,
  client_timezone TEXT, notes TEXT, start_at TIMESTAMPTZ, end_at TIMESTAMPTZ,
  status TEXT, meeting_link TEXT, token_kind TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, client_name, client_email, client_phone, client_timezone, notes,
         start_at, end_at, status, meeting_link,
         CASE WHEN reschedule_token = _token THEN 'reschedule' ELSE 'cancel' END
    FROM public.bookings
    WHERE reschedule_token = _token OR cancel_token = _token
    LIMIT 1;
$$;

-- Reminder templates
CREATE TABLE public.booking_reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL UNIQUE CHECK (kind IN ('email_24h','sms_24h','email_1h','sms_1h','email_confirmation','sms_confirmation')),
  subject TEXT,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_reminder_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages reminder templates"
  ON public.booking_reminder_templates FOR ALL
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- Seed default templates
INSERT INTO public.booking_reminder_templates (kind, subject, body) VALUES
('email_confirmation', 'Your call with Travis is booked for {{date}}',
'Hi {{client_name}},

Your strategy call is locked in for {{date}} at {{time}} ({{client_timezone}}).

Meeting link: {{meeting_link}}

Need to reschedule? {{reschedule_link}}
Need to cancel? {{cancel_link}}

Talk soon,
Travis | Advisor Link Online'),
('sms_confirmation', NULL,
'Hi {{client_name}}, your call with Travis is booked for {{date}} at {{time}} ({{client_timezone}}). Link: {{meeting_link}} — Reschedule: {{reschedule_link}}'),
('email_24h', 'Reminder: your call with Travis tomorrow at {{time}}',
'Hi {{client_name}},

Just a quick reminder you have a call with Travis tomorrow at {{time}} ({{client_timezone}}).

Meeting link: {{meeting_link}}
Reschedule: {{reschedule_link}}
Cancel: {{cancel_link}}

See you then!
Advisor Link Online'),
('sms_24h', NULL,
'Hi {{client_name}}, reminder: your call with Travis is tomorrow at {{time}} ({{client_timezone}}). Link: {{meeting_link}}'),
('email_1h', 'Starting in 1 hour: your call with Travis',
'Hi {{client_name}},

Your call with Travis starts in 1 hour ({{time}} {{client_timezone}}).

Jump in here: {{meeting_link}}

See you soon,
Advisor Link Online'),
('sms_1h', NULL,
'Hi {{client_name}}, your call with Travis starts in 1 hour. Join: {{meeting_link}}');

-- Updated-at trigger
CREATE TRIGGER trg_booking_settings_updated_at
  BEFORE UPDATE ON public.booking_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_booking_reminder_templates_updated_at
  BEFORE UPDATE ON public.booking_reminder_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
