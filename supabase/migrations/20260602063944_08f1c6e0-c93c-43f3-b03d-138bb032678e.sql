DROP POLICY IF EXISTS "Anyone can submit documents" ON public.client_documents;
DROP POLICY IF EXISTS "Anyone can upload client documents" ON storage.objects;

CREATE POLICY "Owner uploads client documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-documents' AND public.is_owner(auth.uid()));