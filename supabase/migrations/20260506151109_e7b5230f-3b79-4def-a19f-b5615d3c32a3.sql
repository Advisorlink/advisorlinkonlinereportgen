
ALTER TABLE public.ai_caller_scripts
ADD COLUMN call_direction text NOT NULL DEFAULT 'outbound';
