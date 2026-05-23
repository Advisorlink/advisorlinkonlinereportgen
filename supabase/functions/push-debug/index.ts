import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supa
    .from("device_tokens")
    .select("id, token, platform, token_type, device_name, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return new Response(JSON.stringify({ data, error }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
