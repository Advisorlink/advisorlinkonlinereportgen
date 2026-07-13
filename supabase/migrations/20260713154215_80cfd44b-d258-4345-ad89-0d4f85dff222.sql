CREATE TABLE public.strategy_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_dob DATE,
  retirement_age INT NOT NULL DEFAULT 65,
  annual_income NUMERIC NOT NULL DEFAULT 0,
  personal_contribution_amount NUMERIC NOT NULL DEFAULT 0,
  personal_contribution_frequency TEXT NOT NULL DEFAULT 'Annually',
  desired_income_amount NUMERIC NOT NULL DEFAULT 0,
  desired_income_frequency TEXT NOT NULL DEFAULT 'Annually',
  goal_balance NUMERIC NOT NULL DEFAULT 0,
  existing_scenario JSONB NOT NULL DEFAULT '{}'::jsonb,
  comparison_scenario JSONB NOT NULL DEFAULT '{}'::jsonb,
  existing_insurance JSONB NOT NULL DEFAULT '{}'::jsonb,
  comparison_insurance JSONB NOT NULL DEFAULT '{}'::jsonb,
  fees JSONB NOT NULL DEFAULT '{}'::jsonb,
  research_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_papers TO authenticated;
GRANT ALL ON public.strategy_papers TO service_role;

ALTER TABLE public.strategy_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own strategy papers"
  ON public.strategy_papers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_strategy_papers_updated_at
  BEFORE UPDATE ON public.strategy_papers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_strategy_papers_user ON public.strategy_papers(user_id, updated_at DESC);