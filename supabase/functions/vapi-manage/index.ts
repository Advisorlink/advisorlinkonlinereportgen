import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPI_BASE = "https://api.vapi.ai";
const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

const VOICE_ID_MAP: Record<string, string> = {
  voice1: "DTLT09E2cxHF0DqjKVbc",
  voice2: "4yye0QE5YPsKbMOCGGlj",
  voice3: "w9rPM8AIZle60Nbpw7nl",
};

function resolveVoiceId(shortId: string | undefined): string {
  if (!shortId) return VOICE_ID_MAP.voice1;
  return VOICE_ID_MAP[shortId] || shortId;
}
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
          voiceId: resolveVoiceId(script.voice_id),
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
      // Return curated Australian ElevenLabs community voices
      const voices = [
        { id: "voice1", name: "Olivia", accent: "Australian", gender: "Female", description: "Warm, professional" },
        { id: "voice2", name: "Jack", accent: "Australian", gender: "Male", description: "Confident, natural" },
        { id: "voice3", name: "Mia", accent: "Australian", gender: "Female", description: "Friendly, clear" },
        { id: "voice4", name: "Liam", accent: "Australian", gender: "Male", description: "Conversational, relaxed" },
        { id: "voice5", name: "Sophie", accent: "Australian", gender: "Female", description: "Energetic, bright" },
      ];
      return new Response(JSON.stringify({ voices }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "voice-previews") {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

      const previews: Record<string, string> = {};
      for (const [shortId, elId] of Object.entries(VOICE_ID_MAP)) {
        try {
          const res = await fetch(`https://api.elevenlabs.io/v1/voices/${elId}`, {
            headers: { "xi-api-key": ELEVENLABS_API_KEY },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.preview_url) previews[shortId] = data.preview_url;
          }
        } catch { /* skip */ }
      }
      return new Response(JSON.stringify({ previews }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "preview-voice") {
      const { voiceId, text } = body;
      if (!voiceId || !text) throw new Error("voiceId and text are required");
      
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY) {
        return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured", fallback: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        throw new Error(`ElevenLabs TTS failed [${ttsRes.status}]: ${errText}`);
      }

      const audioBuffer = await ttsRes.arrayBuffer();
      const { encode: base64Encode } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
      const audioBase64 = base64Encode(audioBuffer);

      return new Response(JSON.stringify({ audioBase64 }), {
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
      if (!number) {
        throw new Error("number (E.164) is required");
      }
      // Use provided creds or fall back to connector creds for Vapi import
      const sid = twilioAccountSid || await getTwilioAccountSid();
      const auth = twilioAuthToken || await getTwilioAuthToken();
      const vapiRes = await fetch(`${VAPI_BASE}/phone-number`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "twilio",
          number,
          twilioAccountSid: sid,
          twilioAuthToken: auth,
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

    if (action === "search-twilio-numbers") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
      const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
      if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured – connect Twilio first");

      const { country, areaCode, contains } = body;
      const cc = country || "AU";
      const params = new URLSearchParams();
      if (areaCode) params.set("AreaCode", areaCode);
      if (contains) params.set("Contains", contains);
      params.set("VoiceEnabled", "true");
      params.set("PageSize", "20");

      const twilioRes = await fetch(
        `${TWILIO_GATEWAY}/AvailablePhoneNumbers/${cc}/Local.json?${params.toString()}`,
        {
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
          },
        }
      );
      if (!twilioRes.ok) {
        const errText = await twilioRes.text();
        throw new Error(`Twilio search failed [${twilioRes.status}]: ${errText}`);
      }
      const result = await twilioRes.json();
      const numbers = (result.available_phone_numbers || []).map((n: any) => ({
        phoneNumber: n.phone_number,
        friendlyName: n.friendly_name,
        locality: n.locality,
        region: n.region,
        capabilities: n.capabilities,
      }));
      return new Response(JSON.stringify({ numbers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "buy-twilio-number") {
      const { twilioAccountSid, twilioAuthToken, phoneNumber } = body;
      if (!twilioAccountSid || !twilioAuthToken || !phoneNumber) {
        throw new Error("twilioAccountSid, twilioAuthToken, and phoneNumber are required");
      }

      // 1. Buy on Twilio
      const buyUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;
      const buyRes = await fetch(buyUrl, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ PhoneNumber: phoneNumber }),
      });
      if (!buyRes.ok) {
        const errText = await buyRes.text();
        throw new Error(`Twilio buy failed [${buyRes.status}]: ${errText}`);
      }
      const purchased = await buyRes.json();

      // 2. Import to Vapi
      const vapiRes = await fetch(`${VAPI_BASE}/phone-number`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "twilio",
          number: purchased.phone_number,
          twilioAccountSid,
          twilioAuthToken,
        }),
      });
      if (!vapiRes.ok) {
        const errText = await vapiRes.text();
        // Number was bought but import failed - still return success with warning
        return new Response(JSON.stringify({
          purchased: { sid: purchased.sid, phoneNumber: purchased.phone_number },
          vapiImportError: errText,
          warning: "Number purchased on Twilio but failed to import to Vapi. You can import it manually.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const vapiNumber = await vapiRes.json();
      return new Response(JSON.stringify({
        purchased: { sid: purchased.sid, phoneNumber: purchased.phone_number },
        vapiNumber,
      }), {
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
