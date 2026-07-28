
-- Whitelist josh@settledandsound.com.au so signup does not raise, and grant owner.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_owner UUID;
  is_whitelisted BOOLEAN;
BEGIN
  SELECT owner_user_id INTO current_owner FROM public.app_config WHERE id = 1;
  is_whitelisted := lower(COALESCE(NEW.email, '')) IN ('josh@settledandsound.com.au');

  IF current_owner IS NULL THEN
    UPDATE public.app_config
      SET owner_user_id = NEW.id, owner_claimed_at = now()
      WHERE id = 1;
    INSERT INTO public.profiles (id, email, is_owner)
      VALUES (NEW.id, NEW.email, true);
  ELSIF is_whitelisted THEN
    -- Additional allowed owner (bootstrap co-owner).
    INSERT INTO public.profiles (id, email, is_owner, is_blocked)
      VALUES (NEW.id, NEW.email, true, false)
      ON CONFLICT (id) DO UPDATE SET is_owner = true, is_blocked = false;
  ELSE
    RAISE EXCEPTION 'Signups are disabled for this application.';
  END IF;

  RETURN NEW;
END;
$function$;
