-- ============ CONFIG TABLE (owner singleton) ============
CREATE TABLE public.app_config (
  id INT PRIMARY KEY DEFAULT 1,
  owner_user_id UUID,
  owner_claimed_at TIMESTAMPTZ,
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.app_config (id) VALUES (1);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Anyone (even anon) can READ owner_user_id to determine if app is claimed.
-- This is safe — it's just a UUID with no PII.
CREATE POLICY "Anyone can read app_config"
ON public.app_config FOR SELECT
USING (true);

-- Nobody can update via API; only the trigger below mutates it.
-- (No INSERT/UPDATE/DELETE policies = locked down.)

-- ============ PROFILES (user accounts + block status) ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling user the owner?
CREATE OR REPLACE FUNCTION public.is_owner(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND is_owner = true)
$$;

-- Helper: is the calling user blocked?
CREATE OR REPLACE FUNCTION public.is_blocked(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_blocked FROM public.profiles WHERE id = _uid), false)
$$;

-- Users can see their own profile
CREATE POLICY "Users see own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Owner sees all profiles
CREATE POLICY "Owner sees all profiles"
ON public.profiles FOR SELECT
USING (public.is_owner(auth.uid()));

-- Owner can update profiles (block/unblock)
CREATE POLICY "Owner updates profiles"
ON public.profiles FOR UPDATE
USING (public.is_owner(auth.uid()));

-- Owner can delete profiles
CREATE POLICY "Owner deletes profiles"
ON public.profiles FOR DELETE
USING (public.is_owner(auth.uid()));

-- ============ TRIGGER: auto-create profile + claim owner on first signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_owner UUID;
BEGIN
  SELECT owner_user_id INTO current_owner FROM public.app_config WHERE id = 1;

  -- If no owner yet, this signup BECOMES the owner. Otherwise reject.
  IF current_owner IS NULL THEN
    UPDATE public.app_config
      SET owner_user_id = NEW.id, owner_claimed_at = now()
      WHERE id = 1;
    INSERT INTO public.profiles (id, email, is_owner)
      VALUES (NEW.id, NEW.email, true);
  ELSE
    -- Block all subsequent signups
    RAISE EXCEPTION 'Signups are disabled for this application.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ACTIVITY LOG ============
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  event_type TEXT NOT NULL, -- 'login', 'logout', 'report_generated', 'signup_blocked', 'access_denied'
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own log entries
CREATE POLICY "Users log own activity"
ON public.activity_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Owner reads all logs
CREATE POLICY "Owner reads all logs"
ON public.activity_log FOR SELECT
USING (public.is_owner(auth.uid()));

-- Owner can clear logs
CREATE POLICY "Owner deletes logs"
ON public.activity_log FOR DELETE
USING (public.is_owner(auth.uid()));

CREATE INDEX idx_activity_log_created ON public.activity_log (created_at DESC);