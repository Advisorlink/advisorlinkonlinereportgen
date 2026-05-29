CREATE TABLE public.inbound_ai_routing (
  phone_number TEXT PRIMARY KEY,
  vapi_assistant_id TEXT NOT NULL,
  vapi_phone_number_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.inbound_ai_routing TO service_role;

ALTER TABLE public.inbound_ai_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage inbound routing"
ON public.inbound_ai_routing
FOR ALL
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));