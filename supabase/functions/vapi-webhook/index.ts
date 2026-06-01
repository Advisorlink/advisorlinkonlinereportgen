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
                  email: {
                    type: "string",
                    description:
                      "Email address the client clearly spelled out or confirmed. Leave blank if not provided.",
                  },
                  consent_to_contact: {
                    type: "boolean",
                    description:
                      "True ONLY if the client explicitly agreed to be contacted, called back, or to receive information.",
                  },
                  interested: {
                    type: "boolean",
                    description:
                      "True if the client showed genuine interest in a super review or follow-up; false if they declined, hung up early, were not interested, or asked not to be contacted.",
                  },
                  campaign_answers: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                  summary: {
                    type: "string",
                    description:
                      "Concise 2-3 sentence call summary based only on what the client said. Mention key facts (fund, balance, age, attitude, any objections).",
                  },
                },
                required: [
                  "super_fund_name",
                  "balance",
                  "age",
                  "had_review_before",
                  "email",
                  "consent_to_contact",
                  "interested",
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

      // Update or create call log
      if (vapiCallId) {
        const { data: existingLog } = await supabase
          .from("ai_caller_call_logs")
          .select("id")
          .eq("vapi_call_id", vapiCallId)
          .maybeSingle();

        const logPayload = {
          status: endedReason === "assistant-error" ? "failed" : "completed",
          duration_seconds: Math.round(duration),
          cost: cost,
          transcript: transcript,
          recording_url: recordingUrl,
          ended_at: new Date().toISOString(),
        };

        if (existingLog) {
          await supabase
            .from("ai_caller_call_logs")
            .update(logPayload)
            .eq("vapi_call_id", vapiCallId);
        } else {
          // Inbound call — no prior log exists
          const callerPhone = call?.customer?.number || call?.customerNumber || "";
          await supabase.from("ai_caller_call_logs").insert({
            ...logPayload,
            vapi_call_id: vapiCallId,
            campaign_id: campaignId || null,
            contact_id: contactId || null,
            started_at: new Date().toISOString(),
          });
        }
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

      if (wasQualified) {
        if (contactId) {
          // Outbound call with known contact
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
        } else {
          // Inbound call — create lead directly
          const callerPhone = call?.customer?.number || call?.customerNumber || "";
          await supabase.from("ai_caller_leads").insert({
            campaign_id: null,
            contact_id: null,
            name: "Inbound Caller",
            phone: callerPhone,
            email: null,
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
        hasRecording: !!recordingUrl,
      });

      // If no recording URL yet, schedule a background fetch from Vapi API
      if (!recordingUrl && vapiCallId && duration > 5) {
        const vapiKey = Deno.env.get("VAPI_API_KEY");
        if (vapiKey) {
          EdgeRuntime.waitUntil((async () => {
            // Wait 30 seconds for Vapi to finish processing the recording
            await new Promise(r => setTimeout(r, 30000));
            try {
              const resp = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
                headers: { Authorization: `Bearer ${vapiKey}` },
              });
              if (resp.ok) {
                const callData = await resp.json();
                const recUrl = callData.recordingUrl || callData.artifact?.recordingUrl;
                if (recUrl) {
                  console.log("Background fetch: found recording for", vapiCallId);
                  await supabase
                    .from("ai_caller_call_logs")
                    .update({ recording_url: recUrl })
                    .eq("vapi_call_id", vapiCallId);
                  
                  if (contactId) {
                    await supabase
                      .from("ai_caller_leads")
                      .update({ recording_url: recUrl })
                      .eq("contact_id", contactId)
                      .is("recording_url", null);
                  }
                }
              }
            } catch (e) {
              console.error("Background recording fetch failed:", e);
            }
          })());
        }
      }
    }

    // Handle status-update events — Vapi often sends recordingUrl here after processing
    if (type === "status-update") {
      const vapiCallId = call?.id || message?.callId || null;
      const recordingUrl = message?.recordingUrl || call?.recordingUrl || call?.artifact?.recordingUrl || null;
      const status = message?.status || call?.status || "";

      if (vapiCallId && recordingUrl) {
        console.log("status-update: saving recording URL for", vapiCallId);

        // Update call log
        await supabase
          .from("ai_caller_call_logs")
          .update({ recording_url: recordingUrl })
          .eq("vapi_call_id", vapiCallId)
          .is("recording_url", null);

        // Update lead
        await supabase
          .from("ai_caller_leads")
          .update({ recording_url: recordingUrl })
          .eq("full_transcript", "") // only match if we can identify by call id via contact
          .is("recording_url", null);

        // Try to find the contact_id from the call log to update the right lead
        const { data: log } = await supabase
          .from("ai_caller_call_logs")
          .select("contact_id")
          .eq("vapi_call_id", vapiCallId)
          .maybeSingle();

        if (log?.contact_id) {
          await supabase
            .from("ai_caller_leads")
            .update({ recording_url: recordingUrl })
            .eq("contact_id", log.contact_id)
            .is("recording_url", null);
        }
      }
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
