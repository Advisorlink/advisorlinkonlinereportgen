ALTER TABLE public.device_tokens ADD COLUMN IF NOT EXISTS token_type text NOT NULL DEFAULT 'fcm';
ALTER TABLE public.device_tokens ADD COLUMN IF NOT EXISTS device_name text;
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_unique ON public.device_tokens(token);
ALTER TABLE public.device_tokens ALTER COLUMN user_id DROP NOT NULL;
CREATE POLICY "Anyone can register device token" ON public.device_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update device token" ON public.device_tokens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);