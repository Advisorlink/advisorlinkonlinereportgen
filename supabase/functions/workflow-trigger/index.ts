import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { triggerType, context } = await req.json();
    if (!triggerType) return json({ error: "missing triggerType" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: flows } = await supabase
      .from("workflows")
      .select("*")
      .eq("trigger_type", triggerType)
      .eq("is_active", true);

    if (!flows?.length) return json({ ok: true, fired: 0 });

    let fired = 0;
    for (const flow of flows) {
      const graph = (flow.graph || {}) as { nodes?: { id: string; type: string }[]; edges?: { source: string; target: string }[] };
      // Find the trigger node (type === 'trigger')
      const triggerNode = graph.nodes?.find((n) => n.type === "trigger");
      if (!triggerNode) continue;
      // First non-trigger node = follow outgoing edge from triggerNode
      const firstEdge = graph.edges?.find((e) => e.source === triggerNode.id);
      const firstNodeId = firstEdge?.target ?? null;
      if (!firstNodeId) continue;

      const ctx = (context || {}) as Record<string, string>;
      await supabase.from("workflow_runs").insert({
        workflow_id: flow.id,
        trigger_context: context || {},
        current_node_id: firstNodeId,
        status: "running",
        next_run_at: new Date().toISOString(),
        client_name: ctx.client_name ?? null,
        client_email: ctx.client_email ?? null,
        client_phone: ctx.client_phone ?? null,
      });
      fired++;
    }
    return json({ ok: true, fired });
  } catch (e) {
    console.error("workflow-trigger error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
