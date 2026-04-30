DROP POLICY IF EXISTS "Owner sees all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owner updates profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owner deletes profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owner reads all logs" ON public.activity_log;
DROP POLICY IF EXISTS "Owner deletes logs" ON public.activity_log;

CREATE POLICY "Owner sees all profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = (SELECT owner_user_id FROM public.app_config WHERE id = 1)
);

CREATE POLICY "Owner updates profiles"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = (SELECT owner_user_id FROM public.app_config WHERE id = 1)
);

CREATE POLICY "Owner deletes profiles"
ON public.profiles
FOR DELETE
USING (
  auth.uid() = (SELECT owner_user_id FROM public.app_config WHERE id = 1)
);

CREATE POLICY "Owner reads all logs"
ON public.activity_log
FOR SELECT
USING (
  auth.uid() = (SELECT owner_user_id FROM public.app_config WHERE id = 1)
);

CREATE POLICY "Owner deletes logs"
ON public.activity_log
FOR DELETE
USING (
  auth.uid() = (SELECT owner_user_id FROM public.app_config WHERE id = 1)
);

REVOKE EXECUTE ON FUNCTION public.is_owner(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_blocked(UUID) FROM PUBLIC, anon, authenticated;