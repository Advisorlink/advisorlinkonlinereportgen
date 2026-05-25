
CREATE TABLE IF NOT EXISTS public.twilio_voice_config (
  id integer PRIMARY KEY DEFAULT 1,
  api_key_sid text,
  api_key_secret text,
  twiml_app_sid text,
  caller_id text,
  client_identity text NOT NULL DEFAULT 'crm_user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO public.twilio_voice_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.twilio_voice_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages voice config"
  ON public.twilio_voice_config FOR ALL
  USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));

CREATE TRIGGER twilio_voice_config_updated_at
  BEFORE UPDATE ON public.twilio_voice_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Call log for the softphone (separate from AI caller logs)
CREATE TABLE IF NOT EXISTS public.voice_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  call_sid text UNIQUE,
  direction text NOT NULL,
  from_number text,
  to_number text,
  status text NOT NULL DEFAULT 'initiated',
  contact_name text,
  contact_id uuid,
  deal_id uuid,
  duration_seconds integer,
  recording_url text,
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages voice call logs"
  ON public.voice_call_logs FOR ALL
  USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));

CREATE INDEX IF NOT EXISTS voice_call_logs_started_at_idx ON public.voice_call_logs (started_at DESC);
