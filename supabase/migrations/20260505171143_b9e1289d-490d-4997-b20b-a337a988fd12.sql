
-- Create esign_documents table
CREATE TABLE public.esign_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  host_user_id UUID NOT NULL,
  document_name TEXT NOT NULL,
  original_pdf_path TEXT,
  signed_pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  signing_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  client_data JSONB DEFAULT '{}'::jsonb,
  report_id UUID,
  sent_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  resend_email TEXT
);

ALTER TABLE public.esign_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages esign documents"
  ON public.esign_documents FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

CREATE POLICY "Anyone can read by signing token"
  ON public.esign_documents FOR SELECT
  USING (true);

-- Create esign_signatures table
CREATE TABLE public.esign_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  document_id UUID NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signature_data TEXT NOT NULL,
  ip_address TEXT,
  field_index INTEGER NOT NULL DEFAULT 1,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.esign_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads signatures"
  ON public.esign_signatures FOR SELECT
  USING (is_owner(auth.uid()));

CREATE POLICY "Anyone can read signatures by document"
  ON public.esign_signatures FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create signatures"
  ON public.esign_signatures FOR INSERT
  WITH CHECK (true);

-- Storage bucket for esign PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('esign-documents', 'esign-documents', false);

CREATE POLICY "Owner manages esign files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'esign-documents' AND is_owner(auth.uid()))
  WITH CHECK (bucket_id = 'esign-documents' AND is_owner(auth.uid()));

CREATE POLICY "Public read esign files by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'esign-documents');
