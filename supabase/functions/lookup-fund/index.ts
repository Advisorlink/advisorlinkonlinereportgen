// Edge function: look up Australian super fund details.
// Pipeline:
//   1) Quick AI parse of the free-text input (no web search) → fundName, option, client details.
//   2) Firecrawl web search for REAL official-fund pages (investment returns / performance).
//   3) Scrape top candidate pages in parallel.
//   4) AI extracts figures STRICTLY from the scraped text — never invents URLs or numbers.
//   5) Hard verification: every percentage must literally appear in the scraped text.

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
  "twitter.com",
  "x.com",
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

function hostFrom(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function fundHostTokens(fundName: string): string[] {
  const compactName = fundName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const words = fundName
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((w) =>
      w.length >= 3 && ![
        "super",
        "superannuation",
        "fund",
        "funds",
        "trust",
        "australia",
        "australian",
        "the",
        "and",
      ].includes(w)
    );
  return Array.from(
    new Set(
      [compactName, words.join(""), ...words].filter((w) => w.length >= 4),
    ),
  );
}

function looksLikeOfficialFundUrl(url: string, fundName: string): boolean {
  const host = hostFrom(url);
  if (!host || !isAllowedOfficialCandidate(url)) return false;
  const compactHost = host.replace(/[^a-z0-9]/g, "");
  return fundHostTokens(fundName).some((token) => compactHost.includes(token));
}

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function fetchPageText(
  url: string,
  timeoutMs = 7000,
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
        const statusCode = j?.data?.metadata?.statusCode ??
          j?.metadata?.statusCode;
        const md: string = j?.data?.markdown ?? j?.markdown ?? "";
        const normalized = md.replace(/\s+/g, " ").trim();
        const missingPage =
          /\b(404|page not found|doesn[’']?t seem to exist|couldn[’']?t find this page)\b/i
            .test(normalized.slice(0, 1200));
        if (Number(statusCode) >= 400 || missingPage) return null;
        if (normalized.length > 200) return normalized;
      }
    } catch (e) {
      console.warn(
        "Firecrawl scrape failed",
        url,
        e instanceof Error ? e.message : e,
      );
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

async function firecrawlSearch(query: string, limit = 6): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
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
): Promise<Record<string, unknown> | null> {
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
        tools,
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

// ---------- STEP 1: parse free text only (no web search) ----------

const PARSE_SYSTEM = `Parse Australian super client details from free-text input.
Frequencies must be exactly "Weekly", "Monthly", or "Annually".
Convert "k" → thousands, "m" → millions; strip $ and commas.
fundName: the Australian super fund. modelLabel: the investment option as named.`;

const PARSE_TOOL = [{
  type: "function",
  function: {
    name: "parse_inputs",
    description: "Parse client inputs from free text.",
    parameters: {
      type: "object",
      properties: {
        clientName: { type: ["string", "null"] },
        clientEmail: { type: ["string", "null"] },
        fundName: { type: ["string", "null"] },
        modelLabel: { type: ["string", "null"] },
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
      },
      required: ["fundName", "modelLabel"],
      additionalProperties: false,
    },
  },
}];

// ---------- STEP 2: extract figures from REAL scraped text ----------

const EXTRACT_SYSTEM =
  `You extract Australian super fund figures from RAW SCRAPED TEXT of the official fund's website. Today's date is ${
    NOW.toISOString().slice(0, 10)
  }.

ABSOLUTE RULES:
- ONLY use numbers that LITERALLY appear in the provided page text. Never use prior knowledge. Never estimate.
- grossReturn must be the 5-year p.a. return for the EXACT allocated investment option, copied straight from the page text. Decimal form (7.12% → 0.0712). If both gross and net are shown, prefer net. If no 5-year p.a. figure for that option appears in any source, return null.
- If multiple sources show a 5-year figure, pick the one with the most recent "as at" date. State the as-of date in sourceNotes.
- adminFeeFlat: annual flat admin fee in AUD (multiply weekly fees by 52). Null if not in text.
- adminFeePct: annual asset-based admin fee as a DECIMAL (0.0035 = 0.35%). Null if not in text.
- growthAssetsPct: strategic growth-asset allocation as DECIMAL. Null if not in text.
- investmentRiskProfile: risk label exactly as the page calls it. Null if not in text.
- returnEvidenceText: copy the EXACT short snippet from the page text containing the 5yr return + option label.
- sourceUrlUsed: the URL (from the SOURCE headers below) that the 5yr return came from. Must be one of the supplied URLs verbatim.
- sourceNotes: short note including the as-of date.

Be deterministic.`;

const EXTRACT_TOOL = [{
  type: "function",
  function: {
    name: "extract_fund_figures",
    description: "Extract verified fund figures from real scraped text.",
    parameters: {
      type: "object",
      properties: {
        adminFeeFlat: { type: ["number", "null"] },
        adminFeePct: { type: ["number", "null"] },
        grossReturn: { type: ["number", "null"] },
        growthAssetsPct: { type: ["number", "null"] },
        investmentRiskProfile: { type: ["string", "null"] },
        returnEvidenceText: { type: ["string", "null"] },
        sourceUrlUsed: { type: ["string", "null"] },
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
    if (!FIRECRAWL_API_KEY) {
      return jsonResponse({
        error: "Firecrawl API key not configured — cannot search the web.",
      }, 500);
    }

    const t0 = Date.now();

    // ---- Step 1: parse free text ----
    const parsed = await callAI(
      [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user", content: query },
      ],
      PARSE_TOOL,
      "parse_inputs",
    );
    if (!parsed) return jsonResponse({ error: "Failed to parse input" }, 502);
    console.log(`[lookup-fund] parse: ${Date.now() - t0}ms`);

    const fundName = String(parsed.fundName ?? "").trim();
    const optionLabel = String(parsed.modelLabel ?? "").trim();
    if (!fundName || !optionLabel) {
      return jsonResponse({
        error: "Could not identify fund name or investment option",
      }, 400);
    }

    // ---- Step 2: Firecrawl search for REAL official pages ----
    const tSearch = Date.now();
    const searchQueries = [
      `${fundName} ${optionLabel} investment returns 5 year`,
      `${fundName} ${optionLabel} performance returns`,
      `${fundName} ${optionLabel} fees costs ${CURRENT_YEAR}`,
    ];
    const searchResults = await Promise.all(
      searchQueries.map((q) => firecrawlSearch(q, 5)),
    );
    const allFound = Array.from(new Set(searchResults.flat()));
    // Keep only URLs that look like they belong to the fund's own domain.
    const officialUrls = allFound.filter((u) =>
      looksLikeOfficialFundUrl(u, fundName)
    );
    // De-dupe by URL, prefer pages whose path mentions performance/returns/fees.
    const scoredUrls = officialUrls
      .map((u) => {
        const lower = u.toLowerCase();
        let score = 0;
        if (/performance|return|investment-option|investment-returns/.test(lower)) score += 3;
        if (/fee|cost|pds/.test(lower)) score += 1;
        if (/\.pdf(\?|$)/.test(lower)) score -= 1; // prefer live HTML over PDFs
        return { url: u, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((s) => s.url)
      .slice(0, 4);

    console.log(
      `[lookup-fund] search: ${Date.now() - tSearch}ms, found ${officialUrls.length} official, scraping ${scoredUrls.length}`,
    );

    if (scoredUrls.length === 0) {
      return jsonResponse({
        data: emptyResult(parsed, query, [], `No official ${fundName} pages found via web search.`),
      });
    }

    // ---- Step 3: scrape candidate pages in parallel ----
    const tScrape = Date.now();
    const scraped = await Promise.all(
      scoredUrls.map(async (url) => {
        try {
          const text = await fetchPageText(url, 7000);
          return text && text.length > 300
            ? { url, text: text.slice(0, 18000) }
            : null;
        } catch {
          return null;
        }
      }),
    );
    const pages = scraped.filter(
      (p): p is { url: string; text: string } => p !== null,
    );
    console.log(
      `[lookup-fund] scrape: ${Date.now() - tScrape}ms, ${pages.length}/${scoredUrls.length} succeeded`,
    );

    if (pages.length === 0) {
      return jsonResponse({
        data: emptyResult(parsed, query, scoredUrls, "Found official pages but could not scrape them."),
      });
    }

    // ---- Step 4: AI extracts figures from REAL scraped text only ----
    const tExtract = Date.now();
    const userBlock =
      `Fund: ${fundName}\nAllocated investment option: ${optionLabel}\n\n` +
      pages.map((p, i) =>
        `===== SOURCE ${i + 1}: ${p.url} =====\n${p.text}`
      ).join("\n\n");

    const figures = await callAI(
      [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user", content: userBlock },
      ],
      EXTRACT_TOOL,
      "extract_fund_figures",
    ) ?? {
      adminFeeFlat: null,
      adminFeePct: null,
      grossReturn: null,
      growthAssetsPct: null,
      investmentRiskProfile: null,
      returnEvidenceText: null,
      sourceUrlUsed: null,
      sourceNotes: "",
    };
    console.log(`[lookup-fund] extract: ${Date.now() - tExtract}ms`);

    // ---- Step 5: hard verification — every % must literally appear in scraped text ----
    const allText = pages.map((p) => p.text).join("\n");
    const verifyNotes: string[] = [];
    if (figures.grossReturn != null && !pctAppearsInText(allText, figures.grossReturn)) {
      figures.grossReturn = null;
      verifyNotes.push("5yr return discarded — not found literally in scraped text.");
    }
    if (figures.adminFeePct != null && !pctAppearsInText(allText, figures.adminFeePct)) {
      figures.adminFeePct = null;
      verifyNotes.push("Asset-based admin fee discarded — not found literally in scraped text.");
    }
    if (figures.growthAssetsPct != null && !pctAppearsInText(allText, figures.growthAssetsPct)) {
      figures.growthAssetsPct = null;
      verifyNotes.push("Growth assets % discarded — not found literally in scraped text.");
    }
    // sourceUrlUsed must be one of the actually-scraped URLs.
    const usedUrl = typeof figures.sourceUrlUsed === "string" &&
        pages.some((p) => p.url === figures.sourceUrlUsed)
      ? figures.sourceUrlUsed
      : null;

    const finalNotes = [
      figures.sourceNotes,
      verifyNotes.length ? `Verification: ${verifyNotes.join(" ")}` : "",
    ].filter(Boolean).join("\n").trim();

    const emailMatch = query.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    const data: Record<string, unknown> = {
      clientName: parsed.clientName ?? null,
      clientEmail: parsed.clientEmail ?? (emailMatch ? emailMatch[0] : null),
      fundName,
      modelLabel: optionLabel,
      age: parsed.age ?? null,
      retirementAge: parsed.retirementAge ?? null,
      annualIncome: parsed.annualIncome ?? null,
      superBalance: parsed.superBalance ?? null,
      goalBalance: parsed.goalBalance ?? null,
      desiredIncomeAmount: parsed.desiredIncomeAmount ?? null,
      desiredIncomeFrequency: parsed.desiredIncomeFrequency ?? null,
      adminFeeFlat: figures.adminFeeFlat ?? null,
      adminFeePct: figures.adminFeePct ?? null,
      grossReturn: figures.grossReturn ?? null,
      growthAssetsPct: figures.growthAssetsPct ?? null,
      investmentRiskProfile: figures.investmentRiskProfile ?? null,
      // Only return URLs we actually scraped — never invented ones.
      sourceUrls: usedUrl ? [usedUrl, ...pages.map((p) => p.url).filter((u) => u !== usedUrl)] : pages.map((p) => p.url),
      sourceNotes: [finalNotes, ...pages.map((p) => `• ${p.url}`)].filter(Boolean).join("\n"),
      returnEvidenceText: figures.returnEvidenceText ?? null,
      scrapedPageCount: pages.length,
    };

    console.log(`[lookup-fund] total: ${Date.now() - t0}ms`);
    return jsonResponse({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("lookup-fund error:", msg);
    if (msg === "RATE_LIMIT") {
      return jsonResponse({ error: "Rate limit exceeded. Try again in a moment." }, 429);
    }
    if (msg === "PAYMENT_REQUIRED") {
      return jsonResponse({
        error: "AI credits exhausted. Add credits in Settings → Workspace → Usage.",
      }, 402);
    }
    return jsonResponse({ error: msg }, 500);
  }
});

function emptyResult(
  parsed: Record<string, unknown>,
  query: string,
  attemptedUrls: string[],
  reason: string,
): Record<string, unknown> {
  const emailMatch = query.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return {
    clientName: parsed.clientName ?? null,
    clientEmail: parsed.clientEmail ?? (emailMatch ? emailMatch[0] : null),
    fundName: parsed.fundName ?? null,
    modelLabel: parsed.modelLabel ?? null,
    age: parsed.age ?? null,
    retirementAge: parsed.retirementAge ?? null,
    annualIncome: parsed.annualIncome ?? null,
    superBalance: parsed.superBalance ?? null,
    goalBalance: parsed.goalBalance ?? null,
    desiredIncomeAmount: parsed.desiredIncomeAmount ?? null,
    desiredIncomeFrequency: parsed.desiredIncomeFrequency ?? null,
    adminFeeFlat: null,
    adminFeePct: null,
    grossReturn: null,
    growthAssetsPct: null,
    investmentRiskProfile: null,
    sourceUrls: attemptedUrls,
    sourceNotes: reason,
    returnEvidenceText: null,
    scrapedPageCount: 0,
  };
}
