
-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Signer can update document by token" ON public.esign_documents;

-- Create a secure function for signing completion
CREATE OR REPLACE FUNCTION public.complete_signing(
  _token text,
  _signed_pdf_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.esign_documents
  SET status = 'signed',
      signed_at = now(),
      signed_pdf_path = _signed_pdf_path
  WHERE signing_token = _token
    AND status = 'sent';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token or document already signed';
  END IF;
END;
$$;
