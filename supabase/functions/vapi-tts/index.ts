import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vapi-secret",
};

const ALLOWED_VOICE_IDS = new Set([
  "DTLT09E2cxHF0DqjKVbc",
  "4yye0QE5YPsKbMOCGGlj",
  "w9rPM8AIZle60Nbpw7nl",
  "4uJW3zTppOdNDWtKUtux",
  "2nzji8yPQooBwG4eQO4s",
  "NMbn4FNN0acONjKLsueJ",
  "sclx1MZrNqboRcmLWoDb",
]);

function normaliseSampleRate(value: unknown): 8000 | 16000 | 22050 | 24000 {
  const sampleRate = Number(value) || 24000;
  if (sampleRate === 8000 || sampleRate === 16000 || sampleRate === 22050 || sampleRate === 24000) {
    return sampleRate;
  }
  return 24000;
}

function elevenLabsOutputFormat(sampleRate: number) {
  if (sampleRate === 16000) return "pcm_16000";
  if (sampleRate === 22050) return "pcm_22050";
  return "pcm_24000";
}

function downsamplePcm16By2(buffer: ArrayBuffer) {
  const source = new Int16Array(buffer);
  const output = new Int16Array(Math.ceil(source.length / 2));
  for (let i = 0, j = 0; i < source.length; i += 2, j += 1) {
    output[j] = source[i];
  }
  return output.buffer;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

    const url = new URL(req.url);
    const voiceId = url.searchParams.get("voiceId") || "";
    if (!ALLOWED_VOICE_IDS.has(voiceId)) {
      return new Response("Voice is not allowed", { status: 400, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const message = body.message || body;
    if (message?.type && message.type !== "voice-request") {
      return new Response("Unsupported message type", { status: 400, headers: corsHeaders });
    }

    const text = String(message?.text || "").trim();
    if (!text) return new Response("Missing text", { status: 400, headers: corsHeaders });
    if (text.length > 2500) return new Response("Text is too long", { status: 400, headers: corsHeaders });

    const requestedSampleRate = normaliseSampleRate(message?.sampleRate);
    const elevenLabsSampleRate = requestedSampleRate === 8000 ? 16000 : requestedSampleRate;

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${elevenLabsOutputFormat(elevenLabsSampleRate)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.85,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("ElevenLabs custom voice failed:", ttsRes.status, errText);
      return new Response("Voice synthesis failed", { status: 502, headers: corsHeaders });
    }

    const pcm = await ttsRes.arrayBuffer();
    const output = requestedSampleRate === 8000 ? downsamplePcm16By2(pcm) : pcm;

    return new Response(output, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("vapi-tts error:", e);
    return new Response("Voice synthesis failed", { status: 500, headers: corsHeaders });
  }
});
