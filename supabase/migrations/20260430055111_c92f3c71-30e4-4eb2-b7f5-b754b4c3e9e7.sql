-- Reports table: stores every generated report (snapshot of inputs + summary)
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT,
  client_name TEXT NOT NULL,
  inputs JSONB NOT NULL,
  summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users insert own reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can read their own reports
CREATE POLICY "Users see own reports"
ON public.reports
FOR SELECT
USING (auth.uid() = user_id);

-- Owner can read every report
CREATE POLICY "Owner reads all reports"
ON public.reports
FOR SELECT
USING (auth.uid() = (SELECT owner_user_id FROM public.app_config WHERE id = 1));

-- Owner can delete reports
CREATE POLICY "Owner deletes reports"
ON public.reports
FOR DELETE
USING (auth.uid() = (SELECT owner_user_id FROM public.app_config WHERE id = 1));

CREATE INDEX idx_reports_client_name ON public.reports (lower(client_name));
CREATE INDEX idx_reports_created_at ON public.reports (created_at DESC);