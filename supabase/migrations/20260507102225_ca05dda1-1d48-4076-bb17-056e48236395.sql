
-- SMS Contacts
CREATE TABLE public.sms_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  lead_source TEXT,
  lead_status TEXT DEFAULT 'new',
  assigned_user_id UUID,
  tags TEXT[] DEFAULT '{}',
  opt_in_status BOOLEAN DEFAULT true,
  opt_in_source TEXT,
  opt_in_date TIMESTAMPTZ,
  opt_out_status BOOLEAN DEFAULT false,
  opt_out_date TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  notes TEXT,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages sms_contacts" ON public.sms_contacts FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE INDEX idx_sms_contacts_phone ON public.sms_contacts(phone);
CREATE INDEX idx_sms_contacts_user ON public.sms_contacts(user_id);

-- SMS Conversations
CREATE TABLE public.sms_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.sms_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  is_unread BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,
  last_message_body TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_direction TEXT,
  assigned_user_id UUID,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages sms_conversations" ON public.sms_conversations FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE INDEX idx_sms_conversations_contact ON public.sms_conversations(contact_id);
CREATE INDEX idx_sms_conversations_status ON public.sms_conversations(status);

-- SMS Messages
CREATE TABLE public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.sms_conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.sms_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  twilio_sid TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'mms')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT,
  media_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_message TEXT,
  sent_by_user_id UUID,
  automation_id UUID,
  campaign_id UUID,
  segment_count INTEGER DEFAULT 1,
  cost NUMERIC,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages sms_messages" ON public.sms_messages FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
-- Allow webhook inserts (anon role for Twilio callbacks)
CREATE POLICY "Webhook inserts messages" ON public.sms_messages FOR INSERT TO anon WITH CHECK (true);
CREATE INDEX idx_sms_messages_conversation ON public.sms_messages(conversation_id);
CREATE INDEX idx_sms_messages_contact ON public.sms_messages(contact_id);
CREATE INDEX idx_sms_messages_twilio_sid ON public.sms_messages(twilio_sid);
CREATE INDEX idx_sms_messages_created ON public.sms_messages(created_at DESC);

-- SMS Message Media
CREATE TABLE public.sms_message_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.sms_messages(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_message_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages sms_message_media" ON public.sms_message_media FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "Webhook inserts media" ON public.sms_message_media FOR INSERT TO anon WITH CHECK (true);

-- SMS Templates
CREATE TABLE public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  body TEXT NOT NULL,
  merge_fields TEXT[] DEFAULT '{}',
  compliance_footer TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages sms_templates" ON public.sms_templates FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));

-- SMS Campaigns
CREATE TABLE public.sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  message_body TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  recipient_filter JSONB DEFAULT '{}',
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  opt_out_count INTEGER DEFAULT 0,
  estimated_cost NUMERIC DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages sms_campaigns" ON public.sms_campaigns FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));

-- SMS Campaign Recipients
CREATE TABLE public.sms_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.sms_contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  twilio_sid TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages campaign_recipients" ON public.sms_campaign_recipients FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));

-- Opt In/Out Records (audit trail)
CREATE TABLE public.sms_opt_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.sms_contacts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opt_in', 'opt_out')),
  method TEXT NOT NULL DEFAULT 'keyword',
  keyword TEXT,
  source TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_opt_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages opt_records" ON public.sms_opt_records FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "Webhook inserts opt_records" ON public.sms_opt_records FOR INSERT TO anon WITH CHECK (true);

-- Internal Notes on conversations
CREATE TABLE public.sms_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.sms_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages internal_notes" ON public.sms_internal_notes FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));

-- Twilio Numbers
CREATE TABLE public.sms_twilio_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  friendly_name TEXT,
  sms_enabled BOOLEAN DEFAULT true,
  mms_enabled BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  twilio_sid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_twilio_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages twilio_numbers" ON public.sms_twilio_numbers FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));

-- Enable realtime on messages and conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_conversations;

-- Update triggers
CREATE TRIGGER update_sms_contacts_updated_at BEFORE UPDATE ON public.sms_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_conversations_updated_at BEFORE UPDATE ON public.sms_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_messages_updated_at BEFORE UPDATE ON public.sms_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON public.sms_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_campaigns_updated_at BEFORE UPDATE ON public.sms_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
