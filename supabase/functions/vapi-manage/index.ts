import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPI_BASE = "https://api.vapi.ai";
const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

// Normalize Australian phone numbers to E.164 format
function normalizeAUPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  // If starts with 0 (local AU format like 0412345678), convert to +61
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "+61" + cleaned.slice(1);
  }
  // If starts with 61 without +, add +
  if (
    cleaned.startsWith("61") &&
    !cleaned.startsWith("+") &&
    cleaned.length >= 11
  ) {
    cleaned = "+" + cleaned;
  }
  // Validate: must start with + and be 10-15 digits
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  return cleaned;
}

const VOICE_ID_MAP: Record<string, string> = {
  voice1: "DTLT09E2cxHF0DqjKVbc",
  voice2: "4yye0QE5YPsKbMOCGGlj",
  voice3: "w9rPM8AIZle60Nbpw7nl",
  voice4: "4uJW3zTppOdNDWtKUtux",
  voice5: "2nzji8yPQooBwG4eQO4s",
  voice6: "NMbn4FNN0acONjKLsueJ",
  voice7: "sclx1MZrNqboRcmLWoDb",
};

const VAPI_VOICE_FALLBACKS: Record<string, string> = {
  voice4: "Elliot",
  voice5: "Rohan",
  voice6: "Zac",
  voice7: "Dan",
};

function resolveVoiceId(shortId: string | undefined): string {
  if (!shortId) return VOICE_ID_MAP.voice1;
  return VOICE_ID_MAP[shortId] || shortId;
}

function resolveVoiceProvider(provider: string | undefined): string {
  if (!provider || provider === "elevenlabs") return "11labs";
  return provider;
}

function buildVoiceConfig(script: any, supabaseUrl: string) {
  const provider = resolveVoiceProvider(script.voice_provider);
  const shortVoiceId = script.voice_id;
  const voiceId = resolveVoiceId(shortVoiceId);

  if (provider === "11labs" && VAPI_VOICE_FALLBACKS[shortVoiceId]) {
    return {
      provider: "vapi",
      voiceId: VAPI_VOICE_FALLBACKS[shortVoiceId],
    };
  }

  return {
    provider,
    voiceId,
    inputMinCharacters: 10,
    fillerInjectionEnabled: false,
  };
}

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

function formatFollowUps(secondMessage: string | null | undefined): string {
  if (!secondMessage) return "";
  try {
    const parsed = JSON.parse(secondMessage);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return `\nFOLLOW-UP STATEMENTS (say these after the client responds to your opening message, before asking questions):\n${parsed.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n`;
    }
  } catch {
    /* not JSON, treat as single statement */
  }
  return `\nFOLLOW-UP STATEMENT (say this after the client responds to your opening message, before asking questions):\n"${secondMessage}"\n`;
}

function formatClosingStatements(closingStatements: string | null | undefined): string {
  if (!closingStatements) return "";
  try {
    const parsed = JSON.parse(closingStatements);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return `\nCLOSING STATEMENTS (use these to wrap up the call after all questions have been asked):\n${parsed.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n`;
    }
  } catch {
    /* not JSON, treat as single statement */
  }
  return `\nCLOSING STATEMENT (use this to wrap up the call after all questions have been asked):\n"${closingStatements}"\n`;
}

