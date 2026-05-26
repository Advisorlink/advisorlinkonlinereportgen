
CREATE TABLE public.gcal_sync_state (
  id integer PRIMARY KEY DEFAULT 1,
  channel_id text,
  resource_id text,
  sync_token text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.gcal_sync_state (id) VALUES (1);
ALTER TABLE public.gcal_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages gcal_sync_state" ON public.gcal_sync_state
  FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));

CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages workflows" ON public.workflows
  FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_node_id text,
  status text NOT NULL DEFAULT 'running',
  next_run_at timestamptz NOT NULL DEFAULT now(),
  client_name text,
  client_email text,
  client_phone text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_workflow_runs_next ON public.workflow_runs (status, next_run_at);
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages workflow_runs" ON public.workflow_runs
  FOR ALL USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE TRIGGER update_workflow_runs_updated_at BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.workflow_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  node_type text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  result jsonb,
  error text
);
CREATE INDEX idx_workflow_run_steps_run ON public.workflow_run_steps (run_id, executed_at);
ALTER TABLE public.workflow_run_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads workflow_run_steps" ON public.workflow_run_steps
  FOR SELECT USING (is_owner(auth.uid()));
