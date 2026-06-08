CREATE TABLE public.deal_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.pipeline_deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  reminder_phone TEXT NOT NULL,
  reminder_sent_at TIMESTAMPTZ,
  reminder_error TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_tasks_deal ON public.deal_tasks(deal_id);
CREATE INDEX idx_deal_tasks_due ON public.deal_tasks(due_at) WHERE reminder_sent_at IS NULL AND completed_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_tasks TO authenticated;
GRANT ALL ON public.deal_tasks TO service_role;
ALTER TABLE public.deal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages deal tasks" ON public.deal_tasks FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE TRIGGER update_deal_tasks_updated_at BEFORE UPDATE ON public.deal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();