async function extractLeadAnswers(
  transcript: string,
  summary: string,
  questions: any[] = [],
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || !transcript?.trim()) return { fields: {}, summary };

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
              "Extract lead data from Australian superannuation call transcripts. Only use answers spoken by the client/User. Never guess. Leave unknown fields blank.",
          },
          {
            role: "user",
            content: `Campaign questions:\n${questionText}\n\nExisting summary:\n${summary || ""}\n\nTranscript:\n${transcript}\n\nReturn the client's answers for standard fields super_fund_name, balance, age, had_review_before and any campaign question fieldName. Balance must be raw digits if possible. had_review_before must be Yes, No, or blank.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_extracted_lead",
              description: "Save explicitly stated lead answers",
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
                  summary: { type: "string" },
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
    console.error(
      "lead reprocess extraction failed",
      resp.status,
      await resp.text(),
    );
    return { fields: {}, summary };
  }

  try {
    const result = await resp.json();
    const args =
      result.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : null;
    const fields = {
      super_fund_name: parsed?.super_fund_name,
      balance: parsed?.balance,
      age: parsed?.age,
      had_review_before: parsed?.had_review_before,
      ...(parsed?.campaign_answers || {}),
      ...(parsed?.fields || {}),
    };
    return {
      fields: stripEmptyFields(fields),
      summary: parsed?.summary || summary,
    };
  } catch {
    return { fields: {}, summary };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    if (!VAPI_API_KEY) throw new Error("VAPI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
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

      const secondMessage = formatFollowUps(script.second_message);
      const closingMsg = formatClosingStatements(script.closing_statements);

      const systemPrompt = `${script.system_prompt}

IMPORTANT RULES:
- You MUST follow this script exactly. Do not deviate or make up information.
- After your opening message, wait for the client to respond. Then deliver the follow-up statement(s) below (if provided).
- After the follow-up(s), ask each question one at a time and wait for the response before moving on.
- Be conversational and natural, like a real Australian person calling.
- If the person says they're not interested, politely thank them and end the call.
- If they ask who you are, say you're calling from Advisor Link.
- NEVER hallucinate or make up facts. Only relay information from your script.
${secondMessage}
QUESTIONS TO ASK (in order):
${questions.map((q: any, i: number) => `${i + 1}. ${q.question} (save their answer as "${q.fieldName}")`).join("\n")}
${closingMsg}
After all questions are asked, follow the closing statements above to wrap up the call.`;

      const assistantPayload: any = {
        name: script.name,
        model: {
          provider: "openai",
          model: script.model || "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }],
          tools:
            questions.length > 0
              ? [
                  {
                    type: "function",
                    function: {
                      name: "extract_lead_data",
                      description:
                        "Extract and save the lead's answers to qualification questions",
                      parameters: {
                        type: "object",
                        properties: extractionProperties,
                        required: questions.map((q: any) => q.fieldName),
                      },
                    },
                    async: false,
                  },
                ]
              : undefined,
        },
        voice: buildVoiceConfig(script, supabaseUrl),
        firstMessage: script.first_message || "Hi there, how are you today?",
        endCallFunctionEnabled: true,
        recordingEnabled: true,
        maxDurationSeconds: script.max_duration_seconds || 300,
        silenceTimeoutSeconds: 30,
        responseDelaySeconds: 0.5,
        backgroundSound: script.background_sound_enabled
          ? script.background_sound || "office"
          : undefined,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en-AU",
        },
        serverUrl: `${supabaseUrl}/functions/v1/vapi-webhook`,
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
        throw new Error(
          `Vapi create assistant failed [${vapiRes.status}]: ${errText}`,
        );
      }

      const assistant = await vapiRes.json();
      return new Response(JSON.stringify({ assistant }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-voices") {
      // Return curated Australian ElevenLabs community voices
      const voices = [
        {
          id: "voice1",
          name: "Olivia",
          accent: "Australian",
          gender: "Female",
          description: "Warm, professional",
        },
        {
          id: "voice2",
          name: "Jack",
          accent: "Australian",
          gender: "Male",
          description: "Confident, natural",
        },
        {
          id: "voice3",
          name: "Mia",
          accent: "Australian",
          gender: "Female",
          description: "Friendly, clear",
        },
        {
          id: "voice4",
          name: "Liam",
          accent: "Australian",
          gender: "Male",
          description: "Conversational, relaxed",
        },
        {
          id: "voice5",
          name: "Sophie",
          accent: "Australian",
          gender: "Female",
          description: "Energetic, bright",
        },
      ];
      return new Response(JSON.stringify({ voices }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "voice-previews") {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY)
        throw new Error("ELEVENLABS_API_KEY is not configured");

      const previews: Record<string, string> = {};
      for (const [shortId, elId] of Object.entries(VOICE_ID_MAP)) {
        try {
          const res = await fetch(
            `https://api.elevenlabs.io/v1/voices/${elId}`,
            {
              headers: { "xi-api-key": ELEVENLABS_API_KEY },
            },
          );
          if (res.ok) {
            const data = await res.json();
            if (data.preview_url) previews[shortId] = data.preview_url;
          }
        } catch {
          /* skip */
        }
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
        return new Response(
          JSON.stringify({
            error: "ELEVENLABS_API_KEY not configured",
            fallback: true,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
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
        },
      );

      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        throw new Error(`ElevenLabs TTS failed [${ttsRes.status}]: ${errText}`);
      }

      const audioBuffer = await ttsRes.arrayBuffer();
      const { encode: base64Encode } =
        await import("https://deno.land/std@0.168.0/encoding/base64.ts");
      const audioBase64 = base64Encode(audioBuffer);

      return new Response(JSON.stringify({ audioBase64 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "make-call") {
      const { assistantId, phoneNumber, contactId, campaignId } = body;

      const callPayload: any = {
        assistantId,
        customer: { number: normalizeAUPhone(phoneNumber) },
        phoneNumberId: body.phoneNumberId,
        metadata: { contactId, campaignId },
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
        throw new Error(
          `Vapi make call failed [${vapiRes.status}]: ${errText}`,
        );
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
      await supabase
        .from("ai_caller_contacts")
        .update({
          call_status: "calling",
          call_attempts: supabase.rpc ? 1 : 1,
          last_called_at: new Date().toISOString(),
          vapi_call_id: call.id,
        })
        .eq("id", contactId);

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
        throw new Error(
          `Vapi list phone numbers failed [${vapiRes.status}]: ${errText}`,
        );
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
      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error(
          "twilioAccountSid and twilioAuthToken are required for Vapi import",
        );
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
        throw new Error(
          `Vapi import number failed [${vapiRes.status}]: ${errText}`,
        );
      }
      const phoneNumber = await vapiRes.json();
      return new Response(JSON.stringify({ phoneNumber }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search-twilio-numbers") {
      const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      if (!TWILIO_SID) throw new Error("TWILIO_ACCOUNT_SID is not configured");
      const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      if (!TWILIO_TOKEN) throw new Error("TWILIO_AUTH_TOKEN is not configured");

      const { country, areaCode, contains } = body;
      const cc = country || "AU";
      const params = new URLSearchParams();
      if (areaCode) params.set("AreaCode", areaCode);
      if (contains) params.set("Contains", contains);
      params.set("VoiceEnabled", "true");
      params.set("PageSize", "20");

      const basicAuth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
      // Use main Twilio API (api.twilio.com) to avoid AU1 realm limitation
      const numberTypes = ["Local", "Mobile", "TollFree"];
      let twilioRes: Response | null = null;
      let lastErr = "";
      for (const numType of numberTypes) {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/${cc}/${numType}.json?${params.toString()}`,
          {
            headers: {
              Authorization: `Basic ${basicAuth}`,
            },
          },
        );
        if (res.ok) {
          twilioRes = res;
          break;
        }
        lastErr = await res.text();
        if (res.status === 404) continue;
        throw new Error(`Twilio search failed [${res.status}]: ${lastErr}`);
      }
      if (!twilioRes) {
        throw new Error(
          `No available number types found for ${cc}. Last error: ${lastErr}`,
        );
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
      const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      if (!TWILIO_SID) throw new Error("TWILIO_ACCOUNT_SID is not configured");
      const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      if (!TWILIO_TOKEN) throw new Error("TWILIO_AUTH_TOKEN is not configured");

      const { phoneNumber } = body;
      if (!phoneNumber) throw new Error("phoneNumber is required");

      const basicAuth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
      const ADDRESS_SID = Deno.env.get("TWILIO_ADDRESS_SID");

      // 1. Buy on Twilio directly (avoid AU1 realm issues)
      const buyParams: Record<string, string> = { PhoneNumber: phoneNumber };
      if (ADDRESS_SID) buyParams.AddressSid = ADDRESS_SID;

      const buyRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(buyParams),
        },
      );
      if (!buyRes.ok) {
        const errText = await buyRes.text();
        throw new Error(`Twilio buy failed [${buyRes.status}]: ${errText}`);
      }
      const purchased = await buyRes.json();

      // 2. Use stored credentials for Vapi import
      const twilioSid = TWILIO_SID;
      const twilioAuth = TWILIO_TOKEN;

      // 3. Import to Vapi
      const vapiRes = await fetch(`${VAPI_BASE}/phone-number`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "twilio",
          number: purchased.phone_number,
          twilioAccountSid: twilioSid,
          twilioAuthToken: twilioAuth,
        }),
      });
      if (!vapiRes.ok) {
        const errText = await vapiRes.text();
        return new Response(
          JSON.stringify({
            purchased: {
              sid: purchased.sid,
              phoneNumber: purchased.phone_number,
            },
            vapiImportError: errText,
            warning:
              "Number purchased on Twilio but failed to import to Vapi. You can import it manually.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const vapiNumber = await vapiRes.json();
      return new Response(
        JSON.stringify({
          purchased: {
            sid: purchased.sid,
            phoneNumber: purchased.phone_number,
          },
          vapiNumber,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "start-campaign") {
      const { campaignId } = body;
      if (!campaignId) throw new Error("campaignId is required");

      // Fetch campaign with script
      const { data: campaign, error: campErr } = await supabase
        .from("ai_caller_campaigns")
        .select("*, ai_caller_scripts(*)")
        .eq("id", campaignId)
        .single();
      if (campErr || !campaign) throw new Error("Campaign not found");

      const script = (campaign as any).ai_caller_scripts;
      if (!script) throw new Error("Campaign has no script");

      const phoneNumberId = (campaign as any).phone_number_id;
      if (!phoneNumberId)
        throw new Error(
          "Campaign has no phone number assigned. Edit the campaign and select a phone number.",
        );

      // Fetch pending contacts
      const { data: contacts } = await supabase
        .from("ai_caller_contacts")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("call_status", "pending");

      if (!contacts || contacts.length === 0)
        throw new Error("No pending contacts to call");

      // Create Vapi assistant from script
      const questions = script.questions || [];
      const extractionProperties: Record<string, any> = {};
      for (const q of questions) {
        extractionProperties[q.fieldName] = {
          type: "string",
          description: q.question,
        };
      }

      const secondMessage = formatFollowUps(script.second_message);

      const systemPrompt = `${script.system_prompt}

IMPORTANT RULES:
- You MUST follow this script exactly. Do not deviate or make up information.
- After your opening message, wait for the client to respond. Then deliver the follow-up statement(s) below (if provided).
- After the follow-up(s), ask each question one at a time and wait for the response before moving on.
- Be conversational and natural, like a real Australian person calling.
- If the person says they're not interested, politely thank them and end the call.
- If they ask who you are, say you're calling from Advisor Link.
- NEVER hallucinate or make up facts. Only relay information from your script.
${secondMessage}
QUESTIONS TO ASK (in order):
${questions.map((q: any, i: number) => `${i + 1}. ${q.question} (save their answer as "${q.fieldName}")`).join("\n")}

After all questions are asked, thank them for their time and let them know someone will be in touch.`;

      const assistantPayload: any = {
        name: `${script.name} - Campaign`,
        model: {
          provider: "openai",
          model: script.model || "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }],
          tools:
            questions.length > 0
              ? [
                  {
                    type: "function",
                    function: {
                      name: "extract_lead_data",
                      description:
                        "Extract and save the lead's answers to qualification questions",
                      parameters: {
                        type: "object",
                        properties: extractionProperties,
                        required: questions.map((q: any) => q.fieldName),
                      },
                    },
                    async: false,
                  },
                ]
              : undefined,
        },
        voice: buildVoiceConfig(script, supabaseUrl),
        firstMessage: script.first_message || "Hi there, how are you today?",
        endCallFunctionEnabled: true,
        recordingEnabled: true,
        maxDurationSeconds: script.max_duration_seconds || 300,
        silenceTimeoutSeconds: 30,
        responseDelaySeconds: 0.5,
        backgroundSound: script.background_sound_enabled
          ? script.background_sound || "office"
          : undefined,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en-AU",
        },
        serverUrl: `${supabaseUrl}/functions/v1/vapi-webhook`,
      };

      const assistantRes = await fetch(`${VAPI_BASE}/assistant`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assistantPayload),
      });
      if (!assistantRes.ok) {
        const errText = await assistantRes.text();
        throw new Error(`Failed to create assistant: ${errText}`);
      }
      const assistant = await assistantRes.json();

      // Update campaign status
      await supabase
        .from("ai_caller_campaigns")
        .update({
          status: "active",
          started_at: new Date().toISOString(),
        } as any)
        .eq("id", campaignId);

      // Start calling contacts (fire calls with small delays)
      const results: any[] = [];

      for (const contact of contacts) {
        try {
          const callPayload = {
            assistantId: assistant.id,
            customer: { number: normalizeAUPhone(contact.phone) },
            phoneNumberId,
            metadata: { contactId: contact.id, campaignId },
          };

          const callRes = await fetch(`${VAPI_BASE}/call/phone`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${VAPI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(callPayload),
          });

          if (!callRes.ok) {
            const errText = await callRes.text();
            console.error(`Call failed for ${contact.phone}:`, errText);
            results.push({
              contactId: contact.id,
              phone: contact.phone,
              error: errText,
            });
            continue;
          }

          const call = await callRes.json();

          // Log the call
          await supabase.from("ai_caller_call_logs").insert({
            campaign_id: campaignId,
            contact_id: contact.id,
            vapi_call_id: call.id,
            status: "initiated",
            started_at: new Date().toISOString(),
          });

          // Update contact
          await supabase
            .from("ai_caller_contacts")
            .update({
              call_status: "calling",
              call_attempts: (contact.call_attempts || 0) + 1,
              last_called_at: new Date().toISOString(),
              vapi_call_id: call.id,
            })
            .eq("id", contact.id);

          results.push({
            contactId: contact.id,
            phone: contact.phone,
            callId: call.id,
          });

          // Small delay between calls to avoid rate limiting
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          console.error(`Error calling ${contact.phone}:`, err);
          results.push({
            contactId: contact.id,
            phone: contact.phone,
            error: err.message,
          });
        }
      }

      return new Response(
        JSON.stringify({
          assistantId: assistant.id,
          callsInitiated: results.filter((r) => r.callId).length,
          callsFailed: results.filter((r) => r.error).length,
          results,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "stop-campaign") {
      const { campaignId } = body;
      if (!campaignId) throw new Error("campaignId is required");

      // Update campaign status
      await supabase
        .from("ai_caller_campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        } as any)
        .eq("id", campaignId);

      // Get active calls for this campaign
      const { data: activeCalls } = await supabase
        .from("ai_caller_call_logs")
        .select("vapi_call_id")
        .eq("campaign_id", campaignId)
        .eq("status", "initiated");

      // End active calls via Vapi
      let ended = 0;
      for (const call of activeCalls || []) {
        if (!call.vapi_call_id) continue;
        try {
          const endRes = await fetch(`${VAPI_BASE}/call/${call.vapi_call_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
          });
          if (endRes.ok) ended++;
          await endRes.text();
        } catch {
          /* best effort */
        }
      }

      return new Response(
        JSON.stringify({ stopped: true, callsEnded: ended }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "pause-campaign") {
      const { campaignId } = body;
      if (!campaignId) throw new Error("campaignId is required");

      await supabase
        .from("ai_caller_campaigns")
        .update({
          status: "paused",
        } as any)
        .eq("id", campaignId);

      return new Response(JSON.stringify({ paused: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resume-campaign") {
      const { campaignId } = body;
      if (!campaignId) throw new Error("campaignId is required");

      await supabase
        .from("ai_caller_campaigns")
        .update({
          status: "active",
        } as any)
        .eq("id", campaignId);

      return new Response(JSON.stringify({ resumed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset-campaign") {
      const { campaignId } = body;
      if (!campaignId) throw new Error("campaignId is required");

      // Reset campaign status back to draft
      await supabase
        .from("ai_caller_campaigns")
        .update({
          status: "draft",
          started_at: null,
          completed_at: null,
          calls_completed: 0,
          calls_answered: 0,
          leads_generated: 0,
        } as any)
        .eq("id", campaignId);

      // Reset all contacts back to pending
      await supabase
        .from("ai_caller_contacts")
        .update({
          call_status: "pending",
          call_attempts: 0,
          last_called_at: null,
          vapi_call_id: null,
        } as any)
        .eq("campaign_id", campaignId);

      // Delete call logs for this campaign
      await supabase
        .from("ai_caller_call_logs")
        .delete()
        .eq("campaign_id", campaignId);

      return new Response(JSON.stringify({ reset: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reprocess-lead") {
      const { leadId } = body;
      if (!leadId) throw new Error("leadId is required");

      const { data: lead, error: leadErr } = await supabase
        .from("ai_caller_leads")
        .select("*")
        .eq("id", leadId)
        .single();
      if (leadErr || !lead) throw new Error("Lead not found");

      let transcript = (lead as any).full_transcript || "";
      let recordingUrl = (lead as any).recording_url || null;
      if ((lead as any).contact_id && (!transcript || !recordingUrl)) {
        const { data: log } = await supabase
          .from("ai_caller_call_logs")
          .select("transcript, recording_url")
          .eq("contact_id", (lead as any).contact_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        transcript = transcript || log?.transcript || "";
        recordingUrl = recordingUrl || log?.recording_url || null;
      }

      let questions: any[] = [];
      if ((lead as any).campaign_id) {
        const { data: campaign } = await supabase
          .from("ai_caller_campaigns")
          .select("ai_caller_scripts(questions)")
          .eq("id", (lead as any).campaign_id)
          .single();
        questions = (campaign as any)?.ai_caller_scripts?.questions || [];
      }

      const existingFields = ((lead as any).extracted_fields || {}) as Record<
        string,
        unknown
      >;
      const extracted = hasMeaningfulFields(existingFields)
        ? {
            fields: existingFields,
            summary: (lead as any).transcript_summary || "",
          }
        : await extractLeadAnswers(
            transcript,
            (lead as any).transcript_summary || "",
            questions,
          );

      const updates = {
        extracted_fields: stripEmptyFields({
          ...existingFields,
          ...extracted.fields,
        }),
        transcript_summary:
          extracted.summary || (lead as any).transcript_summary,
        full_transcript: transcript || (lead as any).full_transcript,
        recording_url: recordingUrl,
      } as any;

      const { data: updated, error: updateErr } = await supabase
        .from("ai_caller_leads")
        .update(updates)
        .eq("id", leadId)
        .select()
        .single();
      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ lead: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stop-call") {
      const { callId } = body;
      if (!callId) throw new Error("callId (vapi_call_id) is required");

      // Try to end the call on Vapi
      try {
        const endRes = await fetch(`${VAPI_BASE}/call/${callId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
        });
        await endRes.text();
      } catch {
        /* best effort */
      }

      // Update call log status
      await supabase
        .from("ai_caller_call_logs")
        .update({
          status: "failed",
          error_message: "Manually stopped",
          ended_at: new Date().toISOString(),
        })
        .eq("vapi_call_id", callId);

      return new Response(JSON.stringify({ stopped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-call-log") {
      const { logId } = body;
      if (!logId) throw new Error("logId is required");
      await supabase.from("ai_caller_call_logs").delete().eq("id", logId);
      return new Response(JSON.stringify({ deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "clear-call-logs") {
      await supabase
        .from("ai_caller_call_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      return new Response(JSON.stringify({ cleared: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "assign-inbound-script") {
      const { phoneNumberId, scriptId } = body;
      if (!phoneNumberId) throw new Error("phoneNumberId is required");

      if (!scriptId) {
        // Remove inbound assistant from number
        const vapiRes = await fetch(`${VAPI_BASE}/phone-number/${phoneNumberId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assistantId: null }),
        });
        if (!vapiRes.ok) {
          const errText = await vapiRes.text();
          throw new Error(`Failed to remove inbound assistant [${vapiRes.status}]: ${errText}`);
        }
        return new Response(JSON.stringify({ success: true, removed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch the script
      const { data: script, error: scriptErr } = await supabase
        .from("ai_caller_scripts")
        .select("*")
        .eq("id", scriptId)
        .single();
      if (scriptErr || !script) throw new Error("Script not found");

      // Build assistant for inbound
      const questions = (script as any).questions || [];
      const extractionProperties: Record<string, any> = {};
      for (const q of questions) {
        extractionProperties[q.fieldName] = { type: "string", description: q.question };
      }

      const secondMessage = formatFollowUps((script as any).second_message);

      const systemPrompt = `${(script as any).system_prompt}

IMPORTANT RULES:
- This is an INBOUND call — the person called YOU. Be welcoming and helpful.
- You MUST follow this script exactly. Do not deviate or make up information.
- After your greeting, wait for the caller to respond. Then deliver the follow-up statement(s) below (if provided).
- After the follow-up(s), ask each question one at a time and wait for the response before moving on.
- Be conversational and natural, like a real Australian person.
- If they ask who you are, say you're from Advisor Link.
- NEVER hallucinate or make up facts. Only relay information from your script.
${secondMessage}
QUESTIONS TO ASK (in order):
${questions.map((q: any, i: number) => `${i + 1}. ${q.question} (save their answer as "${q.fieldName}")`).join("\n")}

After all questions are asked, thank them for their time and let them know someone will be in touch.`;

      const assistantPayload: any = {
        name: `${(script as any).name} - Inbound`,
        model: {
          provider: "openai",
          model: (script as any).model || "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }],
          tools: questions.length > 0 ? [{
            type: "function",
            function: {
              name: "extract_lead_data",
              description: "Extract and save the caller's answers to qualification questions",
              parameters: {
                type: "object",
                properties: extractionProperties,
                required: questions.map((q: any) => q.fieldName),
              },
            },
            async: false,
          }] : undefined,
        },
        voice: buildVoiceConfig(script as any, supabaseUrl),
        firstMessage: (script as any).first_message || "G'day! Thanks for calling Advisor Link. How can I help you today?",
        endCallFunctionEnabled: true,
        recordingEnabled: true,
        maxDurationSeconds: (script as any).max_duration_seconds || 300,
        silenceTimeoutSeconds: 30,
        responseDelaySeconds: 0.5,
        backgroundSound: (script as any).background_sound_enabled
          ? (script as any).background_sound || "office"
          : undefined,
        transcriber: { provider: "deepgram", model: "nova-2", language: "en-AU" },
        serverUrl: `${supabaseUrl}/functions/v1/vapi-webhook`,
      };

      // Create the assistant
      const assistantRes = await fetch(`${VAPI_BASE}/assistant`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assistantPayload),
      });
      if (!assistantRes.ok) {
        const errText = await assistantRes.text();
        throw new Error(`Vapi create inbound assistant failed [${assistantRes.status}]: ${errText}`);
      }
      const assistant = await assistantRes.json();

      // Assign to phone number
      const patchRes = await fetch(`${VAPI_BASE}/phone-number/${phoneNumberId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assistantId: assistant.id }),
      });
      if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new Error(`Failed to assign assistant to number [${patchRes.status}]: ${errText}`);
      }

      return new Response(JSON.stringify({ success: true, assistantId: assistant.id }), {
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
