
ALTER TABLE public.sheet_lead_imports
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS sheet_lead_imports_phone_idx
  ON public.sheet_lead_imports(phone_digits);

CREATE OR REPLACE FUNCTION public.mark_sheet_lead_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d text;
BEGIN
  d := regexp_replace(COALESCE(OLD.client_phone, ''), '\D', '', 'g');
  IF length(d) >= 6 THEN
    UPDATE public.sheet_lead_imports
       SET deleted_at = now()
     WHERE phone_digits = d
        OR right(phone_digits, 9) = right(d, 9);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS pipeline_deals_mark_sheet_deleted ON public.pipeline_deals;
CREATE TRIGGER pipeline_deals_mark_sheet_deleted
AFTER DELETE ON public.pipeline_deals
FOR EACH ROW EXECUTE FUNCTION public.mark_sheet_lead_deleted();
