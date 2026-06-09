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
  const endRule = `\nEND-OF-CALL RULE (CRITICAL):\n- Deliver the FINAL closing statement EXACTLY as written below — word-for-word, no paraphrasing, no additions.\n- Do NOT say "one moment", "okay", "alright", "bye", "goodbye", "have a great day", or ANY extra words after the final closing statement.\n- The moment you finish speaking the final closing statement, immediately call the end_call function to hang up.\n- Do NOT add any goodbye filler. The closing statement IS the goodbye.\n`;
  if (!closingStatements) return endRule;
  try {
    const parsed = JSON.parse(closingStatements);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return `\nCLOSING STATEMENTS (deliver these in order to wrap up the call after all questions have been asked — say each one EXACTLY as written):\n${parsed.map((s: string, i: number) => `${i + 1}. "${s}"`).join("\n")}\n${endRule}`;
    }
  } catch {
    /* not JSON, treat as single statement */
  }
  return `\nCLOSING STATEMENT (say this EXACTLY as written to wrap up the call after all questions have been asked):\n"${closingStatements}"\n${endRule}`;
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

    if (action === "refresh-voicemail-config") {
      // PATCH every existing Vapi assistant to add machine-detection / voicemail config,
      // leaving every other setting untouched.
      // Aggressive multi-signal voicemail detection. We use Twilio's AMD
      // (analyses call audio before bridging) tuned to wait until the
      // greeting ends, then layer Vapi's beep classifier on top. The
      // assistant NEVER speaks first (firstMessageMode below), and we hang
      // up immediately if anything looks like a machine.
      const voicemailDetection = {
        provider: "twilio",
        enabled: true,
        voicemailDetectionTypes: [
          "machine_end_beep",
          "machine_end_silence",
          "machine_end_other",
          "unknown",
        ],
        machineDetectionTimeout: 30,
        machineDetectionSpeechThreshold: 2400,
        machineDetectionSpeechEndThreshold: 1500,
        machineDetectionSilenceTimeout: 5000,
      };

      const listRes = await fetch(`${VAPI_BASE}/assistant?limit=1000`, {
        headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
      });
      if (!listRes.ok) {
        const txt = await listRes.text();
        throw new Error(`Vapi list assistants failed [${listRes.status}]: ${txt}`);
      }
      const assistants = await listRes.json();
      const list: any[] = Array.isArray(assistants) ? assistants : (assistants.data || []);

      const results: Array<{ id: string; name?: string; ok: boolean; error?: string }> = [];
      const runPatches = async () => {
        for (const a of list) {
          let attempt = 0;
          let done = false;
          while (!done && attempt < 6) {
            attempt++;
            try {
              const patchRes = await fetch(`${VAPI_BASE}/assistant/${a.id}`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${VAPI_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  voicemailDetection,
                  voicemailMessage: "",
                  endCallMessage: "",
                  firstMessageMode: "assistant-waits-for-user",
                  // Silent-pickup fallback: if the human picks up but doesn't
                  // say anything within 4 seconds, prompt them once or twice
                  // so the AI doesn't sit awkwardly silent.
                  messagePlan: {
                    idleMessages: ["Hello? Are you there?"],
                    idleTimeoutSeconds: 5,
                    idleMessageMaxSpokenCount: 2,
                  },
                }),
              });
              if (patchRes.status === 429) {
                await patchRes.text();
                // Exponential backoff: 2s, 4s, 8s, 16s, 32s
                await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
                continue;
              }
              if (!patchRes.ok) {
                const txt = await patchRes.text();
                console.log("voicemail patch failed", a.id, patchRes.status, txt.slice(0, 200));
                results.push({ id: a.id, name: a.name, ok: false, error: `${patchRes.status}` });
              } else {
                await patchRes.text();
                results.push({ id: a.id, name: a.name, ok: true });
              }
              done = true;
            } catch (e) {
              console.log("voicemail patch error", a.id, e);
              results.push({ id: a.id, name: a.name, ok: false, error: String(e) });
              done = true;
            }
          }
          if (!done) {
            results.push({ id: a.id, name: a.name, ok: false, error: "rate-limited after retries" });
          }
          // Base throttle between assistants to stay well under Vapi's per-second limit
          await new Promise((r) => setTimeout(r, 1500));
        }
        console.log(
          "voicemail refresh complete:",
          `total=${list.length} updated=${results.filter((r) => r.ok).length} failed=${results.filter((r) => !r.ok).length}`,
        );
      };

      // Fire-and-forget so the HTTP request returns immediately.
      // @ts-ignore EdgeRuntime is a Deno Deploy global
      EdgeRuntime.waitUntil(runPatches());

      return new Response(
        JSON.stringify({ started: true, total: list.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }



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

PERSONALITY & SPEAKING STYLE:
- You are a real, genuine-sounding person having a natural phone conversation. Use filler words occasionally like "yeah", "look", "so", "actually", "to be honest" — the way a real person talks.
- Vary your sentence length. Don't sound scripted or robotic. React naturally to what the person says — laugh if something's funny, show empathy if they mention something tough.
- Use casual Australian-friendly language. Say things like "no worries", "all good", "mate" (sparingly), "how are you going" rather than "how are you doing".
- Mirror the client's energy — if they're chatty, be chatty back. If they're brief, keep it tight.
- NEVER sound like you're reading from a script. Paraphrase the questions in your own words rather than reading them robotically word-for-word.

HONESTY ABOUT BEING AI:
- If the client asks "Are you a real person?", "Are you AI?", "Am I talking to a robot?" or anything similar — you MUST be 100% honest.
- Say something like: "Yeah, I'm actually an AI assistant working for Compare Direct! It's way more cost-effective for me to give you a call and get this sorted — I don't take lunch breaks, I never call in sick, and I'm available around the clock. Pretty handy, right?"
- Be proud and humorous about it, not apologetic. Then smoothly continue with the conversation.
- NEVER lie and say you are a human. NEVER dodge the question.

CORE RULES:
- Follow the script instructions above as your primary guide.
- If the first audio you hear sounds like voicemail, an answering machine, a recorded greeting, a beep, or "leave a message", do not leave any message and call the end_call function immediately.
- After your opening message, wait for the client to respond before continuing.
- If follow-up statements are provided below, deliver them naturally after the client responds to your greeting.
- Then ask each question one at a time, waiting for a response before moving on.
- NEVER make up facts or information not in your script.
- Listen carefully to what the client says and respond appropriately — don't talk over them or ignore their answers.
- As long as the client is engaged and willing, make sure you ask EVERY question listed below. Do not skip questions or rush to end the call early when the client is happy to chat.
- Keep your responses short and concise — one or two sentences max before asking the next question.
- When ending the call, deliver the CLOSING STATEMENTS exactly as written below, then immediately hang up. Do NOT improvise extra goodbyes like "one moment" or "bye" after the final closing line.

INTEREST DETECTION:
- Do NOT assume the client is uninterested just because they give short answers, sound unsure, or ask clarifying questions. These are totally normal.
- Only treat someone as "not interested" if they EXPLICITLY say things like "no thanks", "I'm not interested", "please don't call me", "take me off your list", or similar clear refusals.
- If someone says "maybe", "I'm not sure", "what's this about?", or asks questions — they ARE engaged. Keep going.
- If the person genuinely isn't interested, respect that — thank them warmly, wish them a great day, and end the call nicely.

ACCURACY WITH NAMES, EMAILS & NUMBERS:
- When the client tells you their NAME, repeat it back naturally. For example: "Sarah — lovely name."
- EMAIL ADDRESSES: Listen VERY carefully when the client says their email. Do NOT read the email back to them — just accept it and move on. Only ask them to repeat it if the audio was genuinely unclear or you couldn't hear them. Trust what they said. NEVER guess or make up an email address — if you truly couldn't hear it, say something like "Sorry, I didn't quite catch that — could you say your email one more time for me?"
- Say numbers naturally as words. Say "twenty-four to forty-eight hours" NOT "24 to 48 hours". Say "three hundred thousand" NOT "$300,000".
- If you're unsure about ANY detail other than email, just ask them to repeat it. Better to double-check than get it wrong.

PACING:
- After the client says hello or introduces themselves for the FIRST time, pause for a brief moment before you start speaking. Don't jump in immediately — let them finish. Take a breath, then respond naturally.
- After that first exchange, respond QUICKLY. Once they answer your greeting (e.g. "Good thanks", "Yeah not bad"), jump straight in with your next line — no awkward pauses. Keep the conversation flowing at a natural, brisk pace.

${secondMessage}
QUESTIONS TO ASK (ask all of these in order, as long as the client is willing — but paraphrase them naturally, don't read them word-for-word):
${questions.map((q: any, i: number) => `${i + 1}. ${q.question} (save their answer as "${q.fieldName}")`).join("\n")}
${closingMsg}
After all questions have been asked (or if the client wants to end early), go straight into the CLOSING STATEMENTS above. Say the final closing statement EXACTLY as written and then immediately end the call. Do NOT add "one moment", "okay", "bye", or any other words after the final closing statement — the closing statement IS the goodbye.`;

      const assistantPayload: any = {
        name: (script.name || "Assistant").substring(0, 40),
        model: {
          provider: "openai",
          model: script.model || "gpt-4o",
          maxTokens: 512,
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
        firstMessageMode: "assistant-waits-for-user",
        endCallFunctionEnabled: true,
        recordingEnabled: true,
        maxDurationSeconds: script.max_duration_seconds || 300,
        silenceTimeoutSeconds: 30,
        voicemailDetection: {
          provider: "twilio",
          enabled: true,
          voicemailDetectionTypes: [
            "machine_end_beep",
            "machine_end_silence",
            "machine_end_other",
            "unknown",
          ],
          machineDetectionTimeout: 30,
          machineDetectionSpeechThreshold: 2400,
          machineDetectionSpeechEndThreshold: 1500,
          machineDetectionSilenceTimeout: 5000,
        },
        voicemailMessage: "",
        endCallMessage: "",
        messagePlan: {
          idleMessages: ["Hello? Are you there?"],
          idleTimeoutSeconds: 5,
          idleMessageMaxSpokenCount: 2,
        },
        responseDelaySeconds: 0.3,
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
      const { number } = body;
      if (!number) {
        throw new Error("number (E.164) is required");
      }
      // Use stored Twilio credentials, with optional overrides from body
      const twilioAccountSid = body.twilioAccountSid || Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = body.twilioAuthToken || Deno.env.get("TWILIO_AUTH_TOKEN");
      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error(
          "Twilio credentials not found. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN secrets.",
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

    if (action === "auto-buy-telnyx-number") {
      const TELNYX_KEY = Deno.env.get("TELNYX_API_KEY");
      if (!TELNYX_KEY) throw new Error("TELNYX_API_KEY is not configured");

      const { country, preferPrefix } = body;
      const cc = country || "AU";
      const params = new URLSearchParams();
      params.set("filter[country_code]", cc);
      params.set("filter[features][]", "sms");
      params.set("filter[features][]", "voice");
      params.set("page[size]", "20");

      const searchRes = await fetch(`https://api.telnyx.com/v2/available_phone_numbers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${TELNYX_KEY}` },
      });
      if (!searchRes.ok) {
        const errText = await searchRes.text();
        throw new Error(`Telnyx search failed [${searchRes.status}]: ${errText}`);
      }
      const searchResult = await searchRes.json();
      const allNumbers = searchResult.data || [];
      
      // Filter by prefix if requested, otherwise pick first cheap one
      let picked = allNumbers.find((n: any) => {
        const pn = n.phone_number || "";
        if (preferPrefix) return pn.startsWith(preferPrefix);
        // Prefer $2 numbers over $15/$50 ones
        const cost = parseFloat(n.cost_information?.upfront_cost || "999");
        return cost <= 5;
      });
      if (!picked && allNumbers.length > 0) picked = allNumbers[0];
      if (!picked) throw new Error("No available numbers found");

      const phoneNumber = picked.phone_number;
      console.log("Auto-buying Telnyx number:", phoneNumber);

      // Order it
      const orderRes = await fetch("https://api.telnyx.com/v2/number_orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TELNYX_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone_numbers: [{ phone_number: phoneNumber }] }),
      });
      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new Error(`Telnyx order failed [${orderRes.status}]: ${errText}`);
      }
      const orderData = await orderRes.json();

      return new Response(JSON.stringify({
        purchased: {
          phoneNumber,
          orderId: orderData.data?.id,
          status: orderData.data?.status || "pending",
          cost: picked.cost_information,
        },
        provider: "telnyx",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search-telnyx-numbers") {
      const TELNYX_KEY = Deno.env.get("TELNYX_API_KEY");
      if (!TELNYX_KEY) throw new Error("TELNYX_API_KEY is not configured");

      const { country, contains, locality } = body;
      const cc = country || "AU";
      const params = new URLSearchParams();
      params.set("filter[country_code]", cc);
      params.set("filter[features][]", "sms");
      params.set("filter[features][]", "voice");
      if (contains) params.set("filter[phone_number][contains]", contains);
      if (locality) params.set("filter[locality]", locality);
      params.set("page[size]", "20");

      const res = await fetch(`https://api.telnyx.com/v2/available_phone_numbers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${TELNYX_KEY}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Telnyx search failed [${res.status}]: ${errText}`);
      }
      const result = await res.json();
      const numbers = (result.data || []).map((n: any) => ({
        phoneNumber: n.phone_number,
        friendlyName: n.phone_number,
        locality: n.region_information?.[0]?.region_name || "",
        region: n.region_information?.[0]?.region_type || "",
        capabilities: { voice: true, sms: true },
        costMonthly: n.cost_information?.monthly_cost || "N/A",
        costUpfront: n.cost_information?.upfront_cost || "N/A",
      }));
      return new Response(JSON.stringify({ numbers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "buy-telnyx-number") {
      const TELNYX_KEY = Deno.env.get("TELNYX_API_KEY");
      if (!TELNYX_KEY) throw new Error("TELNYX_API_KEY is not configured");

      const { phoneNumber } = body;
      if (!phoneNumber) throw new Error("phoneNumber is required");

      // Create a number order on Telnyx
      const orderRes = await fetch("https://api.telnyx.com/v2/number_orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TELNYX_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_numbers: [{ phone_number: phoneNumber }],
        }),
      });
      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new Error(`Telnyx order failed [${orderRes.status}]: ${errText}`);
      }
      const orderData = await orderRes.json();

      // Set up messaging profile for the number (enable SMS)
      // The number should be ready after ordering

      return new Response(JSON.stringify({
        purchased: {
          phoneNumber,
          orderId: orderData.data?.id,
          status: orderData.data?.status || "pending",
        },
        provider: "telnyx",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import-telnyx-number") {
      const { number, sipUsername, sipPassword } = body;
      if (!number) throw new Error("number (E.164) is required");

      // For Telnyx, we import as a BYO SIP trunk + BYO phone number into Vapi
      // First, create SIP trunk credential if sip credentials provided
      let credentialId = body.credentialId;

      if (!credentialId && sipUsername && sipPassword) {
        const credRes = await fetch(`${VAPI_BASE}/credential`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "byo-sip-trunk",
            name: "Telnyx Trunk",
            gateways: [
              { ip: "192.76.120.10", inboundEnabled: true },
              { ip: "64.16.250.10", inboundEnabled: true },
            ],
            outboundAuthenticationPlan: {
              authUsername: sipUsername,
              authPassword: sipPassword,
              sipRegisterPlan: { realm: "sip.telnyx.com" },
            },
          }),
        });
        if (!credRes.ok) {
          const errText = await credRes.text();
          throw new Error(`Vapi create SIP credential failed [${credRes.status}]: ${errText}`);
        }
        const credData = await credRes.json();
        credentialId = credData.id;
      }

      if (!credentialId) {
        throw new Error("Either provide sipUsername+sipPassword or an existing credentialId");
      }

      // Now register the phone number with Vapi as BYO
      const vapiRes = await fetch(`${VAPI_BASE}/phone-number`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "byo-phone-number",
          name: `Telnyx ${number}`,
          number,
          numberE164CheckEnabled: false,
          credentialId,
        }),
      });
      if (!vapiRes.ok) {
        const errText = await vapiRes.text();
        throw new Error(`Vapi import Telnyx number failed [${vapiRes.status}]: ${errText}`);
      }
      const phoneNumber = await vapiRes.json();
      return new Response(JSON.stringify({ phoneNumber }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

      if (!contacts || contacts.length === 0) {
        await supabase
          .from("ai_caller_campaigns")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", campaignId);

        return new Response(
          JSON.stringify({
            success: true,
            noPendingContacts: true,
            callsInitiated: 0,
            callsFailed: 0,
            message: "No pending contacts left to call",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

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
      const closingMsg = formatClosingStatements(script.closing_statements);

      const systemPrompt = `${script.system_prompt}

PERSONALITY & SPEAKING STYLE:
- You are a real, genuine-sounding person having a natural phone conversation. Use filler words occasionally like "yeah", "look", "so", "actually", "to be honest" — the way a real person talks.
- Vary your sentence length. Don't sound scripted or robotic. React naturally to what the person says — laugh if something's funny, show empathy if they mention something tough.
- Use casual Australian-friendly language. Say things like "no worries", "all good", "mate" (sparingly), "how are you going" rather than "how are you doing".
- Mirror the client's energy — if they're chatty, be chatty back. If they're brief, keep it tight.
- NEVER sound like you're reading from a script. Paraphrase the questions in your own words rather than reading them robotically word-for-word.

HONESTY ABOUT BEING AI:
- If the client asks "Are you a real person?", "Are you AI?", "Am I talking to a robot?" or anything similar — you MUST be 100% honest.
- Say something like: "Yeah, I'm actually an AI assistant working for Compare Direct! It's way more cost-effective for me to give you a call and get this sorted — I don't take lunch breaks, I never call in sick, and I'm available around the clock. Pretty handy, right?"
- Be proud and humorous about it, not apologetic. Then smoothly continue with the conversation.
- NEVER lie and say you are a human. NEVER dodge the question.

CORE RULES:
- Follow the script instructions above as your primary guide.
- If the first audio you hear sounds like voicemail, an answering machine, a recorded greeting, a beep, or "leave a message", do not leave any message and call the end_call function immediately.
- After your opening message, wait for the client to respond before continuing.
- If follow-up statements are provided below, deliver them naturally after the client responds to your greeting.
- Then ask each question one at a time, waiting for a response before moving on.
- NEVER make up facts or information not in your script.
- Listen carefully to what the client says and respond appropriately — don't talk over them or ignore their answers.
- As long as the client is engaged and willing, make sure you ask EVERY question listed below. Do not skip questions or rush to end the call early when the client is happy to chat.
- Keep your responses short and concise — one or two sentences max before asking the next question.
- When ending the call, deliver the CLOSING STATEMENTS exactly as written below, then immediately hang up. Do NOT improvise extra goodbyes like "one moment" or "bye" after the final closing line.

INTEREST DETECTION:
- Do NOT assume the client is uninterested just because they give short answers, sound unsure, or ask clarifying questions. These are totally normal.
- Only treat someone as "not interested" if they EXPLICITLY say things like "no thanks", "I'm not interested", "please don't call me", "take me off your list", or similar clear refusals.
- If someone says "maybe", "I'm not sure", "what's this about?", or asks questions — they ARE engaged. Keep going.
- If the person genuinely isn't interested, respect that — thank them warmly, wish them a great day, and end the call nicely.

ACCURACY WITH NAMES, EMAILS & NUMBERS:
- When the client tells you their NAME, repeat it back naturally. For example: "Sarah — lovely name."
- EMAIL ADDRESSES: Listen VERY carefully when the client says their email. Do NOT read the email back to them — just accept it and move on. Only ask them to repeat it if the audio was genuinely unclear or you couldn't hear them. Trust what they said. NEVER guess or make up an email address — if you truly couldn't hear it, say something like "Sorry, I didn't quite catch that — could you say your email one more time for me?"
- Say numbers naturally as words. Say "twenty-four to forty-eight hours" NOT "24 to 48 hours". Say "three hundred thousand" NOT "$300,000".
- If you're unsure about ANY detail other than email, just ask them to repeat it. Better to double-check than get it wrong.

PACING:
- After the client says hello or introduces themselves for the FIRST time, pause for a brief moment before you start speaking. Don't jump in immediately — let them finish. Take a breath, then respond naturally.
- After that first exchange, respond QUICKLY. Once they answer your greeting (e.g. "Good thanks", "Yeah not bad"), jump straight in with your next line — no awkward pauses. Keep the conversation flowing at a natural, brisk pace.

${secondMessage}
QUESTIONS TO ASK (ask all of these in order, as long as the client is willing — but paraphrase them naturally, don't read them word-for-word):
${questions.map((q: any, i: number) => `${i + 1}. ${q.question} (save their answer as "${q.fieldName}")`).join("\n")}
${closingMsg}
After all questions have been asked (or if the client wants to end early), go straight into the CLOSING STATEMENTS above. Say the final closing statement EXACTLY as written and then immediately end the call. Do NOT add "one moment", "okay", "bye", or any other words after the final closing statement — the closing statement IS the goodbye.`;

      const assistantPayload: any = {
        name: `${script.name} - Campaign`.substring(0, 40),
        model: {
          provider: "openai",
          model: script.model || "gpt-4o",
          maxTokens: 512,
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
        firstMessageMode: "assistant-waits-for-user",
        endCallFunctionEnabled: true,
        recordingEnabled: true,
        maxDurationSeconds: script.max_duration_seconds || 300,
        silenceTimeoutSeconds: 30,
        voicemailDetection: {
          provider: "twilio",
          enabled: true,
          voicemailDetectionTypes: [
            "machine_end_beep",
            "machine_end_silence",
            "machine_end_other",
            "unknown",
          ],
          machineDetectionTimeout: 30,
          machineDetectionSpeechThreshold: 2400,
          machineDetectionSpeechEndThreshold: 1500,
          machineDetectionSilenceTimeout: 5000,
        },
        voicemailMessage: "",
        endCallMessage: "",
        messagePlan: {
          idleMessages: ["Hello? Are you there?"],
          idleTimeoutSeconds: 5,
          idleMessageMaxSpokenCount: 2,
        },
        responseDelaySeconds: 0.3,
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

      // Save the assistant id on the campaign and mark active. The paced
      // ticker (vapi-campaign-tick) will fire one call at a time according
      // to the campaign's pacing rules.
      await supabase
        .from("ai_caller_campaigns")
        .update({
          status: "active",
          started_at: new Date().toISOString(),
          vapi_assistant_id: assistant.id,
          last_call_finished_at: null,
        } as any)
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({
          assistantId: assistant.id,
          status: "active",
          pendingContacts: contacts.length,
          message:
            "Campaign started. Calls will be dialled by the paced ticker.",
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

    if (action === "delete-phone-number") {
      const { phoneNumberId } = body;
      if (!phoneNumberId) throw new Error("phoneNumberId is required");

      const vapiRes = await fetch(`${VAPI_BASE}/phone-number/${phoneNumberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
      });
      if (!vapiRes.ok) {
        const errText = await vapiRes.text();
        throw new Error(`Vapi delete phone number failed [${vapiRes.status}]: ${errText}`);
      }
      const result = await vapiRes.json();
      return new Response(JSON.stringify({ deleted: true, result }), {
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

      // Look up the actual E.164 number from Vapi so we can store it in our routing table
      let e164Number: string | null = null;
      try {
        const numRes = await fetch(`${VAPI_BASE}/phone-number/${phoneNumberId}`, {
          headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
        });
        if (numRes.ok) {
          const numData = await numRes.json();
          e164Number = numData?.number || numData?.twilioPhoneNumber || null;
        }
      } catch (e) {
        console.warn("Could not fetch Vapi phone number details", e);
      }

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
        if (e164Number) {
          await supabase.from("inbound_ai_routing").delete().eq("phone_number", e164Number);
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
      const closingMsg = formatClosingStatements((script as any).closing_statements);

      const systemPrompt = `${(script as any).system_prompt}

PERSONALITY & SPEAKING STYLE:
- This is an INBOUND call — the person called YOU. Be welcoming, warm, and helpful.
- You are a real, genuine-sounding person having a natural phone conversation. Use filler words occasionally like "yeah", "look", "so", "actually", "to be honest" — the way a real person talks.
- Vary your sentence length. Don't sound scripted or robotic. React naturally to what the person says — laugh if something's funny, show empathy if they mention something tough.
- Use casual Australian-friendly language. Say things like "no worries", "all good", "mate" (sparingly), "how are you going" rather than "how are you doing".
- Mirror the caller's energy — if they're chatty, be chatty back. If they're brief, keep it tight.
- NEVER sound like you're reading from a script. Paraphrase the questions in your own words rather than reading them robotically word-for-word.

HONESTY ABOUT BEING AI:
- If the caller asks "Are you a real person?", "Are you AI?", "Am I talking to a robot?" or anything similar — you MUST be 100% honest.
- Say something like: "Yeah, I'm actually an AI assistant working for Compare Direct! It's way more cost-effective for me to give you a call and get this sorted — I don't take lunch breaks, I never call in sick, and I'm available around the clock. Pretty handy, right?"
- Be proud and humorous about it, not apologetic. Then smoothly continue with the conversation.
- NEVER lie and say you are a human. NEVER dodge the question.

CORE RULES:
- Follow the script instructions above as your primary guide.
- If the first audio you hear sounds like voicemail, an answering machine, a recorded greeting, a beep, or "leave a message", do not leave any message and call the end_call function immediately.
- After your greeting, wait for the caller to respond before continuing.
- If follow-up statements are provided below, deliver them naturally after the caller responds.
- Then ask each question one at a time, waiting for a response before moving on.
- NEVER make up facts or information not in your script.
- Listen carefully to what the caller says and respond appropriately — don't talk over them or ignore their answers.
- As long as the caller is engaged and willing, make sure you ask EVERY question listed below. Do not skip questions or rush to end the call early when the caller is happy to chat.
- Keep your responses short and concise — one or two sentences max before asking the next question.
- When ending the call, deliver the CLOSING STATEMENTS exactly as written below, then immediately hang up. Do NOT improvise extra goodbyes like "one moment" or "bye" after the final closing line.

INTEREST DETECTION:
- Do NOT assume the caller is uninterested just because they give short answers, sound unsure, or ask clarifying questions. These are totally normal.
- Only treat someone as "not interested" if they EXPLICITLY say things like "no thanks", "I'm not interested", "please don't call me", or similar clear refusals.
- If someone says "maybe", "I'm not sure", "what's this about?", or asks questions — they ARE engaged. Keep going.
- If the caller genuinely isn't interested, respect that — thank them warmly, wish them a great day, and end the call nicely.

ACCURACY WITH NAMES, EMAILS & NUMBERS:
- When the caller tells you their NAME, repeat it back naturally. For example: "Sarah — lovely name."
- EMAIL ADDRESSES: Listen VERY carefully when the caller says their email. Do NOT read the email back to them — just accept it and move on. Only ask them to repeat it if the audio was genuinely unclear or you couldn't hear them. Trust what they said. NEVER guess or make up an email address — if you truly couldn't hear it, say something like "Sorry, I didn't quite catch that — could you say your email one more time for me?"
- Say numbers naturally as words. Say "twenty-four to forty-eight hours" NOT "24 to 48 hours". Say "three hundred thousand" NOT "$300,000".
- If you're unsure about ANY detail other than email, just ask them to repeat it. Better to double-check than get it wrong.

PACING:
- After the caller says hello or introduces themselves for the FIRST time, pause for a brief moment before you start speaking. Don't jump in immediately — let them finish. Take a breath, then respond naturally.
- After that first exchange, respond QUICKLY. Once they answer your greeting (e.g. "Good thanks", "Yeah not bad"), jump straight in with your next line — no awkward pauses. Keep the conversation flowing at a natural, brisk pace.

${secondMessage}
QUESTIONS TO ASK (ask all of these in order, as long as the caller is willing — but paraphrase them naturally, don't read them word-for-word):
${questions.map((q: any, i: number) => `${i + 1}. ${q.question} (save their answer as "${q.fieldName}")`).join("\n")}
${closingMsg}
After all questions have been asked (or if the caller wants to end early), go straight into the CLOSING STATEMENTS above. Say the final closing statement EXACTLY as written and then immediately end the call. Do NOT add "one moment", "okay", "bye", or any other words after the final closing statement — the closing statement IS the goodbye.`;

      const assistantPayload: any = {
        name: `${(script as any).name} - Inbound`.substring(0, 40),
        model: {
          provider: "openai",
          model: (script as any).model || "gpt-4o",
          maxTokens: 512,
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
        voicemailDetection: {
          provider: "twilio",
          enabled: true,
          voicemailDetectionTypes: [
            "machine_end_beep",
            "machine_end_silence",
            "machine_end_other",
            "unknown",
          ],
          machineDetectionTimeout: 30,
          machineDetectionSpeechThreshold: 2400,
          machineDetectionSpeechEndThreshold: 1500,
          machineDetectionSilenceTimeout: 5000,
        },
        voicemailMessage: "",
        endCallMessage: "",
        messagePlan: {
          idleMessages: ["Hello? Are you there?"],
          idleTimeoutSeconds: 5,
          idleMessageMaxSpokenCount: 2,
        },
        responseDelaySeconds: 0.3,
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


      // Save local routing so twilio-voice can hand inbound calls to this assistant
      if (e164Number) {
        await supabase.from("inbound_ai_routing").upsert({
          phone_number: e164Number,
          vapi_assistant_id: assistant.id,
          vapi_phone_number_id: phoneNumberId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "phone_number" });
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
