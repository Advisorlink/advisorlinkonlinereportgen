// One-off admin utility to create a co-owner account.
// Protected by ADMIN_BOOTSTRAP_TOKEN. Delete this function after use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const token = req.headers.get("x-admin-token");
  const expected = Deno.env.get("ADMIN_BOOTSTRAP_TOKEN");
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Create the auth user, email pre-confirmed.
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (cErr) {
      return new Response(JSON.stringify({ error: cErr.message }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const uid = created.user!.id;

    // Upsert profile with owner flag (handle_new_user trigger will have run and
    // either created the profile or been suppressed by the whitelist).
    const { error: pErr } = await admin.from("profiles").upsert({
      id: uid,
      email,
      is_owner: true,
      is_blocked: false,
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
