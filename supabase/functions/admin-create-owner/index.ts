// One-off bootstrap. Only creates the hardcoded email; fails on second call.
// Delete this function after successful use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ALLOWED_EMAIL = "josh@settledandsound.com.au";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { email, password } = await req.json();
    if (email !== ALLOWED_EMAIL || !password) {
      return new Response(JSON.stringify({ error: "not allowed" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (cErr) {
      return new Response(JSON.stringify({ error: cErr.message }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const uid = created.user!.id;
    const { error: pErr } = await admin.from("profiles").upsert({
      id: uid, email, is_owner: true, is_blocked: false,
    }, { onConflict: "id" });
    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message, user_id: uid }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, user_id: uid, email }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
