
CREATE TABLE public.ai_caller_lead_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.ai_caller_leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_caller_lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages ai_caller_lead_notes"
ON public.ai_caller_lead_notes
FOR ALL
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

CREATE INDEX idx_lead_notes_lead_id ON public.ai_caller_lead_notes(lead_id);
