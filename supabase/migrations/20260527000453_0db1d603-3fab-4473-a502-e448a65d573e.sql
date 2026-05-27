GRANT INSERT ON public.client_documents TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.client_documents TO authenticated;
GRANT ALL ON public.client_documents TO service_role;