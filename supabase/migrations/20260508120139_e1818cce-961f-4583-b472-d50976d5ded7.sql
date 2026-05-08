-- Lost reasons library
CREATE TABLE public.pipeline_lost_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_lost_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages lost reasons"
ON public.pipeline_lost_reasons
FOR ALL
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

-- Seed defaults
INSERT INTO public.pipeline_lost_reasons (name, position) VALUES
  ('Not interested', 0),
  ('Too expensive', 1),
  ('Went with competitor', 2),
  ('Bad timing', 3),
  ('No response', 4),
  ('Not qualified', 5);

-- Track lost reason on deal
ALTER TABLE public.pipeline_deals
  ADD COLUMN lost_reason_id UUID REFERENCES public.pipeline_lost_reasons(id) ON DELETE SET NULL,
  ADD COLUMN lost_reason_note TEXT;
