// Cron: every minute, advance running workflow runs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sendGmail, sendAndLogSms, brandedEmailHtml, stripDashes } from "../_shared/booking-utils.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

type Graph = {
  nodes: { id: string; type: string; data?: Record<string, unknown> }[];
  edges: { id?: string; source: string; target: string; sourceHandle?: string }[];
};

function render(tpl: string, vars: Record<string, string>): string {
  return (tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: dueRuns } = await supabase
      .from("workflow_runs")
      .select("*, workflows(*)")
      .eq("status", "running")
      .lte("next_run_at", new Date().toISOString())
      .limit(50);

    let processed = 0;
    for (const run of dueRuns || []) {
      const flow = run.workflows;
      if (!flow) continue;
      const graph = (flow.graph || { nodes: [], edges: [] }) as Graph;
      const ctx = (run.trigger_context || {}) as Record<string, string>;

      let currentId: string | null = run.current_node_id;
      let loopGuard = 0;
      let nextRunAt: string | null = null;
      let finalStatus = "running";

      while (currentId && loopGuard < 50) {
        loopGuard++;
        const node = graph.nodes.find((n) => n.id === currentId);
        if (!node) { finalStatus = "completed"; break; }

        let result: Record<string, unknown> = {};
        let advanceHandle: string | undefined = undefined;
        let waitMs = 0;

        try {
          if (node.type === "end") {
            finalStatus = "completed"; break;
          }
          if (node.type === "wait") {
            const d = (node.data || {}) as { amount?: number; unit?: string };
            const amount = Number(d.amount ?? 1);
            const unit = d.unit ?? "minutes";
            const mult: Record<string, number> = { seconds: 1000, minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
            waitMs = amount * (mult[unit] ?? 60_000);
            result = { waited: `${amount} ${unit}` };
          } else if (node.type === "email") {
            const d = (node.data || {}) as { subject?: string; heading?: string; body?: string; ctaLabel?: string; ctaUrl?: string };
            const to = ctx.client_email;
            if (to) {
              const subject = stripDashes(render(d.subject ?? "Update from Travis", ctx));
              const heading = stripDashes(render(d.heading ?? subject, ctx));
              const html = brandedEmailHtml({
                heading,
                intro: stripDashes(render(d.body ?? "", ctx)).replace(/\n/g, "<br/>"),
                details: [],
                primaryCta: d.ctaUrl ? { label: render(d.ctaLabel ?? "Open", ctx), url: render(d.ctaUrl, ctx) } : undefined,
              });
              await sendGmail(to, subject, html);
              result = { sent: to };
            } else {
              result = { skipped: "no_email" };
            }
          } else if (node.type === "sms") {
            const d = (node.data || {}) as { body?: string };
            const to = ctx.client_phone;
            if (to) {
              await sendAndLogSms(supabase, {
                to,
                body: stripDashes(render(d.body ?? "", ctx)),
                clientName: ctx.client_name,
                clientEmail: ctx.client_email,
              });
              result = { sent: to };
            } else {
              result = { skipped: "no_phone" };
            }
          } else if (node.type === "condition") {
            const d = (node.data || {}) as { field?: string; equals?: string };
            const v = String(ctx[d.field ?? ""] ?? "");
            const truthy = v === (d.equals ?? "");
            advanceHandle = truthy ? "yes" : "no";
            result = { branch: advanceHandle };
          } else if (node.type === "webhook") {
            const d = (node.data || {}) as { url?: string };
            if (d.url) {
              await fetch(d.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ctx),
              });
              result = { posted: d.url };
            }
          }
        } catch (err) {
          result = { error: (err as Error).message };
        }

        await supabase.from("workflow_run_steps").insert({
          run_id: run.id,
          node_id: node.id,
          node_type: node.type,
          result,
          error: (result as { error?: string }).error ?? null,
        });

        // Find next edge
        const outgoing = graph.edges.filter((e) => e.source === node.id);
        const nextEdge = advanceHandle
          ? outgoing.find((e) => e.sourceHandle === advanceHandle) ?? outgoing[0]
          : outgoing[0];
        currentId = nextEdge?.target ?? null;

        if (waitMs > 0 && currentId) {
          nextRunAt = new Date(Date.now() + waitMs).toISOString();
          break;
        }
        if (!currentId) { finalStatus = "completed"; break; }
      }

      const upd: Record<string, unknown> = {
        current_node_id: currentId,
        status: finalStatus,
      };
      if (nextRunAt) upd.next_run_at = nextRunAt;
      if (finalStatus === "completed") upd.completed_at = new Date().toISOString();
      await supabase.from("workflow_runs").update(upd).eq("id", run.id);
      processed++;
    }
    return json({ ok: true, processed });
  } catch (e) {
    console.error("workflow-tick error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
