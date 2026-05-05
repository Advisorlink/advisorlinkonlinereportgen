
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(4), 'hex'),
  host_user_id uuid NOT NULL,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_email text,
  status text NOT NULL DEFAULT 'waiting',
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can do everything with meetings"
  ON public.meetings FOR ALL
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Anyone can read meeting by meeting_id"
  ON public.meetings FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
