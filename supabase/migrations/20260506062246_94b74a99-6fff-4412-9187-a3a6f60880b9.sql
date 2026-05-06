
-- AI Caller Scripts
CREATE TABLE public.ai_caller_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  first_message TEXT NOT NULL DEFAULT 'Hi there, how are you today?',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  voice_id TEXT NOT NULL DEFAULT 'sarah',
  voice_provider TEXT NOT NULL DEFAULT 'elevenlabs',
  background_sound TEXT DEFAULT 'office',
  background_sound_enabled BOOLEAN NOT NULL DEFAULT true,
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  max_duration_seconds INTEGER NOT NULL DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_caller_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages ai_caller_scripts"
  ON public.ai_caller_scripts FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

CREATE TRIGGER update_ai_caller_scripts_updated_at
  BEFORE UPDATE ON public.ai_caller_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Caller Campaigns
CREATE TABLE public.ai_caller_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  script_id UUID NOT NULL REFERENCES public.ai_caller_scripts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  calls_completed INTEGER NOT NULL DEFAULT 0,
  calls_answered INTEGER NOT NULL DEFAULT 0,
  leads_generated INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_caller_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages ai_caller_campaigns"
  ON public.ai_caller_campaigns FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

CREATE TRIGGER update_ai_caller_campaigns_updated_at
  BEFORE UPDATE ON public.ai_caller_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Caller Contacts
CREATE TABLE public.ai_caller_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ai_caller_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  call_status TEXT NOT NULL DEFAULT 'pending',
  call_attempts INTEGER NOT NULL DEFAULT 0,
  last_called_at TIMESTAMPTZ,
  vapi_call_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_caller_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages ai_caller_contacts"
  ON public.ai_caller_contacts FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

-- AI Caller Leads (qualified from calls)
CREATE TABLE public.ai_caller_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.ai_caller_campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.ai_caller_contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  transcript_summary TEXT,
  full_transcript TEXT,
  call_duration_seconds INTEGER,
  qualification_score INTEGER,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_caller_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages ai_caller_leads"
  ON public.ai_caller_leads FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

CREATE TRIGGER update_ai_caller_leads_updated_at
  BEFORE UPDATE ON public.ai_caller_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Caller Call Logs
CREATE TABLE public.ai_caller_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.ai_caller_campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.ai_caller_contacts(id) ON DELETE SET NULL,
  vapi_call_id TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  duration_seconds INTEGER,
  cost NUMERIC(10,4),
  transcript TEXT,
  recording_url TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_caller_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages ai_caller_call_logs"
  ON public.ai_caller_call_logs FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));
