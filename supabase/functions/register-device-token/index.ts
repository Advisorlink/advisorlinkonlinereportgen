import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { token, platform, user_id, device_name, token_type } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!platform || !["ios", "android", "web"].includes(platform)) {
      return new Response(JSON.stringify({ error: "platform must be ios|android|web" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const resolvedTokenType = token_type === "expo" || token.startsWith("ExponentPushToken") ? "expo" : "fcm";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let resolvedUserId = user_id;
    if (!resolvedUserId) {
      const { data: owner } = await supabase
        .from("app_config")
        .select("owner_user_id")
        .eq("id", 1)
        .maybeSingle();
      resolvedUserId = owner?.owner_user_id;
    }

    const row: Record<string, unknown> = {
      token,
      platform,
      token_type: resolvedTokenType,
      updated_at: new Date().toISOString(),
    };
    if (resolvedUserId) row.user_id = resolvedUserId;
    if (device_name) row.device_name = device_name;

    const { data, error } = await supabase
      .from("device_tokens")
      .upsert(row, { onConflict: "token" })
      .select()
      .single();

    if (error) {
      console.error("upsert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("register-device-token error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
