
DO $$
DECLARE
  v_stage uuid;
BEGIN
  SELECT id INTO v_stage FROM public.pipeline_stages WHERE name = 'New Leads';

  -- Shift all existing deals in New Leads down by 3
  UPDATE public.pipeline_deals
  SET position = position + 3
  WHERE stage_id = v_stage
    AND client_name NOT IN ('Peter Bukowski','ANDREW BAKER','Bradley Nannup');

  -- Put the three new leads at the top (Peter=0, Andrew=1, Bradley=2)
  UPDATE public.pipeline_deals SET position = 0 WHERE stage_id = v_stage AND client_name = 'Peter Bukowski';
  UPDATE public.pipeline_deals SET position = 1 WHERE stage_id = v_stage AND client_name = 'ANDREW BAKER';
  UPDATE public.pipeline_deals SET position = 2 WHERE stage_id = v_stage AND client_name = 'Bradley Nannup';
END $$;
