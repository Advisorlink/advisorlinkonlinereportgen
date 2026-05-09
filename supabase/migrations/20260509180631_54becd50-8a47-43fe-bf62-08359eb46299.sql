
-- Table to track uploaded client documents
CREATE TABLE public.client_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  notes TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit documents"
ON public.client_documents FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Owner manages client_documents"
ON public.client_documents FOR ALL TO public
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

CREATE TRIGGER update_client_documents_updated_at
BEFORE UPDATE ON public.client_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_client_documents_email ON public.client_documents(client_email);
CREATE INDEX idx_client_documents_created_at ON public.client_documents(created_at DESC);

-- Private storage bucket for client uploads (10MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
);

CREATE POLICY "Anyone can upload client documents"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'client-documents');

CREATE POLICY "Owner reads client documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-documents' AND is_owner(auth.uid()));

CREATE POLICY "Owner updates client documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-documents' AND is_owner(auth.uid()));

CREATE POLICY "Owner deletes client documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-documents' AND is_owner(auth.uid()));
