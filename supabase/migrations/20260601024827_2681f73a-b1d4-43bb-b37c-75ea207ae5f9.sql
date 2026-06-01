-- Pacing settings for AI caller campaigns
ALTER TABLE public.ai_caller_campaigns
  ADD COLUMN IF NOT EXISTS calls_per_hour int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS min_gap_seconds int NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS daily_start_time time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS daily_end_time time NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS active_days int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Australia/Sydney',
  ADD COLUMN IF NOT EXISTS last_call_finished_at timestamptz;

-- Enable cron + http extensions (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the paced campaign ticker every minute
DO $$
BEGIN
  PERFORM cron.unschedule('vapi-campaign-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'vapi-campaign-tick',
  '* * * * *',
  $$ SELECT net.http_post(
       url:='https://osqreiyssdhpplxtcxdv.supabase.co/functions/v1/vapi-campaign-tick',
       headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcXJlaXlzc2RocHBseHRjeGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDM1MzcsImV4cCI6MjA5Mjk3OTUzN30.XteIDJg3AkIIZwTCBvUdrxQGgcD4463UgRqZoklGmYk"}'::jsonb,
       body:='{}'::jsonb
     ); $$
);