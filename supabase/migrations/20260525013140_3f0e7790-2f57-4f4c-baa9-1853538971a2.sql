
-- ============================================================
-- 1) Tighten esign_documents
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read by signing token" ON public.esign_documents;

CREATE OR REPLACE FUNCTION public.get_esign_doc_by_token(_token text)
RETURNS SETOF public.esign_documents
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.esign_documents WHERE signing_token = _token LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_esign_doc_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_esign_doc_by_token(text) TO anon, authenticated;

-- ============================================================
-- 2) Tighten esign_signatures
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read signatures by document" ON public.esign_signatures;
DROP POLICY IF EXISTS "Anyone can create signatures" ON public.esign_signatures;

-- Public can only insert via this token-validated function
CREATE OR REPLACE FUNCTION public.submit_esign_signature(
  _token text,
  _signature_data text,
  _field_index int DEFAULT 1
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc public.esign_documents%ROWTYPE;
  _sig_id uuid;
BEGIN
  SELECT * INTO _doc FROM public.esign_documents
    WHERE signing_token = _token AND status = 'sent' LIMIT 1;
  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already-signed document';
  END IF;

  INSERT INTO public.esign_signatures(document_id, signer_name, signer_email, signature_data, field_index)
  VALUES (_doc.id, COALESCE(_doc.client_name,'Unknown'), _doc.client_email, _signature_data, COALESCE(_field_index,1))
  RETURNING id INTO _sig_id;

  RETURN _sig_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_esign_signature(text, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_esign_signature(text, text, int) TO anon, authenticated;

-- ============================================================
-- 3) Tighten meetings
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read meeting by meeting_id" ON public.meetings;

CREATE OR REPLACE FUNCTION public.get_meeting_by_id(_meeting_id text)
RETURNS TABLE(id uuid, meeting_id text, status text, host_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, meeting_id, status, host_user_id
    FROM public.meetings WHERE meeting_id = _meeting_id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_meeting_by_id(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_meeting_by_id(text) TO anon, authenticated;

-- ============================================================
-- 4) Tighten referral_leads
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read leads by token" ON public.referral_leads;

CREATE OR REPLACE FUNCTION public.get_referral_lead_by_token(_token text)
RETURNS TABLE(id uuid, lead_name text, lead_phone text, lead_email text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, lead_name, lead_phone, lead_email, status
    FROM public.referral_leads WHERE token = _token LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_referral_lead_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_referral_lead_by_token(text) TO anon, authenticated;

-- ============================================================
-- 5) Tighten device_tokens (drop anon-permissive policies)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can register device token" ON public.device_tokens;
DROP POLICY IF EXISTS "Anyone can update device token" ON public.device_tokens;
-- The authenticated user_id-scoped policies remain in place.

-- ============================================================
-- 6) Remove anon webhook inserts (edge functions use service role)
-- ============================================================
DROP POLICY IF EXISTS "Webhook inserts messages" ON public.sms_messages;
DROP POLICY IF EXISTS "Webhook inserts media" ON public.sms_message_media;
DROP POLICY IF EXISTS "Webhook inserts opt_records" ON public.sms_opt_records;

-- ============================================================
-- 7) Storage policies for esign-documents bucket
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read esign documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Public read esign files by path" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload signed documents" ON storage.objects;

-- Allow anon to upload ONLY completed signed PDFs (path must end in _signed.pdf)
CREATE POLICY "Anon uploads completed signed pdfs"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'esign-documents'
  AND right(name, 11) = '_signed.pdf'
);

-- ============================================================
-- 8) Realtime channel authorization — owner only
-- ============================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner only realtime" ON realtime.messages;
CREATE POLICY "Owner only realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (public.is_owner(auth.uid()));

DROP POLICY IF EXISTS "Owner only realtime broadcast" ON realtime.messages;
CREATE POLICY "Owner only realtime broadcast"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (public.is_owner(auth.uid()));

-- ============================================================
-- 9) Revoke EXECUTE from anon on internal SECURITY DEFINER fns
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
-- complete_signing is now wrapped by submit_esign_signature flow but still
-- used to mark the document signed; restrict to anon+authenticated only.
REVOKE EXECUTE ON FUNCTION public.complete_signing(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_signing(text, text) TO anon, authenticated;
