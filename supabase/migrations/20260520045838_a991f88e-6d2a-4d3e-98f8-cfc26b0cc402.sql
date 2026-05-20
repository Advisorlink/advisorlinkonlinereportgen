ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS report_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_email_sent_at timestamptz;

-- Backfill the new "report email" column from the existing email_sent_at
UPDATE public.reports
  SET report_email_sent_at = email_sent_at
  WHERE report_email_sent_at IS NULL
    AND email_sent_at IS NOT NULL;