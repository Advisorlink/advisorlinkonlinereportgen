
-- Notes table for deal profiles
CREATE TABLE public.pipeline_deal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.pipeline_deals(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_deal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages deal notes"
ON public.pipeline_deal_notes
FOR ALL
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

-- Add Lost and Won stages if missing
INSERT INTO public.pipeline_stages (name, color, position)
SELECT 'Won', '#22c55e', 8
WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE name = 'Won');

INSERT INTO public.pipeline_stages (name, color, position)
SELECT 'Lost', '#ef4444', 9
WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE name = 'Lost');

-- Add address/tags columns to deals for richer profiles
ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS client_address TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source TEXT;
