// Edge function: look up Australian super fund details by using Gemini 3 with
// Google Search lookup, then scraping the returned official pages ourselves.
// Two-step pipeline:
//   1) Gemini 3 parses the user text + finds official source URLs using lookup.
//   2) We fetch only those pages that actually load and ask AI to extract the
//      5-year p.a. return for the exact allocated option from the real text.
// This works for ANY Australian super fund, not a hard-coded one.

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

const normalizeQuery = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim();
const stripTrailingZeros = (v: string) => v.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
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
  "google.com", "bing.com", "vertexaisearch.cloud.google.com", "superratings.com.au",
  "canstar.com.au", "chantwest.com.au", "rainmaker.com.au", "superreview.com.au",
  "moneymag.com.au", "finder.com.au", "mozo.com.au", "stockspot.com.au",
  "wikipedia.org", "reddit.com", "facebook.com", "linkedin.com", "youtube.com",
];

function isAllowedOfficialCandidate(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return !BLOCKED_SOURCE_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

async function fetchPageText(url: string, timeoutMs = 12000): Promise<string | null> {
  const jinaUrl = `https://r.jina.ai/http://r.jina.ai/http://${url}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const resp = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SuperHealthCheck/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-AU,en;q=0.9",
      },
    });
    clearTimeout(t);
    if (resp.ok) {
      const html = await resp.text();
      const text = textFromHtml(html);
      if (text.length > 300 && !/^#?\s*404\s+-\s+page not found/i.test(text)) return text;
    }
  } catch (e) {
    console.warn("fetchPageText failed", url, e instanceof Error ? e.message : e);
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs + 8000);
    const resp = await fetch(jinaUrl, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "Accept": "text/plain" },
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const text = await resp.text();
    if (/Warning:\s*Target URL returned error\s+404/i.test(text) || /^Title:\s*404\s+-\s+Page Not Found/i.test(text)) return null;
    return text.replace(/\s+/g, " ").trim();
  } catch (e) {
    console.warn("fallback fetchPageText failed", url, e instanceof Error ? e.message : e);
    return null;
  }
}

function pctVariants(decimal: unknown): string[] {
  if (typeof decimal !== "number" || !Number.isFinite(decimal)) return [];
  const pct = decimal * 100;
  return Array.from(new Set([
    stripTrailingZeros(pct.toFixed(3)),
    stripTrailingZeros(pct.toFixed(2)),
    stripTrailingZeros(pct.toFixed(1)),
  ].filter(Boolean)));
}

function optionTokens(modelLabel: unknown): string[] {
  return String(modelLabel ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 3 && !["default", "mysuper", "option", "super", "fund"].includes(t));
}

function returnAppearsNearOption(pageText: string, grossReturn: unknown, modelLabel: unknown): boolean {
  const variants = pctVariants(grossReturn);
  if (!variants.length) return false;
  const tokens = optionTokens(modelLabel);
  const normalized = pageText.toLowerCase().replace(/\s+/g, " ");
  for (const v of variants) {
    const re = new RegExp(`${escapeRegExp(v)}\\s*%`, "i");
    const m = re.exec(normalized);
    if (!m) continue;
    const ctx = normalized.slice(Math.max(0, m.index - 800), m.index + 800);
    const fiveYr = /(5|five)\s*[- ]?\s*(year|yr)/i.test(ctx);
    const optionMatch = tokens.length === 0 || tokens.some(t => ctx.includes(t));
    if (fiveYr && optionMatch) return true;
  }
  return false;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function callAI(messages: unknown[], tools: unknown[], toolName: string): Promise<Record<string, unknown> | null> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0,
      messages,
      tools: [{ type: "google_search" }, ...tools],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });
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
  try { return JSON.parse(args); } catch { return null; }
}

// ---------- STEP 1: parse client text + find official source URLs ----------

const STEP1_SYSTEM = `You are a research assistant for Australian superannuation. You have Google Search grounding — USE IT for every lookup.

For the named fund, you MUST locate the OFFICIAL fund website pages (and PDS / Investment Guide if needed) that publish:
  (a) the current investment performance / returns table for the allocated investment option (must show 5-year p.a. net return), and
  (b) the current fees & costs (admin fee + asset-based admin fee), and
  (c) the strategic asset allocation / growth assets % and the official risk profile label.

Rules:
- Identify WHICHEVER Australian super fund the user names — industry, retail, corporate, public sector, SMSF platform, etc. Never default to AustralianSuper or any specific fund.
- Use ONLY the fund's own official domain (e.g. australiansuper.com, hostplus.com.au, hesta.com.au, rest.com.au, unisuper.com.au, aware.com.au, cbussuper.com.au, art.com.au, australianretirementtrust.com.au, caresuper.com.au, mlc.com.au, amp.com.au, colonialfirststate.com.au, mercersuper.com.au, vanguard.com.au, brightersuper.com.au, spiritsuper.com.au, equipsuper.com.au, csc.gov.au, qsuper.qld.gov.au, gesb.wa.gov.au, ngssuper.com.au, telstrasuper.com.au, etc.). Never use third-party comparison sites, news, blogs, SuperRatings, Canstar, Chant West, etc.
- Return up to 4 URLs, ordered by likelihood of containing the 5-year p.a. net return for the allocated option (performance/returns/dashboard pages first, then PDS/Investment Guide).
- Also parse the client's personal details from the free-text input.

Frequencies must be exactly "Weekly", "Monthly", or "Annually".
Convert "k" → thousands, "m" → millions; strip $ and commas.`;

const STEP1_TOOL = [{
  type: "function",
  function: {
    name: "find_sources",
    description: "Return parsed client details and official fund URLs to scrape.",
    parameters: {
      type: "object",
      properties: {
        clientName: { type: ["string", "null"] },
        fundName: { type: ["string", "null"] },
        modelLabel: { type: ["string", "null"], description: "Investment option name as the fund names it" },
        age: { type: ["number", "null"] },
        retirementAge: { type: ["number", "null"] },
        annualIncome: { type: ["number", "null"] },
        superBalance: { type: ["number", "null"] },
        goalBalance: { type: ["number", "null"] },
        desiredIncomeAmount: { type: ["number", "null"] },
        desiredIncomeFrequency: { type: ["string", "null"], enum: ["Weekly", "Monthly", "Annually", null] },
        sourceUrls: {
          type: "array",
          items: { type: "string" },
          description: "Up to 4 official fund URLs, performance/returns pages first.",
        },
        notes: { type: "string" },
      },
      required: ["fundName", "modelLabel", "sourceUrls"],
      additionalProperties: false,
    },
  },
}];

// ---------- STEP 2: extract verified figures from REAL scraped page text ----------

const STEP2_SYSTEM = `You extract Australian super fund figures from RAW WEBSITE TEXT that has been fetched from the official fund's website.

Strict rules:
- ONLY use numbers that literally appear in the provided page text. Do NOT use prior knowledge, do NOT estimate, do NOT use other time periods.
- grossReturn must be the 5-year p.a. return for the EXACT allocated investment option, copied straight from the page text — whatever the website publishes (net or gross, whichever is shown). Do not convert or adjust it. If both are shown, prefer the one labelled net; otherwise just take whatever 5-year p.a. figure the page shows for that option. If no 5-year figure is shown for that option, return null.
- adminFeeFlat: annual flat admin fee in AUD (multiply weekly fees by 52). Null if not in text.
- adminFeePct: annual asset-based admin/trustee fee as a DECIMAL (0.0035 = 0.35%). Exclude investment fees. Null if not in text.
- growthAssetsPct: strategic growth-asset allocation as DECIMAL (0.70 = 70%). Null if not in text.
- investmentRiskProfile: official risk label exactly as the page calls it (e.g. "High", "Medium to High", "Growth"). Null if not in text.
- returnEvidenceText: copy the exact short snippet from the page text that contains the 5-year return + option label.
- sourceNotes: short explanation including which URL the 5yr return came from and the as-of date if visible.
- Be deterministic.`;

const STEP2_TOOL = [{
  type: "function",
  function: {
    name: "extract_fund_figures",
    description: "Extract verified fund figures from real scraped page text.",
    parameters: {
      type: "object",
      properties: {
        adminFeeFlat: { type: ["number", "null"] },
        adminFeePct: { type: ["number", "null"], description: "Decimal e.g. 0.0035" },
        grossReturn: { type: ["number", "null"], description: "Decimal e.g. 0.0633 — 5yr NET p.a." },
        growthAssetsPct: { type: ["number", "null"], description: "Decimal e.g. 0.70" },
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return jsonResponse({ error: "query is required" }, 400);
    }
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const cacheKey = normalizeQuery(query);
    const cached = lookupCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return jsonResponse({ data: cached.data, cached: true });
    }

    // ---- Step 1: parse + find URLs ----
    const step1 = await callAI(
      [{ role: "system", content: STEP1_SYSTEM }, { role: "user", content: query }],
      STEP1_TOOL,
      "find_sources",
    );
    if (!step1) return jsonResponse({ error: "AI did not return source URLs" }, 502);

    const candidateUrls = urlsFrom(step1.sourceUrls).filter(isOfficialUrl).slice(0, 4);

    // ---- Step 2: actually scrape those pages and extract figures ----
    const pages: { url: string; text: string }[] = [];
    for (const url of candidateUrls) {
      const text = await fetchPageText(url);
      if (text && text.length > 200) {
        // truncate to keep prompt size sane
        pages.push({ url, text: text.slice(0, 18000) });
      }
    }

    let figures: Record<string, unknown> = {
      adminFeeFlat: null, adminFeePct: null, grossReturn: null,
      growthAssetsPct: null, investmentRiskProfile: null,
      returnEvidenceText: null, sourceNotes: "",
    };

    if (pages.length) {
      const userBlock =
        `Fund: ${step1.fundName}\nAllocated investment option: ${step1.modelLabel}\n\n` +
        pages.map((p, i) => `===== SOURCE ${i + 1}: ${p.url} =====\n${p.text}`).join("\n\n");

      const step2 = await callAI(
        [{ role: "system", content: STEP2_SYSTEM }, { role: "user", content: userBlock }],
        STEP2_TOOL,
        "extract_fund_figures",
      );
      if (step2) figures = step2;

      // Hard verification: the percentage we extracted must literally appear
      // in the scraped page text near a 5-year mention and the option label.
      const allText = pages.map(p => p.text).join("\n");
      if (figures.grossReturn != null && !returnAppearsNearOption(allText, figures.grossReturn, step1.modelLabel)) {
        figures.grossReturn = null;
        figures.sourceNotes = `${figures.sourceNotes ?? ""}\nVerification: extracted 5-year return could not be located near "${step1.modelLabel}" + "5 year" in the official page text, so it was discarded.`.trim();
      }
    } else {
      figures.sourceNotes = "No official fund pages could be scraped — fees and 5-year net return were not auto-filled. Please fill manually.";
    }

    const data: Record<string, unknown> = {
      clientName: step1.clientName ?? null,
      fundName: step1.fundName ?? null,
      modelLabel: step1.modelLabel ?? null,
      age: step1.age ?? null,
      retirementAge: step1.retirementAge ?? null,
      annualIncome: step1.annualIncome ?? null,
      superBalance: step1.superBalance ?? null,
      goalBalance: step1.goalBalance ?? null,
      desiredIncomeAmount: step1.desiredIncomeAmount ?? null,
      desiredIncomeFrequency: step1.desiredIncomeFrequency ?? null,
      adminFeeFlat: figures.adminFeeFlat ?? null,
      adminFeePct: figures.adminFeePct ?? null,
      grossReturn: figures.grossReturn ?? null,
      growthAssetsPct: figures.growthAssetsPct ?? null,
      investmentRiskProfile: figures.investmentRiskProfile ?? null,
      sourceNotes: [figures.sourceNotes, ...candidateUrls.map(u => `• ${u}`)].filter(Boolean).join("\n"),
      sourceUrls: candidateUrls,
      returnEvidenceText: figures.returnEvidenceText ?? null,
      scrapedPageCount: pages.length,
    };

    lookupCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_MS });
    return jsonResponse({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("lookup-fund error:", msg);
    if (msg === "RATE_LIMIT") return jsonResponse({ error: "Rate limit exceeded. Try again in a moment." }, 429);
    if (msg === "PAYMENT_REQUIRED") return jsonResponse({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }, 402);
    return jsonResponse({ error: msg }, 500);
  }
});
