import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPI_BASE = "https://api.vapi.ai";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    if (!VAPI_API_KEY) throw new Error("VAPI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { action } = body;

    if (action === "create-assistant") {
      const { script } = body;

      // Build the questions extraction tool
      const questions = script.questions || [];
      const extractionProperties: Record<string, any> = {};
      for (const q of questions) {
        extractionProperties[q.fieldName] = {
          type: "string",
          description: q.question,
        };
      }

      const systemPrompt = `${script.system_prompt}

IMPORTANT RULES:
- You MUST follow this script exactly. Do not deviate or make up information.
- Ask each question one at a time and wait for the response before moving on.
- Be conversational and natural, like a real Australian person calling.
- If the person says they're not interested, politely thank them and end the call.
- If they ask who you are, say you're calling from Advisor Link.
- NEVER hallucinate or make up facts. Only relay information from your script.

QUESTIONS TO ASK (in order):
${questions.map((q: any, i: number) => `${i + 1}. ${q.question} (save their answer as "${q.fieldName}")`).join("\n")}

After all questions are asked, thank them for their time and let them know someone will be in touch.`;

      const assistantPayload: any = {
        name: script.name,
        model: {
          provider: "openai",
          model: script.model || "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }],
          tools: questions.length > 0 ? [{
            type: "function",
            function: {
              name: "extract_lead_data",
              description: "Extract and save the lead's answers to qualification questions",
              parameters: {
                type: "object",
                properties: extractionProperties,
                required: questions.map((q: any) => q.fieldName),
              },
            },
            async: false,
          }] : undefined,
        },
        voice: {
          provider: script.voice_provider || "elevenlabs",
          voiceId: script.voice_id || "sarah",
        },
        firstMessage: script.first_message || "Hi there, how are you today?",
        endCallFunctionEnabled: true,
        maxDurationSeconds: script.max_duration_seconds || 300,
        silenceTimeoutSeconds: 30,
        responseDelaySeconds: 0.5,
        backgroundSound: script.background_sound_enabled ? (script.background_sound || "office") : undefined,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en-AU",
        },
      };

      const vapiRes = await fetch(`${VAPI_BASE}/assistant`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assistantPayload),
      });

      if (!vapiRes.ok) {
        const errText = await vapiRes.text();
        throw new Error(`Vapi create assistant failed [${vapiRes.status}]: ${errText}`);
      }

      const assistant = await vapiRes.json();
      return new Response(JSON.stringify({ assistant }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-voices") {
      // Return curated Australian-friendly ElevenLabs voices
      const voices = [
        { id: "sarah", name: "Sarah", accent: "Australian", gender: "Female", description: "Warm, professional" },
        { id: "laura", name: "Laura", accent: "Australian", gender: "Female", description: "Friendly, clear" },
        { id: "charlie", name: "Charlie", accent: "Australian", gender: "Male", description: "Confident, natural" },
        { id: "george", name: "George", accent: "Australian/British", gender: "Male", description: "Authoritative, calm" },
        { id: "callum", name: "Callum", accent: "Australian", gender: "Male", description: "Conversational, relaxed" },
        { id: "river", name: "River", accent: "Neutral", gender: "Non-binary", description: "Smooth, versatile" },
        { id: "matilda", name: "Matilda", accent: "Australian", gender: "Female", description: "Energetic, bright" },
        { id: "jessica", name: "Jessica", accent: "Australian", gender: "Female", description: "Soft, empathetic" },
      ];
      return new Response(JSON.stringify({ voices }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "make-call") {
      const { assistantId, phoneNumber, contactId, campaignId } = body;

      const webhookUrl = `${supabaseUrl}/functions/v1/vapi-webhook`;

      const callPayload: any = {
        assistantId,
        customer: { number: phoneNumber },
        phoneNumberId: body.phoneNumberId,
        metadata: { contactId, campaignId },
        server: {
          url: webhookUrl,
        },
      };

      const vapiRes = await fetch(`${VAPI_BASE}/call/phone`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(callPayload),
      });

      if (!vapiRes.ok) {
        const errText = await vapiRes.text();
        throw new Error(`Vapi make call failed [${vapiRes.status}]: ${errText}`);
      }

      const call = await vapiRes.json();

      // Log the call
      await supabase.from("ai_caller_call_logs").insert({
        campaign_id: campaignId,
        contact_id: contactId,
        vapi_call_id: call.id,
        status: "initiated",
        started_at: new Date().toISOString(),
      });

      // Update contact status
      await supabase.from("ai_caller_contacts").update({
        call_status: "calling",
        call_attempts: supabase.rpc ? 1 : 1,
        last_called_at: new Date().toISOString(),
        vapi_call_id: call.id,
      }).eq("id", contactId);

      return new Response(JSON.stringify({ call }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-phone-numbers") {
      const vapiRes = await fetch(`${VAPI_BASE}/phone-number`, {
        headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
      });
      if (!vapiRes.ok) {
        const errText = await vapiRes.text();
        throw new Error(`Vapi list phone numbers failed [${vapiRes.status}]: ${errText}`);
      }
      const phoneNumbers = await vapiRes.json();
      return new Response(JSON.stringify({ phoneNumbers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import-phone-number") {
      const { number, twilioAccountSid, twilioAuthToken } = body;
      if (!number || !twilioAccountSid || !twilioAuthToken) {
        throw new Error("number (E.164), twilioAccountSid, and twilioAuthToken are required");
      }
      const vapiRes = await fetch(`${VAPI_BASE}/phone-number`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "twilio",
          number,
          twilioAccountSid,
          twilioAuthToken,
        }),
      });
      if (!vapiRes.ok) {
        const errText = await vapiRes.text();
        throw new Error(`Vapi import number failed [${vapiRes.status}]: ${errText}`);
      }
      const phoneNumber = await vapiRes.json();
      return new Response(JSON.stringify({ phoneNumber }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("vapi-manage error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
