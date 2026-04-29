// Edge function: look up Australian super fund details (fees + returns) using
// Lovable AI with Google Search grounding. Returns structured JSON for the
// Client Input form.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a research assistant specialising in Australian superannuation funds.
Given a user's description of their super (fund name, investment option, optionally age/balance/income), use web search to find the MOST RECENT publicly available figures from the fund's PDS, product dashboard, or official site.
Return ONLY a tool call with the structured data. Use null for any field you cannot find with reasonable confidence. Do not guess.

Field guidance (Australian context):
- adminFeeFlat: annual flat administration fee in AUD (e.g. 117 means $117/yr)
- adminFeePct: annual percentage admin/asset-based fee as DECIMAL (0.0035 = 0.35%)
- grossReturn: most recent 5-year p.a. net investment return for the option, DECIMAL (0.078 = 7.8% p.a.). If only 10yr available, use that.
- growthAssetsPct: strategic growth-asset allocation as DECIMAL (0.70 = 70%)
- fundName: clean canonical name (e.g. "AustralianSuper")
- modelLabel: investment option name (e.g. "Balanced", "High Growth")
- age, annualIncome, superBalance, retirementAge: parse from user text if present, else null`;

    const tools = [
      {
        type: "function",
        function: {
          name: "set_client_inputs",
          description: "Populate the super health check client input form.",
          parameters: {
            type: "object",
            properties: {
              fundName: { type: ["string", "null"] },
              modelLabel: { type: ["string", "null"] },
              adminFeeFlat: { type: ["number", "null"] },
              adminFeePct: { type: ["number", "null"], description: "Decimal e.g. 0.0035" },
              grossReturn: { type: ["number", "null"], description: "Decimal e.g. 0.078" },
              growthAssetsPct: { type: ["number", "null"], description: "Decimal e.g. 0.70" },
              age: { type: ["number", "null"] },
              retirementAge: { type: ["number", "null"] },
              annualIncome: { type: ["number", "null"] },
              superBalance: { type: ["number", "null"] },
              clientName: { type: ["string", "null"] },
              sourceNotes: {
                type: "string",
                description: "1-2 sentences naming the sources used and the as-of date.",
              },
            },
            required: ["sourceNotes"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "set_client_inputs" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI lookup failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "AI did not return structured data", raw: aiJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lookup-fund error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
