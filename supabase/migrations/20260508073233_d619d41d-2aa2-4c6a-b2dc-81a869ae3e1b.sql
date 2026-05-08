
-- Pipeline stages (columns on the board)
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage stages" ON public.pipeline_stages
  FOR ALL USING (public.is_owner(auth.uid()));

-- Pipeline deals (cards on the board)
CREATE TABLE public.pipeline_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  value NUMERIC(12,2),
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage deals" ON public.pipeline_deals
  FOR ALL USING (public.is_owner(auth.uid()));

CREATE TRIGGER update_pipeline_deals_updated_at
  BEFORE UPDATE ON public.pipeline_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default stages
INSERT INTO public.pipeline_stages (name, color, position) VALUES
  ('New Lead', '#6366F1', 0),
  ('Contacted', '#8B5CF6', 1),
  ('Fact Find', '#F59E0B', 2),
  ('Meeting Booked', '#3B82F6', 3),
  ('Proposal Sent', '#EC4899', 4),
  ('Signed', '#10B981', 5),
  ('Settled', '#059669', 6);
