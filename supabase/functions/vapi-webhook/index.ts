import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { message } = body;

    console.log("Vapi webhook received:", JSON.stringify(message?.type || body.type || "unknown"));

    const type = message?.type || body.type;
    const call = message?.call || body.call;
    const metadata = call?.metadata || {};
    const { contactId, campaignId } = metadata;

    if (type === "end-of-call-report") {
      const transcript = message?.transcript || body.transcript || "";
      const summary = message?.summary || body.summary || "";
      const duration = call?.duration || message?.durationSeconds || 0;
      const cost = message?.cost || call?.cost || 0;
      const endedReason = message?.endedReason || call?.endedReason || "unknown";
      const recordingUrl = message?.recordingUrl || call?.recordingUrl || null;
      const vapiCallId = call?.id || message?.callId || null;

      // Extract structured data from tool calls
      let extractedFields: Record<string, string> = {};
      const toolCalls = message?.analysis?.toolCalls || [];
      for (const tc of toolCalls) {
        if (tc.function?.name === "extract_lead_data" && tc.function?.arguments) {
          try {
            const args = typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments;
            extractedFields = { ...extractedFields, ...args };
          } catch { /* ignore parse errors */ }
        }
      }

      // Also try analysis structured data
      if (message?.analysis?.structuredData) {
        extractedFields = { ...extractedFields, ...message.analysis.structuredData };
      }

      // Update call log
      if (vapiCallId) {
        await supabase.from("ai_caller_call_logs").update({
          status: endedReason === "assistant-error" ? "failed" : "completed",
          duration_seconds: Math.round(duration),
          cost: cost,
          transcript: transcript,
          recording_url: recordingUrl,
          ended_at: new Date().toISOString(),
        }).eq("vapi_call_id", vapiCallId);
      }

      // Update contact status
      if (contactId) {
        const wasAnswered = duration > 10;
        await supabase.from("ai_caller_contacts").update({
          call_status: wasAnswered ? "completed" : "no_answer",
        }).eq("id", contactId);
      }

      // Create lead if we got meaningful data
      const hasExtractedData = Object.keys(extractedFields).length > 0;
      const wasQualified = duration > 30 || hasExtractedData;

      if (wasQualified && contactId) {
        // Get contact info
        const { data: contact } = await supabase
          .from("ai_caller_contacts")
          .select("*")
          .eq("id", contactId)
          .single();

        if (contact) {
          await supabase.from("ai_caller_leads").insert({
            campaign_id: campaignId || null,
            contact_id: contactId,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            extracted_fields: extractedFields,
            transcript_summary: summary,
            full_transcript: transcript,
            call_duration_seconds: Math.round(duration),
            qualification_score: hasExtractedData ? Math.min(100, Object.keys(extractedFields).length * 20) : 30,
            status: "new",
          });

          // Update campaign stats
          if (campaignId) {
            await supabase.rpc("increment_campaign_leads", { _campaign_id: campaignId });
          }
        }
      }

      // Update campaign stats
      if (campaignId) {
        const updates: any = {};
        const { data: campaign } = await supabase
          .from("ai_caller_campaigns")
          .select("calls_completed, calls_answered")
          .eq("id", campaignId)
          .single();

        if (campaign) {
          await supabase.from("ai_caller_campaigns").update({
            calls_completed: (campaign.calls_completed || 0) + 1,
            calls_answered: duration > 10 ? (campaign.calls_answered || 0) + 1 : campaign.calls_answered,
          }).eq("id", campaignId);
        }
      }

      console.log("End of call processed:", { vapiCallId, contactId, duration, extractedFields });
    }

    if (type === "function-call") {
      const functionCall = message?.functionCall || body.functionCall;
      if (functionCall?.name === "extract_lead_data") {
        return new Response(JSON.stringify({ result: "Data saved successfully" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vapi-webhook error:", e);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
