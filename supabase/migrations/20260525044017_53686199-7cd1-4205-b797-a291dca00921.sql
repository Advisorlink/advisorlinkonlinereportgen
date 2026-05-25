
-- Restrict Realtime channel subscriptions to the owner only (single-owner app)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner only realtime access" ON realtime.messages;
CREATE POLICY "Owner only realtime access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_owner(auth.uid()));

DROP POLICY IF EXISTS "Owner only realtime writes" ON realtime.messages;
CREATE POLICY "Owner only realtime writes"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_owner(auth.uid()));
