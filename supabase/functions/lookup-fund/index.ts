// Edge function: look up Australian super fund details using a SINGLE Gemini 3
// call with native Google Search grounding. Optimised for speed (<5s target).
// Falls back to a single Firecrawl scrape only if Gemini didn't return a 5yr
// return.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const stripTrailingZeros = (v: string) =>
  v.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const textFromHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

function urlsFrom(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  return Array.from(new Set(raw.match(/https?:\/\/[^\s)\],;"']+/g) ?? []));
}

const BLOCKED_SOURCE_DOMAINS = [
  "google.com",
  "bing.com",
  "vertexaisearch.cloud.google.com",
  "superratings.com.au",
  "canstar.com.au",
  "chantwest.com.au",
  "rainmaker.com.au",
  "superreview.com.au",
  "moneymag.com.au",
  "finder.com.au",
  "mozo.com.au",
  "stockspot.com.au",
  "livewiremarkets.com",
  "wikipedia.org",
  "reddit.com",
  "facebook.com",
  "linkedin.com",
  "youtube.com",
];

function isAllowedOfficialCandidate(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return !BLOCKED_SOURCE_DOMAINS.some((d) =>
      host === d || host.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function fetchPageText(
  url: string,
  timeoutMs = 6000,
): Promise<string | null> {
  if (FIRECRAWL_API_KEY) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 0,
        }),
      });
      clearTimeout(t);
      if (resp.ok) {
        const j = await resp.json();
        const md: string = j?.data?.markdown ?? j?.markdown ?? "";
        const normalized = md.replace(/\s+/g, " ").trim();
        if (normalized.length > 200) return normalized;
      }
    } catch (e) {
      console.warn("Firecrawl scrape failed", url, e instanceof Error ? e.message : e);
    }
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SuperHealthCheck/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (resp.ok) {
      const html = await resp.text();
      const text = textFromHtml(html);
      if (text.length > 300) return text;
    }
  } catch (e) {
    console.warn("plain fetch failed", url, e instanceof Error ? e.message : e);
  }
  return null;
}

async function firecrawlSearch(query: string, limit = 5): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit }),
    });
    clearTimeout(t);
    if (!resp.ok) return [];
    const j = await resp.json();
    const results = j?.data?.web ?? j?.data ?? j?.web ?? [];
    const urls: string[] = [];
    for (const r of Array.isArray(results) ? results : []) {
      if (typeof r?.url === "string") urls.push(r.url);
    }
    return urls;
  } catch {
    return [];
  }
}

function pctVariants(decimal: unknown): string[] {
  if (typeof decimal !== "number" || !Number.isFinite(decimal)) return [];
  const pct = decimal * 100;
  return Array.from(
    new Set(
      [
        stripTrailingZeros(pct.toFixed(3)),
        stripTrailingZeros(pct.toFixed(2)),
        stripTrailingZeros(pct.toFixed(1)),
      ].filter(Boolean),
    ),
  );
}

function pctAppearsInText(pageText: string, decimal: unknown): boolean {
  const variants = pctVariants(decimal);
  if (!variants.length) return false;
  const normalized = pageText.toLowerCase().replace(/\s+/g, " ");
  for (const v of variants) {
    const re = new RegExp(`${escapeRegExp(v)}\\s*%`, "i");
    if (re.test(normalized)) return true;
  }
  return false;
}

async function callAI(
  messages: unknown[],
  tools: unknown[],
  toolName: string,
  useGoogleSearch = true,
): Promise<Record<string, unknown> | null> {
  const allTools = useGoogleSearch
    ? [{ type: "google_search" }, ...tools]
    : tools;
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
        messages,
        tools: allTools,
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    },
  );
  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error", resp.status, t);
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error("AI_FAILED");
  }
  const j = await resp.json();
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    return JSON.parse(args);
  } catch {
    return null;
  }
}

const NOW = new Date();
const CURRENT_YEAR = NOW.getUTCFullYear();
const PREV_YEAR = CURRENT_YEAR - 1;

// ---------- Single-shot system prompt: parse + research + return everything ----------

