
-- 1. Insert Tasks Due stage at position 2 (after Next Call Due)
DO $$
DECLARE
  v_exists uuid;
  v_pos int;
BEGIN
  SELECT id INTO v_exists FROM public.pipeline_stages WHERE name = 'Tasks Due';
  IF v_exists IS NULL THEN
    SELECT position INTO v_pos FROM public.pipeline_stages WHERE name = 'Next Call Due';
    IF v_pos IS NULL THEN v_pos := 1; END IF;
    UPDATE public.pipeline_stages SET position = position + 1 WHERE position > v_pos;
    INSERT INTO public.pipeline_stages (name, position, color)
    VALUES ('Tasks Due', v_pos + 1, '#f59e0b');
  END IF;
END $$;

-- 2. Trigger: auto-move deal to Tasks Due when a task is added
CREATE OR REPLACE FUNCTION public.move_deal_to_tasks_due()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
  v_current_name text;
BEGIN
  SELECT id INTO v_target FROM public.pipeline_stages WHERE name = 'Tasks Due' LIMIT 1;
  IF v_target IS NULL THEN RETURN NEW; END IF;

  SELECT ps.name INTO v_current_name
    FROM public.pipeline_deals pd
    JOIN public.pipeline_stages ps ON ps.id = pd.stage_id
   WHERE pd.id = NEW.deal_id;

  -- Skip closed-out stages
  IF v_current_name IN ('Won','Lost','Settled','Do Not Contact','Tasks Due') THEN
    RETURN NEW;
  END IF;

  UPDATE public.pipeline_deals
     SET stage_id = v_target,
         position = 0,
         updated_at = now()
   WHERE id = NEW.deal_id;

  -- Push others down
  UPDATE public.pipeline_deals
     SET position = COALESCE(position, 0) + 1
   WHERE stage_id = v_target AND id <> NEW.deal_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_tasks_move_to_tasks_due ON public.deal_tasks;
CREATE TRIGGER deal_tasks_move_to_tasks_due
AFTER INSERT ON public.deal_tasks
FOR EACH ROW EXECUTE FUNCTION public.move_deal_to_tasks_due();

-- 3. Trigger: mark sheet_lead_imports.deleted_at when a deal is moved to a terminal/excluded stage
CREATE OR REPLACE FUNCTION public.mark_sheet_lead_excluded_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_stage text;
  d text;
BEGIN
  IF NEW.stage_id IS NULL OR NEW.stage_id = OLD.stage_id THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_new_stage FROM public.pipeline_stages WHERE id = NEW.stage_id;
  IF v_new_stage NOT IN ('Lost','Did Not Answer','Do Not Contact') THEN
    RETURN NEW;
  END IF;
  d := regexp_replace(COALESCE(NEW.client_phone, ''), '\D', '', 'g');
  IF length(d) >= 6 THEN
    UPDATE public.sheet_lead_imports
       SET deleted_at = now()
     WHERE deleted_at IS NULL
       AND (phone_digits = d OR right(phone_digits, 9) = right(d, 9));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pipeline_deals_mark_excluded_on_stage ON public.pipeline_deals;
CREATE TRIGGER pipeline_deals_mark_excluded_on_stage
AFTER UPDATE OF stage_id ON public.pipeline_deals
FOR EACH ROW EXECUTE FUNCTION public.mark_sheet_lead_excluded_on_stage_change();
