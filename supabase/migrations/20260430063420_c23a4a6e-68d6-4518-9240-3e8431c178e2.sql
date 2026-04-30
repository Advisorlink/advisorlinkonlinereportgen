-- 1. Add pdf_path column to reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS pdf_path text;

-- 2. Create private storage bucket for client report PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-reports', 'client-reports', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects for the client-reports bucket
-- Path layout: {user_id}/{clientFolder}/{filename}.pdf

-- Advisors: read their own files
DROP POLICY IF EXISTS "Advisors read own client reports" ON storage.objects;
CREATE POLICY "Advisors read own client reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Advisors: upload their own files
DROP POLICY IF EXISTS "Advisors upload own client reports" ON storage.objects;
CREATE POLICY "Advisors upload own client reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Advisors: update their own files
DROP POLICY IF EXISTS "Advisors update own client reports" ON storage.objects;
CREATE POLICY "Advisors update own client reports"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Advisors: delete their own files
DROP POLICY IF EXISTS "Advisors delete own client reports" ON storage.objects;
CREATE POLICY "Advisors delete own client reports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owner: read every advisor's files
DROP POLICY IF EXISTS "Owner reads all client reports" ON storage.objects;
CREATE POLICY "Owner reads all client reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-reports'
  AND auth.uid() = (SELECT owner_user_id FROM public.app_config WHERE id = 1)
);

-- Owner: delete every advisor's files
DROP POLICY IF EXISTS "Owner deletes all client reports" ON storage.objects;
CREATE POLICY "Owner deletes all client reports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-reports'
  AND auth.uid() = (SELECT owner_user_id FROM public.app_config WHERE id = 1)
);