const SYSTEM_PROMPT =
  `You are a research assistant for Australian superannuation. You have Google Search grounding ENABLED — USE IT aggressively. Today's date is ${
    NOW.toISOString().slice(0, 10)
  }.

Your job is to:
  1. Parse the client's personal details from the free-text input.
  2. Search the OFFICIAL fund's own website for the allocated investment option's:
     - 5-year p.a. performance return (look under pages titled "investment returns", "performance returns", "investment performance", "monthly returns", "as at <month> ${CURRENT_YEAR}", or any other page on the fund's official domain that publishes the 5-year p.a. figure for that exact option).
     - Current ${CURRENT_YEAR} admin fees (flat $ and asset-based %).
     - Strategic growth-assets % allocation.
     - Official risk profile label.

CRITICAL search behaviour:
- Search queries you should run via Google Search:
    "<fund name> <option> 5 year return ${CURRENT_YEAR}"
    "<fund name> <option> investment returns"
    "<fund name> <option> performance"
    "<fund name> <option> fees ${CURRENT_YEAR}"
    "<fund name> <option> asset allocation"
- ONLY trust pages on the fund's OWN official domain. NEVER use SuperRatings, Canstar, Chant West, Finder, Mozo, news sites, Wikipedia, Reddit, etc.
- Prefer the MOST RECENT published "as at" date — ${CURRENT_YEAR} month-end > ${PREV_YEAR} > older PDS.
- grossReturn must be the 5-year p.a. return EXACTLY as the official site publishes it (decimal — 0.0712 for 7.12%). If both gross & net are shown, prefer net. If you cannot find a 5-year figure on the official site, return null — do NOT guess.
- Return the ACTUAL official URLs you used in sourceUrls (real links from your search, not invented).
- returnEvidenceText: copy the exact short snippet from the official page that shows the 5-year return + option name.
- sourceNotes: state the as-of date and which URL the 5yr return came from.

Frequencies must be exactly "Weekly", "Monthly", or "Annually".
Convert "k" → thousands, "m" → millions; strip $ and commas.`;

const TOOL_SCHEMA = [{
  type: "function",
  function: {
    name: "research_fund",
    description:
      "Return parsed client details + verified fund figures researched from the official fund website.",
    parameters: {
      type: "object",
      properties: {
        clientName: { type: ["string", "null"] },
        clientEmail: { type: ["string", "null"] },
        fundName: { type: ["string", "null"] },
        modelLabel: {
          type: ["string", "null"],
          description: "Investment option name as the fund names it",
        },
        age: { type: ["number", "null"] },
        retirementAge: { type: ["number", "null"] },
        annualIncome: { type: ["number", "null"] },
        superBalance: { type: ["number", "null"] },
        goalBalance: { type: ["number", "null"] },
        desiredIncomeAmount: { type: ["number", "null"] },
        desiredIncomeFrequency: {
          type: ["string", "null"],
          enum: ["Weekly", "Monthly", "Annually", null],
        },
        adminFeeFlat: { type: ["number", "null"] },
        adminFeePct: {
          type: ["number", "null"],
          description: "Decimal e.g. 0.0035",
        },
        grossReturn: {
          type: ["number", "null"],
          description: "Decimal e.g. 0.0712 — exact 5yr p.a. return from official site",
        },
        growthAssetsPct: {
          type: ["number", "null"],
          description: "Decimal e.g. 0.70",
        },
        investmentRiskProfile: { type: ["string", "null"] },
        returnEvidenceText: { type: ["string", "null"] },
        sourceUrls: {
          type: "array",
          items: { type: "string" },
          description: "Up to 5 official fund URLs used.",
        },
        sourceNotes: { type: "string" },
      },
      required: ["fundName", "modelLabel", "sourceUrls", "sourceNotes"],
      additionalProperties: false,
    },
  },
}];

// Fallback extraction prompt (only used if main call didn't return a 5yr return)
const FALLBACK_SYSTEM =
  `You extract Australian super fund 5-year return + fees + asset allocation from RAW WEBSITE TEXT. ONLY use numbers that literally appear in the provided text. Decimals: 7.12% → 0.0712. Return null for anything not in the text.`;

