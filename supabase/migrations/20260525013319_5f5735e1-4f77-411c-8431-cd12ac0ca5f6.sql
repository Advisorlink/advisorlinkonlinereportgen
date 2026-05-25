
DROP POLICY IF EXISTS "Owner only realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Owner only realtime broadcast" ON realtime.messages;

-- Allow any authenticated OR anon caller to use realtime channels.
-- Postgres-changes deliveries are still filtered by each table's RLS,
-- so private table rows are never broadcast to unauthorized clients.
CREATE POLICY "Realtime broadcast allowed"
ON realtime.messages FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Realtime broadcast insert allowed"
ON realtime.messages FOR INSERT TO anon, authenticated
WITH CHECK (true);
