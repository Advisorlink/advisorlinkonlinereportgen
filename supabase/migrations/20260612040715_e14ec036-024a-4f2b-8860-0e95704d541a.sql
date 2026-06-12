
-- 1. Add tracking columns
ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS did_not_answer_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_to_next_call_at timestamptz;

-- 2. Trigger: when a deal moves INTO "Did Not Answer", schedule its return to "Next Call Due"
CREATE OR REPLACE FUNCTION public.schedule_dna_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dna_id uuid;
  v_delay_hours int;
BEGIN
  SELECT id INTO v_dna_id FROM public.pipeline_stages WHERE name = 'Did Not Answer' LIMIT 1;
  IF v_dna_id IS NULL THEN RETURN NEW; END IF;

  -- Only when stage actually changes INTO Did Not Answer
  IF NEW.stage_id = v_dna_id AND (OLD.stage_id IS DISTINCT FROM v_dna_id) THEN
    NEW.did_not_answer_count := COALESCE(OLD.did_not_answer_count, 0) + 1;
    -- 1st time => 3h, 2nd => 5h, 3rd => 7h, ...
    v_delay_hours := 1 + (2 * NEW.did_not_answer_count);
    NEW.return_to_next_call_at := now() + make_interval(hours => v_delay_hours);
  ELSIF NEW.stage_id IS DISTINCT FROM v_dna_id AND OLD.stage_id = v_dna_id THEN
    -- Manually moved out of DNA: clear the scheduled return
    NEW.return_to_next_call_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_dna_return ON public.pipeline_deals;
CREATE TRIGGER trg_schedule_dna_return
  BEFORE UPDATE OF stage_id ON public.pipeline_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_dna_return();

-- 3. Function the cron will invoke: move any due DNA deals back to Next Call Due
CREATE OR REPLACE FUNCTION public.process_dna_returns()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dna_id uuid;
  v_ncd_id uuid;
  v_count int;
BEGIN
  SELECT id INTO v_dna_id FROM public.pipeline_stages WHERE name = 'Did Not Answer' LIMIT 1;
  SELECT id INTO v_ncd_id FROM public.pipeline_stages WHERE name = 'Next Call Due' LIMIT 1;
  IF v_dna_id IS NULL OR v_ncd_id IS NULL THEN RETURN 0; END IF;

  WITH moved AS (
    UPDATE public.pipeline_deals
       SET stage_id = v_ncd_id,
           position = 0,
           return_to_next_call_at = NULL,
           updated_at = now()
     WHERE stage_id = v_dna_id
       AND return_to_next_call_at IS NOT NULL
       AND return_to_next_call_at <= now()
     RETURNING id
  )
  SELECT count(*) INTO v_count FROM moved;

  -- Push other deals down in Next Call Due so the returnees appear on top
  IF v_count > 0 THEN
    UPDATE public.pipeline_deals
       SET position = COALESCE(position, 0) + v_count
     WHERE stage_id = v_ncd_id
       AND (return_to_next_call_at IS NULL OR return_to_next_call_at > now());
  END IF;

  RETURN v_count;
END;
$$;

-- 4. Schedule the cron every 5 minutes
SELECT cron.unschedule('pipeline-dna-returns') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'pipeline-dna-returns'
);

SELECT cron.schedule(
  'pipeline-dna-returns',
  '*/5 * * * *',
  $$ SELECT public.process_dna_returns(); $$
);
