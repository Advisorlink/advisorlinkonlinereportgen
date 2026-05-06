import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function hasMeaningfulFields(
  fields: Record<string, unknown> | null | undefined,
) {
  return (
    !!fields &&
    Object.values(fields).some(
      (value) => value != null && String(value).trim() !== "",
    )
  );
}

function stripEmptyFields(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) => value != null && String(value).trim() !== "",
    ),
  );
}

async function extractLeadAnswers(
  transcript: string,
  summary: string,
  questions: any[] = [],
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || !transcript.trim()) return { fields: {}, summary };

  const questionText = questions.length
    ? questions
        .map(
          (q, i) =>
            `${i + 1}. ${q.question || q.label || q.fieldName} -> ${q.fieldName}`,
        )
        .join("\n")
    : "No custom campaign questions were found.";

  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You extract Australian superannuation lead data from call transcripts. Only use answers spoken by the client/User. Never use guesses, never use the AI caller's suggested wording as an answer, and leave fields blank when the client did not clearly answer.",
          },
          {
            role: "user",
            content: `Campaign questions:\n${questionText}\n\nExisting Vapi summary:\n${summary || ""}\n\nTranscript:\n${transcript}\n\nReturn structured fields for the lead page. Required standard fields: super_fund_name, balance, age, had_review_before. Also include answers to any campaign questions using their fieldName. Balance must be a raw number string if possible, no commas or currency symbols. had_review_before must be Yes, No, or blank.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_extracted_lead",
              description:
                "Save fields explicitly stated by the client during the call",
              parameters: {
                type: "object",
                properties: {
                  super_fund_name: { type: "string" },
                  balance: { type: "string" },
                  age: { type: "string" },
                  had_review_before: { type: "string" },
                  campaign_answers: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                  summary: {
                    type: "string",
                    description:
                      "Concise call summary based only on the transcript",
                  },
                },
                required: [
                  "super_fund_name",
                  "balance",
                  "age",
                  "had_review_before",
                  "campaign_answers",
                  "summary",
                ],
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "save_extracted_lead" },
        },
      }),
    },
  );

  if (!resp.ok) {
    console.error("lead extraction failed", resp.status, await resp.text());
    return { fields: {}, summary };
  }

  const result = await resp.json();
  const rawArgs =
    result.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!rawArgs) return { fields: {}, summary };

  try {
    const parsed = JSON.parse(rawArgs);
    const fields = {
      super_fund_name: parsed.super_fund_name,
      balance: parsed.balance,
      age: parsed.age,
      had_review_before: parsed.had_review_before,
      ...(parsed.campaign_answers || {}),
      ...(parsed.fields || {}),
    };
    return {
      fields: stripEmptyFields(fields),
      summary: parsed.summary || summary,
    };
  } catch {
    return { fields: {}, summary };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { message } = body;

    console.log(
      "Vapi webhook received:",
      JSON.stringify(message?.type || body.type || "unknown"),
    );

    const type = message?.type || body.type;
    const call = message?.call || body.call;
    const metadata = call?.metadata || {};
    const { contactId, campaignId } = metadata;

    if (type === "end-of-call-report") {
      const transcript = message?.transcript || body.transcript || "";
      let summary = message?.summary || body.summary || "";
      const duration = call?.duration || message?.durationSeconds || 0;
      const cost = message?.cost || call?.cost || 0;
      const endedReason =
        message?.endedReason || call?.endedReason || "unknown";
      const recordingUrl = message?.recordingUrl || call?.recordingUrl || null;
      const vapiCallId = call?.id || message?.callId || null;
      let scriptQuestions: any[] = [];

      if (campaignId) {
        const { data: campaign } = await supabase
          .from("ai_caller_campaigns")
          .select("ai_caller_scripts(questions)")
          .eq("id", campaignId)
          .single();
        scriptQuestions = (campaign as any)?.ai_caller_scripts?.questions || [];
      }

      // Extract structured data from tool calls
      let extractedFields: Record<string, string> = {};
      const toolCalls = message?.analysis?.toolCalls || [];
      for (const tc of toolCalls) {
        if (
          tc.function?.name === "extract_lead_data" &&
          tc.function?.arguments
        ) {
          try {
            const args =
              typeof tc.function.arguments === "string"
                ? JSON.parse(tc.function.arguments)
                : tc.function.arguments;
            extractedFields = { ...extractedFields, ...args };
          } catch {
            /* ignore parse errors */
          }
        }
      }

      // Also try analysis structured data
      if (message?.analysis?.structuredData) {
        extractedFields = {
          ...extractedFields,
          ...message.analysis.structuredData,
        };
      }

      if (!hasMeaningfulFields(extractedFields) && transcript) {
        const aiExtracted = await extractLeadAnswers(
          transcript,
          summary,
          scriptQuestions,
        );
        extractedFields = { ...extractedFields, ...aiExtracted.fields };
        if (aiExtracted.summary) summary = aiExtracted.summary;
      }

      extractedFields = stripEmptyFields(extractedFields);

      const finalSummary = summary;

      // Update call log
      if (vapiCallId) {
        await supabase
          .from("ai_caller_call_logs")
          .update({
            status: endedReason === "assistant-error" ? "failed" : "completed",
            duration_seconds: Math.round(duration),
            cost: cost,
            transcript: transcript,
            recording_url: recordingUrl,
            ended_at: new Date().toISOString(),
          })
          .eq("vapi_call_id", vapiCallId);
      }

      // Update contact status
      if (contactId) {
        const wasAnswered = duration > 10;
        await supabase
          .from("ai_caller_contacts")
          .update({
            call_status: wasAnswered ? "completed" : "no_answer",
          })
          .eq("id", contactId);
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
            transcript_summary: finalSummary,
            full_transcript: transcript,
            recording_url: recordingUrl || null,
            call_duration_seconds: Math.round(duration),
            qualification_score: hasExtractedData
              ? Math.min(100, Object.keys(extractedFields).length * 20)
              : 30,
            status: "new",
          });

          // Update campaign stats
          if (campaignId) {
            await supabase.rpc("increment_campaign_leads", {
              _campaign_id: campaignId,
            });
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
          await supabase
            .from("ai_caller_campaigns")
            .update({
              calls_completed: (campaign.calls_completed || 0) + 1,
              calls_answered:
                duration > 10
                  ? (campaign.calls_answered || 0) + 1
                  : campaign.calls_answered,
            })
            .eq("id", campaignId);
        }
      }

      console.log("End of call processed:", {
        vapiCallId,
        contactId,
        duration,
        extractedFields,
      });
    }

    if (type === "function-call") {
      const functionCall = message?.functionCall || body.functionCall;
      if (functionCall?.name === "extract_lead_data") {
        return new Response(
          JSON.stringify({ result: "Data saved successfully" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
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
