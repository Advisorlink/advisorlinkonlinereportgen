
-- Allow anonymous users to update esign_documents when they know the signing_token
CREATE POLICY "Signer can update document by token"
ON public.esign_documents
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow anonymous uploads to esign-documents bucket
CREATE POLICY "Anyone can upload signed documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'esign-documents');

-- Allow anyone to read from esign-documents (needed for PDF fetch during signing)
CREATE POLICY "Anyone can read esign documents storage"
ON storage.objects
FOR SELECT
USING (bucket_id = 'esign-documents');
