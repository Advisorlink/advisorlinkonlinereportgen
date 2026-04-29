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

const lookupCache = new Map<
  string,
  { expiresAt: number; data: Record<string, unknown> }
>();
const CACHE_MS = 0; // disabled — every click must re-fetch the latest published figures

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeQuery = (q: string) =>
  q.toLowerCase().replace(/\s+/g, " ").trim();
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

function isOfficialFundUrl(
  url: string,
  fundName: string,
  officialHosts: string[],
): boolean {
  const host = hostFrom(url);
  if (!host || !isAllowedOfficialCandidate(url)) return false;
  if (officialHosts.length) {
    return officialHosts.some((h) => host === h || host.endsWith(`.${h}`));
  }
  const compactHost = host.replace(/[^a-z0-9]/g, "");
  return fundHostTokens(fundName).some((token) => compactHost.includes(token));
}

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

async function fetchPageText(
  url: string,
  timeoutMs = 45000,
): Promise<string | null> {
  // Use Firecrawl for full JS rendering — same content Gemini.google.com sees
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
          waitFor: 2500,
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
        if (Number(statusCode) >= 400 || missingPage) {
          console.warn(
            "Firecrawl scrape rejected missing page",
            url,
            statusCode ?? "unknown",
          );
          return null;
        }
        if (normalized.length > 200) return normalized;
      } else {
        console.warn(
          "Firecrawl scrape non-ok",
          url,
          resp.status,
          await resp.text().catch(() => ""),
        );
      }
    } catch (e) {
      console.warn(
        "Firecrawl scrape failed",
        url,
        e instanceof Error ? e.message : e,
      );
    }
  }

  // Fallback: plain fetch
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
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
      const missingPage =
        /\b(404|page not found|doesn[’']?t seem to exist|couldn[’']?t find this page)\b/i
          .test(text.slice(0, 1200));
      if (missingPage) return null;
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
    const resp = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit }),
    });
    if (!resp.ok) {
      console.warn(
        "Firecrawl search non-ok",
        resp.status,
        await resp.text().catch(() => ""),
      );
      return [];
    }
    const j = await resp.json();
    const results = j?.data?.web ?? j?.data ?? j?.web ?? [];
    const urls: string[] = [];
    for (const r of Array.isArray(results) ? results : []) {
      if (typeof r?.url === "string") urls.push(r.url);
    }
    return urls;
  } catch (e) {
    console.warn("Firecrawl search failed", e instanceof Error ? e.message : e);
    return [];
  }
}

function pctVariants(decimal: unknown): string[] {
  if (typeof decimal !== "number" || !Number.isFinite(decimal)) return [];
  const pct = decimal * 100;
  return Array.from(
    new Set([
      stripTrailingZeros(pct.toFixed(3)),
      stripTrailingZeros(pct.toFixed(2)),
      stripTrailingZeros(pct.toFixed(1)),
    ].filter(Boolean)),
  );
}

function optionTokens(modelLabel: unknown): string[] {
  return String(modelLabel ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) =>
      t.length > 3 &&
      !["default", "mysuper", "option", "super", "fund"].includes(t)
    );
}

