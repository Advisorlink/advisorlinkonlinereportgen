ALTER TABLE public.ai_caller_campaigns
ADD COLUMN IF NOT EXISTS max_concurrent_calls integer NOT NULL DEFAULT 1;

ALTER TABLE public.ai_caller_campaigns
ADD CONSTRAINT ai_caller_campaigns_max_concurrent_calls_check
CHECK (max_concurrent_calls >= 1 AND max_concurrent_calls <= 50);

ALTER TABLE public.ai_caller_campaigns
ADD CONSTRAINT ai_caller_campaigns_calls_per_hour_check
CHECK (calls_per_hour >= 1 AND calls_per_hour <= 1000);