ALTER TABLE public.sms_twilio_numbers
ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'twilio';