const FALLBACK_TOOL = [{
  type: "function",
  function: {
    name: "extract_figures",
    description: "Extract verified figures from scraped text.",
    parameters: {
      type: "object",
      properties: {
        adminFeeFlat: { type: ["number", "null"] },
        adminFeePct: { type: ["number", "null"] },
        grossReturn: { type: ["number", "null"] },
        growthAssetsPct: { type: ["number", "null"] },
        investmentRiskProfile: { type: ["string", "null"] },
        returnEvidenceText: { type: ["string", "null"] },
        sourceNotes: { type: "string" },
      },
      required: ["sourceNotes"],
      additionalProperties: false,
    },
  },
}];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return jsonResponse({ error: "query is required" }, 400);
    }
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const t0 = Date.now();

    // ---- SINGLE Gemini call with Google Search grounding ----
    const result = await callAI(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      TOOL_SCHEMA,
      "research_fund",
      true,
    );
    console.log(`[lookup-fund] main AI call: ${Date.now() - t0}ms`);

    if (!result) {
      return jsonResponse({ error: "AI did not return data" }, 502);
    }

    const sourceUrls = urlsFrom(result.sourceUrls).filter(
      isAllowedOfficialCandidate,
    );

    // ---- Fallback: if Gemini didn't find a 5-yr return, try ONE Firecrawl
    // search + scrape targeted at performance / investment returns pages. ----
    let fallbackEvidence: string | null = null;
    if (
      result.grossReturn == null &&
      result.fundName &&
      result.modelLabel &&
      FIRECRAWL_API_KEY
    ) {
      const tFb = Date.now();
      const q = `${result.fundName} ${result.modelLabel} 5 year investment returns performance`;
      const found = await firecrawlSearch(q, 5);
      const target = found.find(isAllowedOfficialCandidate);
      if (target) {
        const text = await fetchPageText(target, 6000);
        if (text && text.length > 300) {
          const fb = await callAI(
            [
              { role: "system", content: FALLBACK_SYSTEM },
              {
                role: "user",
                content:
                  `Fund: ${result.fundName}\nOption: ${result.modelLabel}\nURL: ${target}\n\n${
                    text.slice(0, 16000)
                  }`,
              },
            ],
            FALLBACK_TOOL,
            "extract_figures",
            false,
          );
          if (fb) {
            if (fb.grossReturn != null && pctAppearsInText(text, fb.grossReturn)) {
              result.grossReturn = fb.grossReturn;
              fallbackEvidence = (fb.returnEvidenceText as string) ?? null;
              if (!sourceUrls.includes(target)) sourceUrls.push(target);
            }
            if (fb.adminFeeFlat != null && result.adminFeeFlat == null) {
              result.adminFeeFlat = fb.adminFeeFlat;
            }
            if (fb.adminFeePct != null && result.adminFeePct == null) {
              result.adminFeePct = fb.adminFeePct;
            }
            if (fb.growthAssetsPct != null && result.growthAssetsPct == null) {
              result.growthAssetsPct = fb.growthAssetsPct;
            }
            if (fb.investmentRiskProfile && !result.investmentRiskProfile) {
              result.investmentRiskProfile = fb.investmentRiskProfile;
            }
          }
        }
      }
      console.log(`[lookup-fund] fallback: ${Date.now() - tFb}ms`);
    }

    const emailMatch = query.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    const data: Record<string, unknown> = {
      clientName: result.clientName ?? null,
      clientEmail: result.clientEmail ?? (emailMatch ? emailMatch[0] : null),
      fundName: result.fundName ?? null,
      modelLabel: result.modelLabel ?? null,
      age: result.age ?? null,
      retirementAge: result.retirementAge ?? null,
      annualIncome: result.annualIncome ?? null,
      superBalance: result.superBalance ?? null,
      goalBalance: result.goalBalance ?? null,
      desiredIncomeAmount: result.desiredIncomeAmount ?? null,
      desiredIncomeFrequency: result.desiredIncomeFrequency ?? null,
      adminFeeFlat: result.adminFeeFlat ?? null,
      adminFeePct: result.adminFeePct ?? null,
      grossReturn: result.grossReturn ?? null,
      growthAssetsPct: result.growthAssetsPct ?? null,
      investmentRiskProfile: result.investmentRiskProfile ?? null,
      sourceNotes: [
        result.sourceNotes,
        ...sourceUrls.map((u) => `• ${u}`),
      ].filter(Boolean).join("\n"),
      sourceUrls,
      returnEvidenceText: fallbackEvidence ?? result.returnEvidenceText ?? null,
      scrapedPageCount: sourceUrls.length,
    };

    console.log(`[lookup-fund] total: ${Date.now() - t0}ms`);
    return jsonResponse({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("lookup-fund error:", msg);
    if (msg === "RATE_LIMIT") {
      return jsonResponse({
        error: "Rate limit exceeded. Try again in a moment.",
      }, 429);
    }
    if (msg === "PAYMENT_REQUIRED") {
      return jsonResponse({
        error:
          "AI credits exhausted. Add credits in Settings → Workspace → Usage.",
      }, 402);
    }
    return jsonResponse({ error: msg }, 500);
  }
});
