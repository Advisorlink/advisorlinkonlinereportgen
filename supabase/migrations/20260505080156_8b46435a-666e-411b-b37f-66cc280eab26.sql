
-- Referral submissions (one per client who fills out the 7-name form)
CREATE TABLE public.referral_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  referrals JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create referral submissions"
  ON public.referral_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Owner reads all referral submissions"
  ON public.referral_submissions FOR SELECT
  USING (public.is_owner(auth.uid()));

-- Individual referral leads
CREATE TABLE public.referral_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES public.referral_submissions(id) ON DELETE CASCADE,
  referrer_name TEXT NOT NULL,
  referrer_email TEXT NOT NULL,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  email_sent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create referral leads"
  ON public.referral_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read leads by token"
  ON public.referral_leads FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Owner reads all referral leads"
  ON public.referral_leads FOR SELECT
  USING (public.is_owner(auth.uid()));

CREATE POLICY "Owner updates referral leads"
  ON public.referral_leads FOR UPDATE
  USING (public.is_owner(auth.uid()));

-- Referral responses (when the referred person fills out the super form)
CREATE TABLE public.referral_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.referral_leads(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  super_fund_name TEXT,
  super_balance TEXT,
  age TEXT,
  state TEXT,
  had_review_before BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create referral responses"
  ON public.referral_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Owner reads all referral responses"
  ON public.referral_responses FOR SELECT
  USING (public.is_owner(auth.uid()));
