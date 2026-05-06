
-- Create the helper function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for e-sign templates
CREATE TABLE public.esign_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  pdf_path TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.esign_templates ENABLE ROW LEVEL SECURITY;

-- Only the owner can manage templates
CREATE POLICY "Owner manages templates"
  ON public.esign_templates
  FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_esign_templates_updated_at
  BEFORE UPDATE ON public.esign_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
