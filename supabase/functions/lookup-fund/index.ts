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

    const systemPrompt = `You are a research assistant specialising in Australian superannuation funds. You have access to Google Search grounding — USE IT for every lookup. Do NOT rely on prior knowledge for fees or returns.

ACCURACY RULES (CRITICAL):
- Identify WHICHEVER super fund the user names (any Australian fund — industry, retail, corporate, public sector, SMSF platforms, etc.). Do NOT default to AustralianSuper or any specific fund.
- You MUST search the web and read THAT fund's OFFICIAL site, current PDS, Investment Guide, product dashboard, or annual report. Examples include australiansuper.com, hostplus.com.au, hesta.com.au, rest.com.au, unisuper.com.au, aware.com.au, cbussuper.com.au, art.com.au, australianretirementtrust.com.au, mlc.com.au, amp.com.au, colonialfirststate.com.au, mercersuper.com.au, vanguard.com.au, brightersuper.com.au, spiritsuper.com.au, equipsuper.com.au, csc.gov.au, gesb.wa.gov.au, qsuper.qld.gov.au, smartmonday.com.au, netwealth.com.au, hub24.com.au, macquarie.com.au, etc. — but do not limit yourself to this list.
- Use the MOST RECENT figures available directly from the official fund website page for that EXACT fund and allocated investment option. Prefer the public "investment performance", "performance", "returns", "dashboard", or current PDS page for that option.
- The return percentage must be the 5-year p.a. NET investment return/performance currently published for the exact allocated option. Do NOT use 1-year, 3-year, 7-year, 10-year, since-inception, financial-year-only, generic fund average, another option, an older cached result, a gross/before-fee return, or a figure from a comparison/third-party website.
- If the exact 5-year p.a. net return for that exact option is not available on the official fund website/PDS, return null for grossReturn and explain that the 5-year net return could not be verified. NEVER substitute a different time period.
- If you cannot find a figure on the named fund's official source with confidence, return null for that field. NEVER guess, estimate, substitute another fund's figures, or interpolate.
- In sourceNotes, list the exact URLs you used (must be from the named fund's domain or its official PDS host), the exact "5 year"/"5-year" return label copied from the page, the allocated option name, the risk profile label if shown, and the as-of date for the figures.

PARSING RULES (from the user's free-text input):
- clientName: extract the person's full name if present (e.g. "for John Smith", "client: Jane Doe", or a name at the start). Title-case it. Strip the fund name.
- age: integer years.
- retirementAge: integer years (look for "retire at 65", "retirement age 67").
- annualIncome: salary in AUD (look for "earns 95k", "salary $120,000", "income 80000 p.a.").
- superBalance: current super balance in AUD (look for "balance 80k", "$250,000 in super").
- goalBalance: target/goal retirement balance if stated (look for "target $1m", "goal balance 1,500,000", "wants $800k at retirement").
- desiredIncomeAmount + desiredIncomeFrequency: desired retirement income (look for "wants $60k/yr in retirement", "needs $1,500/week", "$5000 per month"). Frequency must be exactly "Weekly", "Monthly", or "Annually".
- Convert "k" → thousands, "m" → millions. Strip $ and commas.

FUND FIELDS (Australian context, from official sources):
- fundName: clean canonical name (e.g. "AustralianSuper", "Hostplus", "Rest").
- modelLabel: investment option name exactly as the fund names it (e.g. "Balanced", "High Growth", "Indexed Balanced").
- adminFeeFlat: annual flat administration fee in AUD (e.g. 117 means $117/yr). If the fund only charges weekly, multiply by 52.
- adminFeePct: annual percentage admin/asset-based fee as a DECIMAL (0.0035 = 0.35%). Include any asset-based admin or trustee fee. Exclude investment fees.
- grossReturn: the 5-year p.a. NET investment return/performance shown on the official fund website for the exact allocated investment option, as a DECIMAL (6.33% = 0.0633). It must be after investment fees and tax where the fund labels it net. DO NOT use gross/before-fee returns. DO NOT use 1-year or any period other than 5-year. Copy the official 5-year website percentage exactly.
- growthAssetsPct: strategic growth-asset allocation as a DECIMAL (0.70 = 70%).
- investmentRiskProfile: risk level/profile exactly as the official fund page or PDS labels the allocated option, e.g. "High", "Medium to High", "Growth", "Balanced", "Very High". If not officially shown, return null.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "set_client_inputs",
          description: "Populate the super health check client input form with verified fund data and parsed client details.",
          parameters: {
            type: "object",
            properties: {
              clientName: { type: ["string", "null"] },
              fundName: { type: ["string", "null"] },
              modelLabel: { type: ["string", "null"] },
              adminFeeFlat: { type: ["number", "null"] },
              adminFeePct: { type: ["number", "null"], description: "Decimal e.g. 0.0035" },
              grossReturn: { type: ["number", "null"], description: "Decimal e.g. 0.078 — 5yr NET p.a. return (after investment fees and tax). Never gross." },
              growthAssetsPct: { type: ["number", "null"], description: "Decimal e.g. 0.70" },
              investmentRiskProfile: { type: ["string", "null"], description: "Official risk level/profile for the allocated investment option" },
              age: { type: ["number", "null"] },
              retirementAge: { type: ["number", "null"] },
              annualIncome: { type: ["number", "null"] },
              superBalance: { type: ["number", "null"] },
              goalBalance: { type: ["number", "null"], description: "Target retirement balance in AUD" },
              desiredIncomeAmount: { type: ["number", "null"], description: "Desired retirement income in AUD" },
              desiredIncomeFrequency: {
                type: ["string", "null"],
                enum: ["Weekly", "Monthly", "Annually", null],
              },
              sourceNotes: {
                type: "string",
                description: "List the exact official URLs used and the as-of date. If a field is null, say which one and why it could not be verified.",
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
        model: "google/gemini-3-flash-preview",
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
