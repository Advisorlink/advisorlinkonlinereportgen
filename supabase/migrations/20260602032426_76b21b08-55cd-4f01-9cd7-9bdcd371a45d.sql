
-- Config (single row)
CREATE TABLE public.sheet_lead_sync_config (
  id integer PRIMARY KEY DEFAULT 1,
  spreadsheet_id text NOT NULL,
  sheet_name text NOT NULL DEFAULT 'LIVE',
  header_row integer NOT NULL DEFAULT 1,
  target_stage_name text NOT NULL DEFAULT 'New Lead',
  source_tag text NOT NULL DEFAULT 'BNL',
  source_label text NOT NULL DEFAULT 'BNL Marketing',
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_imported_count integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT only_one_row CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.sheet_lead_sync_config TO authenticated;
GRANT ALL ON public.sheet_lead_sync_config TO service_role;

ALTER TABLE public.sheet_lead_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages sheet sync config" ON public.sheet_lead_sync_config
  FOR ALL TO authenticated
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

INSERT INTO public.sheet_lead_sync_config (id, spreadsheet_id, sheet_name)
VALUES (1, '1NCWzSfocqP0jp_ag7GvLWlw-cONWTNHb6FVr9Wes868', 'LIVE')
ON CONFLICT (id) DO NOTHING;

-- Tracking of already-imported rows
CREATE TABLE public.sheet_lead_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id text NOT NULL,
  sheet_name text NOT NULL,
  phone_digits text NOT NULL,
  client_name text,
  deal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spreadsheet_id, sheet_name, phone_digits)
);

GRANT SELECT ON public.sheet_lead_imports TO authenticated;
GRANT ALL ON public.sheet_lead_imports TO service_role;

ALTER TABLE public.sheet_lead_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads sheet imports" ON public.sheet_lead_imports
  FOR SELECT TO authenticated USING (is_owner(auth.uid()));

-- pg_cron job to invoke the edge function every 5 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('gsheet-leads-sync-every-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'gsheet-leads-sync-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://osqreiyssdhpplxtcxdv.supabase.co/functions/v1/gsheet-leads-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcXJlaXlzc2RocHBseHRjeGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDM1MzcsImV4cCI6MjA5Mjk3OTUzN30.XteIDJg3AkIIZwTCBvUdrxQGgcD4463UgRqZoklGmYk'
    ),
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
