import { supabase } from "@/integrations/supabase/client";

/**
 * Moves (or creates) a pipeline deal into the "Report Generated" stage
 * when a report is saved/generated for a client. Matches existing deals
 * by email or phone (case-insensitive, normalised).
 */
export async function moveDealToReportGenerated(opts: {
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
}) {
  try {
    const name = (opts.clientName || "").trim() || "Unnamed client";
    const email = (opts.clientEmail || "").trim().toLowerCase() || null;
    const phoneDigits = (opts.clientPhone || "").replace(/\D+/g, "");

    // 1. Find the Report Generated stage
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("name", "Report Generated")
      .maybeSingle();
    if (!stage?.id) return;

    // 2. Try to find an existing deal by email then phone
    let existingId: string | null = null;
    if (email) {
      const { data } = await supabase
        .from("pipeline_deals")
        .select("id")
        .ilike("client_email", email)
        .limit(1)
        .maybeSingle();
      existingId = (data as { id?: string } | null)?.id ?? null;
    }
    if (!existingId && phoneDigits.length >= 6) {
      const { data: allWithPhone } = await supabase
        .from("pipeline_deals")
        .select("id, client_phone")
        .not("client_phone", "is", null);
      const match = (allWithPhone || []).find(
        (d: { client_phone: string | null }) =>
          (d.client_phone || "").replace(/\D+/g, "").endsWith(phoneDigits.slice(-9))
      );
      existingId = (match as { id?: string } | undefined)?.id ?? null;
    }

    if (existingId) {
      await supabase
        .from("pipeline_deals")
        .update({ stage_id: stage.id, updated_at: new Date().toISOString() } as never)
        .eq("id", existingId);
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
  } catch (e) {
    console.error("moveDealToReportGenerated failed", e);
  }
}
