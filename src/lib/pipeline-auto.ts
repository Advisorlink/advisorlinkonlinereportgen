import { supabase } from "@/integrations/supabase/client";

/**
 * Moves (or creates) a pipeline deal into the given stage by name.
 * Matches existing deals by email or phone (case-insensitive, normalised).
 */
export async function moveDealToStage(stageName: string, opts: {
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
}) {
  try {
    const name = (opts.clientName || "").trim() || "Unnamed client";
    const email = (opts.clientEmail || "").trim().toLowerCase() || null;
    const phoneDigits = (opts.clientPhone || "").replace(/\D+/g, "");

    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("name", stageName)
      .maybeSingle();
    if (!stage?.id) return;

    // 2. Find ALL existing deals matching by email, phone, or name (case-insensitive)
    //    so duplicates across stages (e.g. one still in "New Lead") all get moved.
    const matchIds = new Set<string>();

    if (email) {
      const { data } = await supabase
        .from("pipeline_deals")
        .select("id")
        .ilike("client_email", email);
      (data || []).forEach((d: { id: string }) => matchIds.add(d.id));
    }

    if (phoneDigits.length >= 6) {
      const { data: allWithPhone } = await supabase
        .from("pipeline_deals")
        .select("id, client_phone")
        .not("client_phone", "is", null);
      (allWithPhone || []).forEach((d: { id: string; client_phone: string | null }) => {
        if ((d.client_phone || "").replace(/\D+/g, "").endsWith(phoneDigits.slice(-9))) {
          matchIds.add(d.id);
        }
      });
    }

    // Fallback: match by exact (case-insensitive) client_name when no email/phone hit
    if (matchIds.size === 0 && name && name !== "Unnamed client") {
      const { data } = await supabase
        .from("pipeline_deals")
        .select("id")
        .ilike("client_name", name);
      (data || []).forEach((d: { id: string }) => matchIds.add(d.id));
    }

    if (matchIds.size > 0) {
      await supabase
        .from("pipeline_deals")
        .update({ stage_id: stage.id, updated_at: new Date().toISOString() } as never)
        .in("id", Array.from(matchIds));
    } else {
      // Get max position in target stage so it lands at the bottom
      const { data: maxRow } = await supabase
        .from("pipeline_deals")
        .select("position")
        .eq("stage_id", stage.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPos = ((maxRow as { position?: number } | null)?.position ?? -1) + 1;
      await supabase.from("pipeline_deals").insert({
        client_name: name,
        client_email: email,
        client_phone: opts.clientPhone || null,
        stage_id: stage.id,
        position: nextPos,
      } as never);
    }


    // Fire workflow trigger for stage change
    try {
      await supabase.functions.invoke("workflow-trigger", {
        body: {
          triggerType: "pipeline_stage_changed",
          context: {
            client_name: name,
            client_email: email,
            client_phone: opts.clientPhone || null,
            stage_name: stageName,
          },
        },
      });
    } catch (e) {
      console.warn("workflow trigger failed", e);
    }

  } catch (e) {
    console.error("moveDealToStage failed", e);
  }
}

export const moveDealToReportGenerated = (opts: Parameters<typeof moveDealToStage>[1]) =>
  moveDealToStage("Report Generated", opts);

export const moveDealToReportSent = (opts: Parameters<typeof moveDealToStage>[1]) =>
  moveDealToStage("Report Sent", opts);
