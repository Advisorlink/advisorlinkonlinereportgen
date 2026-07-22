
CREATE TABLE public.advice_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  selected_ids INTEGER[] DEFAULT '{}',
  selected_titles TEXT[] DEFAULT '{}',
  drive_file_id TEXT,
  drive_view_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advice_requests TO authenticated;
GRANT ALL ON public.advice_requests TO service_role;
ALTER TABLE public.advice_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view advice requests" ON public.advice_requests
  FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
