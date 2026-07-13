// Generate human-sounding research notes for a Finance Direct strategy paper.
// Uses Lovable AI Gateway (LOVABLE_API_KEY, no user key required).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function stripEmDashes(s: string): string {
  // The client explicitly does not want em dashes anywhere. Also normalise
  // en dashes and any surrounding whitespace.
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      clientName, age, retirementAge, yearsToRet,
      annualIncome, desiredIncomeAmount, desiredIncomeFrequency,
      goalBalance,
      existing, comparison,
      existingInsurance, comparisonInsurance,
      ex, cmp,
      uplift, upliftPct, incomeUplift,
    } = body;

    const system = `You are a senior Australian financial adviser at Finance Direct writing personalised strategy paper commentary. Voice: warm, human, plain-spoken, confident. Never robotic. Never repetitive. Never use em dashes or en dashes (— or –). Use commas or full stops instead. Never use the phrase "in conclusion" or "moreover" or "furthermore". Do not restate the same fact in multiple sections. Each section covers a distinct angle. Australian English. No emojis. No markdown. Reference the client by first name only. Numbers as written by a person (e.g. "$1.2 million", "an extra $180,000", "roughly 12%"). Keep each field within its word limit.`;

    const userPrompt = `Write four short pieces of commentary for ${clientName || "the client"}'s strategy paper. Every piece must be specific to their actual numbers and must NOT repeat the same idea another piece already covers.

CLIENT CONTEXT
Name: ${clientName}
Age: ${age}, retiring at ${retirementAge} (${yearsToRet} years away)
Annual income: $${annualIncome}
Desired retirement income: $${desiredIncomeAmount} ${desiredIncomeFrequency}
Retirement goal balance: $${goalBalance}

EXISTING SUPER
Fund: ${existing.fundName}
Balance: $${existing.superBalance}
Investment: ${existing.modelLabel} (${existing.riskProfile})
5yr avg return: ${(existing.fiveYearReturn * 100).toFixed(2)}%
Admin fee: ${(existing.adminFeePct * 100).toFixed(2)}% + $${existing.adminFeeFlat}
Projected balance at retirement: $${Math.round(ex.projectedBalance)}
Money lasts to: ${ex.moneyNeverRunsOut ? "age 100+" : "age " + ex.ageMoneyLasts}
Total lifetime income: $${Math.round(ex.totalIncome)}

RECOMMENDED SUPER
Fund: ${comparison.fundName}
Investment: ${comparison.modelLabel} (${comparison.riskProfile})
5yr avg return: ${(comparison.fiveYearReturn * 100).toFixed(2)}%
Admin fee: ${(comparison.adminFeePct * 100).toFixed(2)}% + $${comparison.adminFeeFlat}
Projected balance at retirement: $${Math.round(cmp.projectedBalance)}
Money lasts to: ${cmp.moneyNeverRunsOut ? "age 100+" : "age " + cmp.ageMoneyLasts}
Total lifetime income: $${Math.round(cmp.totalIncome)}

DIFFERENCES
Balance uplift at retirement: $${Math.round(uplift)} (${upliftPct.toFixed(1)}%)
Extra retirement income: $${Math.round(incomeUplift)}

INSURANCE (existing vs recommended)
Existing: ${existingInsurance.provider}, Life $${existingInsurance.lifeCover}, TPD $${existingInsurance.tpdCover}, IP $${existingInsurance.ipMonthly}/m, ${existingInsurance.waitingPeriod}/${existingInsurance.benefitPeriod}, ${existingInsurance.structure}, ${existingInsurance.type}, premium $${existingInsurance.premiumAnnual}/yr
Recommended: ${comparisonInsurance.provider}, Life $${comparisonInsurance.lifeCover}, TPD $${comparisonInsurance.tpdCover}, IP $${comparisonInsurance.ipMonthly}/m, ${comparisonInsurance.waitingPeriod}/${comparisonInsurance.benefitPeriod}, ${comparisonInsurance.structure}, ${comparisonInsurance.type}, premium $${comparisonInsurance.premiumAnnual}/yr

WRITE THESE FOUR FIELDS (each distinct, no overlap):

1. observation (max 55 words): A short, specific observation about the return and fee comparison between the two funds. Focus ONLY on the fund construction differences (returns, fees, options). Do not talk about longevity or lifetime income here.

2. keyInsight (max 45 words): The single most important compounding insight for this client over their ${yearsToRet}-year horizon. Focus ONLY on how the extra return compounds into the balance uplift. Do not repeat the return/fee numbers already covered in observation.

3. patternExisting (max 70 words): What pattern to watch under the EXISTING arrangement. Talk about longevity, drawdown pressure, and what happens later in retirement if nothing changes. Do not talk about the recommended portfolio here.

4. compoundingRecommended (max 70 words): The compounding effect under the RECOMMENDED arrangement. Talk about what the extra capital enables in retirement (flexibility, longevity, legacy, aged care). Do not talk about the existing arrangement here.

5. researchNotes (max 110 words): Adviser research rationale. Cover the WHY behind the recommendation, including any insurance restructure logic and product research reasoning. This is the only place insurance is discussed in depth. Do not repeat the compounding or longevity language from the other fields.

Return valid JSON only, no code fences, this exact shape:
{"observation":"...","keyInsight":"...","patternExisting":"...","compoundingRecommended":"...","researchNotes":"..."}`;

    const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!gwRes.ok) {
      const errText = await gwRes.text();
      return new Response(JSON.stringify({ error: `AI gateway ${gwRes.status}: ${errText}` }), {
        status: gwRes.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const j = await gwRes.json();
    const content: string = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to salvage JSON if the model wrapped it in prose.
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const out = {
      observation: stripEmDashes(parsed.observation ?? ""),
      keyInsight: stripEmDashes(parsed.keyInsight ?? ""),
      patternExisting: stripEmDashes(parsed.patternExisting ?? ""),
      compoundingRecommended: stripEmDashes(parsed.compoundingRecommended ?? ""),
      researchNotes: stripEmDashes(parsed.researchNotes ?? ""),
    };

    return new Response(JSON.stringify(out), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