function returnAppearsNearOption(
  pageText: string,
  grossReturn: unknown,
  modelLabel: unknown,
): boolean {
  const variants = pctVariants(grossReturn);
  if (!variants.length) return false;
  const tokens = optionTokens(modelLabel);
  const normalized = pageText.toLowerCase().replace(/\s+/g, " ");
  for (const v of variants) {
    const re = new RegExp(`${escapeRegExp(v)}\\s*%`, "i");
    const m = re.exec(normalized);
    if (!m) continue;
    const ctx = normalized.slice(Math.max(0, m.index - 800), m.index + 800);
    const fiveYr = /(5|five)\s*[- ]?\s*(year|years|yr|yrs)/i.test(ctx);
    const optionMatch = tokens.length === 0 ||
      tokens.some((t) => ctx.includes(t));
    if (fiveYr && optionMatch) return true;
  }
  return false;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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
        tools: [{ type: "google_search" }, ...tools],
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

// ---------- STEP 1: parse client text + find official source URLs ----------

const NOW = new Date();
const CURRENT_YEAR = NOW.getUTCFullYear();
const PREV_YEAR = CURRENT_YEAR - 1;

const STEP1_SYSTEM =
  `You are a research assistant for Australian superannuation. You have Gemini 3 Google Search lookup enabled — USE IT for every lookup. Today's date is ${
    NOW.toISOString().slice(0, 10)
  }.

For the named fund, you MUST locate the OFFICIAL fund website pages (and PDS / Investment Guide if needed) that publish:
  (a) the MOST RECENTLY PUBLISHED investment performance / returns table for the allocated investment option (must show 5-year p.a. return, as recent as possible — ideally as at a ${CURRENT_YEAR} month-end, or otherwise the most recent ${PREV_YEAR} update), and
  (b) the current fees & costs (admin fee + asset-based admin fee), and
  (c) the strategic asset allocation / growth assets % and the official risk profile label.

Rules:
- Identify WHICHEVER Australian super fund the user names — industry, retail, corporate, public sector, SMSF platform, etc. Never default to AustralianSuper or any specific fund.
- Use ONLY URLs that Gemini 3 lookup finds on the fund's own official domain. Never invent URLs. Never use third-party comparison sites, news, blogs, SuperRatings, Canstar, Chant West, etc.
- Add search terms like "${CURRENT_YEAR}", "monthly returns", "performance update", "as at" to find the freshest performance page. Prefer the live performance dashboard / monthly update page over PDS PDFs (PDS data is usually stale).
- Return up to 6 URLs, ordered by RECENCY of the published 5-year p.a. figure (newest performance/returns/dashboard pages first, then PDS/Investment Guide as fallback). The URLs must be real lookup results or pages clearly reached from real lookup results.
- Also parse the client's personal details from the free-text input.

Frequencies must be exactly "Weekly", "Monthly", or "Annually".
Convert "k" → thousands, "m" → millions; strip $ and commas.`;

const STEP1_TOOL = [{
  type: "function",
  function: {
    name: "find_sources",
    description:
      "Return parsed client details and official fund URLs to scrape.",
    parameters: {
      type: "object",
      properties: {
        clientName: { type: ["string", "null"] },
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
        sourceUrls: {
          type: "array",
          items: { type: "string" },
          description:
            "Up to 6 real official fund URLs found by Gemini 3 lookup, performance/returns pages first.",
        },
        notes: { type: "string" },
      },
      required: ["fundName", "modelLabel", "sourceUrls"],
      additionalProperties: false,
    },
  },
}];

// ---------- STEP 2: extract verified figures from REAL scraped page text ----------

const STEP2_SYSTEM =
  `You extract Australian super fund figures from RAW WEBSITE TEXT that has been fetched from the official fund's website. Today's date is ${
    NOW.toISOString().slice(0, 10)
  }.

Strict rules:
- ONLY use numbers that literally appear in the provided page text. Do NOT use prior knowledge, do NOT estimate, do NOT use other time periods.
- grossReturn must be the 5-year p.a. return for the EXACT allocated investment option, copied straight from the page text — whatever the website publishes (net or gross, whichever is shown). Do not convert or adjust it. If both are shown, prefer the one labelled net; otherwise just take whatever 5-year p.a. figure the page shows for that option. If no 5-year figure is shown for that option, return null.
- If MULTIPLE pages each show a 5-year p.a. figure for the option, ALWAYS pick the one with the most recent "as at" date (e.g. prefer "as at 31 ${CURRENT_YEAR}" over a PDS dated ${
    PREV_YEAR - 1
  }). State the as-of date in sourceNotes.
- adminFeeFlat: annual flat admin fee in AUD (multiply weekly fees by 52). Null if not in text.
- adminFeePct: annual asset-based admin/trustee fee as a DECIMAL (0.0035 = 0.35%). Exclude investment fees. Null if not in text.
- growthAssetsPct: strategic growth-asset allocation as DECIMAL (0.70 = 70%). Null if not in text.
- investmentRiskProfile: official risk label exactly as the page calls it (e.g. "High", "Medium to High", "Growth"). Null if not in text.
- returnEvidenceText: copy the exact short snippet from the page text that contains the 5-year return + option label + as-of date if shown.
- sourceNotes: short explanation including which URL the 5yr return came from AND the as-of date.
- Never use standard knowledge or memory. If a value is not literally in the provided text, return null for that field.
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
        adminFeePct: {
          type: ["number", "null"],
          description: "Decimal e.g. 0.0035",
        },
        grossReturn: {
          type: ["number", "null"],
          description:
            "Decimal e.g. 0.0633 — exact 5yr p.a. return shown on the website",
        },
        growthAssetsPct: {
          type: ["number", "null"],
          description: "Decimal e.g. 0.70",
        },
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

    const cacheKey = normalizeQuery(query);
    const cached = lookupCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return jsonResponse({ data: cached.data, cached: true });
    }

    // ---- Step 1: parse + find URLs ----
    const step1 = await callAI(
      [{ role: "system", content: STEP1_SYSTEM }, {
        role: "user",
        content: query,
      }],
      STEP1_TOOL,
      "find_sources",
    );
    if (!step1) {
      return jsonResponse({ error: "AI did not return source URLs" }, 502);
    }

    let candidateUrls: string[] = [];
    const fundName = String(step1.fundName ?? "").trim();
    const optionLabel = String(step1.modelLabel ?? "").trim();
    const aiUrls = urlsFrom(step1.sourceUrls).filter(
      isAllowedOfficialCandidate,
    );
    const fundTokens = fundHostTokens(fundName);
    const officialHosts = Array.from(
      new Set(
        aiUrls.map(hostFrom).filter((h): h is string => Boolean(h)).filter((
          h,
        ) =>
          fundTokens.some((token) =>
            h.replace(/[^a-z0-9]/g, "").includes(token)
          )
        ),
      ),
    );

    // Augment with Firecrawl web search — finds the freshest performance pages
    if (fundName) {
      const searchQueries = [
        `${fundName} ${optionLabel} 5 year performance ${CURRENT_YEAR}`,
        `${fundName} investment performance monthly update ${CURRENT_YEAR}`,
        `${fundName} ${optionLabel} returns as at ${CURRENT_YEAR}`,
        `${fundName} fees costs asset allocation ${CURRENT_YEAR}`,
      ];
      for (const q of searchQueries) {
        const found = (await firecrawlSearch(q, 5)).filter(
          (url) => isOfficialFundUrl(url, fundName, officialHosts),
        );
        candidateUrls.push(...found);
      }
    }
    if (!candidateUrls.length) {
      candidateUrls = aiUrls.filter(
        (url) => isOfficialFundUrl(url, fundName, officialHosts),
      );
    }
    candidateUrls = Array.from(new Set(candidateUrls)).slice(0, 8);

    // ---- Step 2: actually scrape those pages and extract figures ----
    const pages: { url: string; text: string }[] = [];
    for (const url of candidateUrls) {
      const text = await fetchPageText(url);
      if (text && text.length > 200) {
        pages.push({ url, text: text.slice(0, 22000) });
      }
      if (pages.length >= 5) break;
    }

    let figures: Record<string, unknown> = {
      adminFeeFlat: null,
      adminFeePct: null,
      grossReturn: null,
      growthAssetsPct: null,
      investmentRiskProfile: null,
      returnEvidenceText: null,
      sourceNotes: "",
    };

    if (pages.length) {
      const userBlock =
        `Fund: ${step1.fundName}\nAllocated investment option: ${step1.modelLabel}\n\n` +
        pages.map((p, i) => `===== SOURCE ${i + 1}: ${p.url} =====\n${p.text}`)
          .join("\n\n");

      const step2 = await callAI(
        [{ role: "system", content: STEP2_SYSTEM }, {
          role: "user",
          content: userBlock,
        }],
        STEP2_TOOL,
        "extract_fund_figures",
      );
      if (step2) figures = step2;

      // Hard verification: the percentage we extracted must literally appear
      // in the scraped page text near a 5-year mention and the option label.
      const allText = pages.map((p) => p.text).join("\n");
      if (
        figures.grossReturn != null &&
        !returnAppearsNearOption(allText, figures.grossReturn, step1.modelLabel)
      ) {
        figures.grossReturn = null;
        figures.sourceNotes = `${
          figures.sourceNotes ?? ""
        }\nVerification: extracted 5-year return could not be located near "${step1.modelLabel}" + "5 year" in the official page text, so it was discarded.`
          .trim();
      }
    } else {
      figures.sourceNotes =
        "No official fund pages could be scraped — fees and 5-year net return were not auto-filled. Please fill manually.";
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
      sourceNotes: [figures.sourceNotes, ...pages.map((p) => `• ${p.url}`)]
        .filter(Boolean).join("\n"),
      sourceUrls: pages.map((p) => p.url),
      returnEvidenceText: figures.returnEvidenceText ?? null,
      scrapedPageCount: pages.length,
    };

    lookupCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_MS });
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
