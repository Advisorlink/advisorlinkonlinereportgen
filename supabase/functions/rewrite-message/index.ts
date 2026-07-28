// Lovable AI rewrite for chat messages
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const STYLE_RULES = `STYLE RULES (apply to EVERY output without exception):
- Tone: fun but not funny; confident and professional.
- Australian English ONLY: spelling, grammar, vocabulary, number formatting, and any formulas. e.g. "specialise" not "specialize", "organisation" not "organization", "recognise" not "recognize", "colour" not "color", "centre" not "center", "favourite" not "favorite", "analyse" not "analyze", "fulfil" not "fulfill", "enrol" not "enroll", "licence" (noun) / "license" (verb), "practise" (verb) / "practice" (noun), "mum" not "mom", "maths" not "math".
- NEVER use em dashes. NEVER use en dashes as punctuation. Use commas, full stops, brackets, or rewrite the sentence. If you would have used a dash, replace it.
- The brand name is always "Settled & Sound".
- Keep merge tags like {{first_name}}, {{super_fund_name}} intact and unchanged.
- Keep links, phone numbers, and emails intact.
- Do NOT add greetings, sign-offs, quotes, markdown, or commentary. Return ONLY the rewritten message text.`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  fix: "Fix spelling, grammar and punctuation only. Keep the meaning, length, and structure as close to the original as possible.",
  rewrite: "Rewrite the message so it reads more clearly and naturally, in the style described. Keep roughly the same length.",
  longer: "Rewrite the message with more detail and warmth, expanding it to be noticeably longer while staying on point.",
  shorter: "Rewrite the message to be noticeably shorter and punchier while keeping the key information.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { text, mode } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const instruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.rewrite;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.4,
        messages: [
          { role: "system", content: `${STYLE_RULES}\n\nTASK: ${instruction}` },
          { role: "user", content: text },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      const status = resp.status === 429 ? 429 : resp.status === 402 ? 402 : 500;
      const error = resp.status === 429 ? "Rate limit, try again shortly."
        : resp.status === 402 ? "AI credits exhausted. Please add credits in Workspace settings."
        : "AI request failed.";
      return new Response(JSON.stringify({ error }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await resp.json();
    let out: string = j.choices?.[0]?.message?.content ?? "";

    // Hard-enforce: strip em/en dashes.
    out = out.replace(/—/g, ", ").replace(/–/g, ", ");

    return new Response(JSON.stringify({ text: out.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
