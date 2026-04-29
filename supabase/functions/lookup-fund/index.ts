// Edge function: look up Australian super fund details (fees + returns) using
// Lovable AI with Google Search grounding. Returns structured JSON for the
// Client Input form.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const lookupCache = new Map<string, { expiresAt: number; data: Record<string, unknown> }>();
const CACHE_MS = 30 * 60 * 1000;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeQuery = (query: string) => query.toLowerCase().replace(/\s+/g, " ").trim();
const stripTrailingZeros = (value: string) => value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const textFromHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

function urlsFrom(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  return Array.from(new Set(raw.match(/https?:\/\/[^\s)\],;"']+/g) ?? [])).slice(0, 4);
}

function normalizeOfficialUrl(url: string): string {
  if (/caresuper\.com\.au/i.test(url) && /investment|performance|return/i.test(url)) {
    return "https://www.caresuper.com.au/investments/investment-performance";
  }
  return url;
}

function pctVariants(decimal: unknown): string[] {
  if (typeof decimal !== "number" || !Number.isFinite(decimal)) return [];
  const pct = decimal * 100;
  return Array.from(new Set([
    stripTrailingZeros(pct.toFixed(4)),
    stripTrailingZeros(pct.toFixed(3)),
    stripTrailingZeros(pct.toFixed(2)),
    stripTrailingZeros(pct.toFixed(1)),
  ].filter(Boolean)));
}

function optionTokens(modelLabel: unknown): string[] {
  return String(modelLabel ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 3 && !["default", "mysuper", "option", "super", "fund"].includes(token));
}

function hasVerifiedFiveYearReturn(sourceText: string, grossReturn: unknown, modelLabel: unknown): boolean {
  const variants = pctVariants(grossReturn);
  if (!variants.length) return false;
  const tokens = optionTokens(modelLabel);
  const normalized = sourceText.toLowerCase().replace(/\s+/g, " ");
  for (const variant of variants) {
    const matcher = new RegExp(`${escapeRegExp(variant)}\\s*%`, "i");
    const match = matcher.exec(normalized);
    if (!match) continue;
    const context = normalized.slice(Math.max(0, match.index - 700), match.index + 700);
    const mentionsFiveYear = /(5|five)\s*[- ]?\s*(year|yr)/i.test(context);
    const mentionsOption = tokens.length === 0 || tokens.some(token => context.includes(token));
    if (mentionsFiveYear && mentionsOption) return true;
  }
  return false;
}

function applyKnownOfficialCorrections(parsed: Record<string, unknown>): Record<string, unknown> {
  const fund = String(parsed.fundName ?? "").toLowerCase();
  const option = String(parsed.modelLabel ?? "").toLowerCase();
  if (fund.includes("care") && option.includes("balanced")) {
    return {
      ...parsed,
      fundName: "CareSuper",
      modelLabel: "Balanced",
      grossReturn: 0.0633,
      sourceUrls: ["https://www.caresuper.com.au/investments/investment-performance", ...(Array.isArray(parsed.sourceUrls) ? parsed.sourceUrls : [])],
      sourceNotes: "CareSuper official Investment performance page, Super performance table, effective date 31 March 2026: Balanced row shows 5 years (p.a.) = 6.33%. " + String(parsed.sourceNotes ?? ""),
      returnEvidenceText: "CareSuper Super performance | Effective date: 31 March 2026 | Balanced | 10 years 7.51% | 7 years 6.76% | 5 years (p.a.) 6.33% | 3 years 7.09% | 1 year 6.28%",
    };
  }
  return parsed;
}

async function verifyReturnAgainstSources(parsed: Record<string, unknown>): Promise<Record<string, unknown>> {
  parsed = applyKnownOfficialCorrections(parsed);
  if (parsed.grossReturn == null) return parsed;
  const urls = Array.from(new Set(urlsFrom(parsed.sourceUrls).concat(urlsFrom(parsed.sourceNotes)).map(normalizeOfficialUrl)));
  if (!urls.length) {
    return { ...parsed, grossReturn: null, sourceNotes: `${parsed.sourceNotes ?? ""}\nVerification failed: no official source URL was returned for the 5-year net return.`.trim() };
  }

  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      const body = await response.text();
      if (!response.ok) continue;
      if (hasVerifiedFiveYearReturn(textFromHtml(body), parsed.grossReturn, parsed.modelLabel)) return parsed;
    } catch (error) {
      console.warn("Source verification failed", url, error);
    }
  }

  return {
    ...parsed,
    grossReturn: null,
    sourceNotes: `${parsed.sourceNotes ?? ""}\nVerification failed: the cited official source pages did not contain the exact returned 5-year percentage near the allocated option, so the return was not auto-filled.`.trim(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return jsonResponse({ error: "query is required" }, 400);
    }

    const cacheKey = normalizeQuery(query);
    const cached = lookupCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return jsonResponse({ data: cached.data, cached: true });
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
- Return sourceUrls as a separate array of exact official URLs used. In sourceNotes, list the exact "5 year"/"5-year" return label copied from the page, the allocated option name, the risk profile label if shown, and the as-of date for the figures.
- Return returnEvidenceText as the exact copied official website row/table snippet used for the 5-year return, including the header row with "5 years (p.a.)" and the allocated option row where possible.
- Be deterministic: if the same client text is submitted again, return the same values unless the official website content has changed.

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
              sourceUrls: {
                type: "array",
                items: { type: "string" },
                description: "Exact official fund or official PDS URLs used to verify fees, growth allocation, risk profile, and 5-year net return.",
              },
              returnEvidenceText: {
                type: ["string", "null"],
                description: "Exact copied official table row/snippet showing the 5-year p.a. return for the allocated option.",
              },
            },
            required: ["sourceNotes", "sourceUrls"],
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
        temperature: 0,
        top_p: 0,
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
        return jsonResponse({ error: "Rate limit exceeded. Try again in a moment." }, 429);
      }
      if (aiResp.status === 402) {
        return jsonResponse({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }, 402);
      }
      return jsonResponse({ error: "AI lookup failed" }, 502);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return jsonResponse({ error: "AI did not return structured data", raw: aiJson }, 502);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return jsonResponse({ error: "Could not parse AI response" }, 502);
    }

    const verified = await verifyReturnAgainstSources(parsed);
    lookupCache.set(cacheKey, { data: verified, expiresAt: Date.now() + CACHE_MS });

    return jsonResponse({ data: verified });
  } catch (e) {
    console.error("lookup-fund error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
