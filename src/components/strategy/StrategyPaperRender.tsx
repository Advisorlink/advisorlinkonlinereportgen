import { fmtMoney, fmtPct } from "@/lib/calc";
import {
  runScenario,
  employerSG,
  netEmployerContrib,
  annualAdviceFee,
  ageFromDob,
  type StrategyPaperData,
} from "@/lib/strategy-calc";
import { forwardRef } from "react";

interface Props {
  data: StrategyPaperData;
}

// A4 page shell matching the report generator's print styles.
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="strategy-page bg-white text-slate-900 mx-auto shadow-lg print:shadow-none"
      style={{ width: "210mm", minHeight: "297mm", padding: "16mm 14mm" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-slate-800 border-b-2 border-slate-800 pb-1 mb-3">
      {children}
    </h2>
  );
}

function Row({ label, existing, comparison, highlight }: { label: string; existing: React.ReactNode; comparison: React.ReactNode; highlight?: boolean }) {
  return (
    <tr className={highlight ? "bg-emerald-50" : ""}>
      <td className="p-2 text-[11px] font-medium text-slate-700 border border-slate-200">{label}</td>
      <td className="p-2 text-[11px] text-slate-900 border border-slate-200 bg-sky-50">{existing}</td>
      <td className="p-2 text-[11px] text-slate-900 border border-slate-200 bg-indigo-100">{comparison}</td>
    </tr>
  );
}

export const StrategyPaperRender = forwardRef<HTMLDivElement, Props>(function StrategyPaperRender({ data }, ref) {
  const age = ageFromDob(data.clientDob);
  const yearsToRet = Math.max(0, data.retirementAge - age);
  const sg = employerSG(data.annualIncome);
  const sgNet = netEmployerContrib(data.annualIncome);

  const ex = runScenario(data, data.existing);
  const cmp = runScenario(data, data.comparison);

  const exAdvice = annualAdviceFee(data.existing.superBalance, { adviceFeeFlat: 0, annualAdvicePct: data.fees.annualAdvicePct, annualFeeCap: data.fees.annualFeeCap });
  const cmpAdvice = annualAdviceFee(data.comparison.superBalance || data.existing.superBalance, { adviceFeeFlat: 0, annualAdvicePct: data.fees.annualAdvicePct, annualFeeCap: data.fees.annualFeeCap });

  const uplift = cmp.projectedBalance - ex.projectedBalance;

  return (
    <div ref={ref} className="space-y-4">
      {/* PAGE 1 — client summary + super comparison */}
      <Page>
        <div className="border-b-4 border-slate-800 pb-3 mb-5">
          <div className="text-[10px] tracking-[0.3em] text-slate-500 uppercase">Financial Advice Strategy Paper</div>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">{data.clientName || "Client Name"}</h1>
          <div className="text-[11px] text-slate-600 mt-1">
            Age {age} · Retiring at {data.retirementAge} ({yearsToRet} years to go) · Prepared {new Date().toLocaleDateString("en-AU")}
          </div>
        </div>

        <SectionTitle>Client Profile</SectionTitle>
        <div className="grid grid-cols-4 gap-3 mb-6 text-[11px]">
          <div><div className="text-slate-500 text-[9px] uppercase tracking-wider">Annual income</div><div className="font-semibold text-slate-900">{fmtMoney(data.annualIncome)}</div></div>
          <div><div className="text-slate-500 text-[9px] uppercase tracking-wider">Employer SG (12%)</div><div className="font-semibold text-slate-900">{fmtMoney(sg)}</div></div>
          <div><div className="text-slate-500 text-[9px] uppercase tracking-wider">Net SG after 15% tax</div><div className="font-semibold text-slate-900">{fmtMoney(sgNet)}</div></div>
          <div><div className="text-slate-500 text-[9px] uppercase tracking-wider">Personal contrib.</div><div className="font-semibold text-slate-900">{fmtMoney(data.personalContributionAmount)} {data.personalContributionFrequency}</div></div>
          <div><div className="text-slate-500 text-[9px] uppercase tracking-wider">Desired income</div><div className="font-semibold text-slate-900">{fmtMoney(data.desiredIncomeAmount)} {data.desiredIncomeFrequency}</div></div>
          <div><div className="text-slate-500 text-[9px] uppercase tracking-wider">Retirement goal</div><div className="font-semibold text-slate-900">{fmtMoney(data.goalBalance)}</div></div>
        </div>

        <SectionTitle>Superannuation Comparison</SectionTitle>
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr>
              <th className="p-2 text-[10px] uppercase tracking-wider text-left border border-slate-300 bg-slate-100 w-1/3"></th>
              <th className="p-2 text-[10px] uppercase tracking-wider text-left border border-slate-300 bg-sky-100 text-sky-900">Existing Scenario</th>
              <th className="p-2 text-[10px] uppercase tracking-wider text-left border border-slate-300 bg-indigo-200 text-indigo-900">Comparison Scenario</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Fund" existing={data.existing.fundName || "—"} comparison={data.comparison.fundName || "—"} />
            <Row label="Super balance" existing={fmtMoney(data.existing.superBalance)} comparison={fmtMoney(data.comparison.superBalance || data.existing.superBalance)} />
            <Row label="Investment model" existing={data.existing.modelLabel} comparison={data.comparison.modelLabel} />
            <Row label="Risk profile" existing={data.existing.riskProfile} comparison={data.comparison.riskProfile} />
            <Row label="Investment options" existing={data.existing.numInvestmentOptions} comparison={data.comparison.numInvestmentOptions} />
            <Row label="5-yr avg return" existing={fmtPct(data.existing.fiveYearReturn, 2)} comparison={fmtPct(data.comparison.fiveYearReturn, 2)} highlight />
            <Row label="Admin fee (%)" existing={fmtPct(data.existing.adminFeePct, 2)} comparison={fmtPct(data.comparison.adminFeePct, 2)} />
            <Row label="Admin fee flat" existing={fmtMoney(data.existing.adminFeeFlat)} comparison={fmtMoney(data.comparison.adminFeeFlat)} />
            <Row label="Existing adviser fee" existing={fmtMoney(data.existing.adviserFee)} comparison="—" />
          </tbody>
        </table>

        <SectionTitle>Insurance Comparison</SectionTitle>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-[10px] uppercase tracking-wider text-left border border-slate-300 bg-slate-100 w-1/3"></th>
              <th className="p-2 text-[10px] uppercase tracking-wider text-left border border-slate-300 bg-sky-100 text-sky-900">Existing</th>
              <th className="p-2 text-[10px] uppercase tracking-wider text-left border border-slate-300 bg-indigo-200 text-indigo-900">Comparison</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Provider" existing={data.existingInsurance.provider || "—"} comparison={data.comparisonInsurance.provider || "—"} />
            <Row label="Life cover" existing={fmtMoney(data.existingInsurance.lifeCover)} comparison={fmtMoney(data.comparisonInsurance.lifeCover)} />
            <Row label="TPD cover" existing={fmtMoney(data.existingInsurance.tpdCover)} comparison={fmtMoney(data.comparisonInsurance.tpdCover)} />
            <Row label="Income protection" existing={`${fmtMoney(data.existingInsurance.ipMonthly)} / month`} comparison={`${fmtMoney(data.comparisonInsurance.ipMonthly)} / month`} />
            <Row label="Waiting period" existing={data.existingInsurance.waitingPeriod} comparison={data.comparisonInsurance.waitingPeriod} />
            <Row label="Benefit period" existing={data.existingInsurance.benefitPeriod} comparison={data.comparisonInsurance.benefitPeriod} />
            <Row label="Premium (annual)" existing={fmtMoney(data.existingInsurance.premiumAnnual)} comparison={fmtMoney(data.comparisonInsurance.premiumAnnual)} />
            <Row label="Structure" existing={data.existingInsurance.structure} comparison={data.comparisonInsurance.structure} />
            <Row label="IP type" existing={data.existingInsurance.type} comparison={data.comparisonInsurance.type} />
          </tbody>
        </table>
      </Page>

      {/* PAGE 2 — projections */}
      <Page>
        <SectionTitle>Retirement Funding Projections</SectionTitle>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-sky-50 border border-sky-200">
            <div className="text-[10px] uppercase tracking-wider text-sky-700 font-semibold">Existing Scenario — projected balance at {data.retirementAge}</div>
            <div className="text-3xl font-bold text-sky-900 mt-1">{fmtMoney(ex.projectedBalance)}</div>
            <div className="text-[11px] text-sky-800 mt-2">Money lasts until age <span className="font-bold">{ex.moneyNeverRunsOut ? "N/A" : ex.ageMoneyLasts}</span></div>
            <div className="text-[11px] text-sky-800">Total retirement income: <span className="font-bold">{ex.moneyNeverRunsOut ? "N/A" : fmtMoney(ex.totalIncome)}</span></div>
          </div>
          <div className="p-4 rounded-lg bg-indigo-100 border border-indigo-300">
            <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-semibold">Comparison Scenario — projected balance at {data.retirementAge}</div>
            <div className="text-3xl font-bold text-indigo-900 mt-1">{fmtMoney(cmp.projectedBalance)}</div>
            <div className="text-[11px] text-indigo-800 mt-2">Money lasts until age <span className="font-bold">{cmp.moneyNeverRunsOut ? "N/A" : cmp.ageMoneyLasts}</span></div>
            <div className="text-[11px] text-indigo-800">Total retirement income: <span className="font-bold">{cmp.moneyNeverRunsOut ? "N/A" : fmtMoney(cmp.totalIncome)}</span></div>
          </div>
        </div>

        {uplift > 0 && (
          <div className="p-4 rounded-lg bg-emerald-50 border-2 border-emerald-300 mb-6">
            <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Potential uplift at retirement</div>
            <div className="text-4xl font-bold text-emerald-800 mt-1">{fmtMoney(uplift)}</div>
          </div>
        )}

        {(ex.moneyNeverRunsOut || cmp.moneyNeverRunsOut) && (
          <div className="p-3 rounded bg-amber-50 border border-amber-300 text-[11px] text-amber-900 mb-6">
            <strong>Note:</strong> One or both scenarios show <em>N/A</em> for age money lasts because projected balance is high enough that funds don't deplete before age 100. Consider lowering the retirement age to show a meaningful comparison.
          </div>
        )}

        <SectionTitle>Accumulation Projection (Age {age} → {data.retirementAge})</SectionTitle>
        <table className="w-full border-collapse text-[10px] mb-6">
          <thead>
            <tr>
              <th className="p-1.5 border border-slate-300 bg-slate-100 text-left">Age</th>
              <th className="p-1.5 border border-slate-300 bg-sky-100 text-right">Existing balance</th>
              <th className="p-1.5 border border-slate-300 bg-indigo-200 text-right">Comparison balance</th>
            </tr>
          </thead>
          <tbody>
            {ex.accumulationSeries.map((r, i) => (
              <tr key={r.age}>
                <td className="p-1.5 border border-slate-200 font-medium">{r.age}</td>
                <td className="p-1.5 border border-slate-200 text-right bg-sky-50/50">{fmtMoney(r.balance)}</td>
                <td className="p-1.5 border border-slate-200 text-right bg-indigo-50">{fmtMoney(cmp.accumulationSeries[i]?.balance ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Page>

      {/* PAGE 3 — fees + notes */}
      <Page>
        <SectionTitle>Fees Summary</SectionTitle>
        <table className="w-full border-collapse mb-6">
          <tbody>
            <Row label="Advice / implementation fee (one-off)" existing="—" comparison={fmtMoney(data.fees.adviceFeeFlat)} />
            <Row label="Annual advice fee %" existing={fmtPct(0, 2)} comparison={fmtPct(data.fees.annualAdvicePct, 2)} />
            <Row label="Annual advice fee cap" existing="—" comparison={fmtMoney(data.fees.annualFeeCap)} />
            <Row label="Effective annual advice fee (yr 1)" existing={fmtMoney(exAdvice)} comparison={fmtMoney(cmpAdvice)} highlight />
          </tbody>
        </table>

        <SectionTitle>Withdrawal Phase — Existing</SectionTitle>
        <table className="w-full border-collapse text-[10px] mb-6">
          <thead>
            <tr>
              <th className="p-1.5 border border-slate-300 bg-slate-100 text-left">Age</th>
              <th className="p-1.5 border border-slate-300 bg-sky-100 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {ex.withdrawalSeries.map(r => (
              <tr key={r.age}>
                <td className="p-1.5 border border-slate-200 font-medium">{r.age}</td>
                <td className="p-1.5 border border-slate-200 text-right">{fmtMoney(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <SectionTitle>Withdrawal Phase — Comparison</SectionTitle>
        <table className="w-full border-collapse text-[10px] mb-6">
          <thead>
            <tr>
              <th className="p-1.5 border border-slate-300 bg-slate-100 text-left">Age</th>
              <th className="p-1.5 border border-slate-300 bg-indigo-200 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {cmp.withdrawalSeries.map(r => (
              <tr key={r.age}>
                <td className="p-1.5 border border-slate-200 font-medium">{r.age}</td>
                <td className="p-1.5 border border-slate-200 text-right">{fmtMoney(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.researchNotes && (
          <>
            <SectionTitle>Research Notes</SectionTitle>
            <div className="p-3 rounded bg-slate-50 border border-slate-200 text-[11px] whitespace-pre-wrap text-slate-800">
              {data.researchNotes}
            </div>
          </>
        )}

        <div className="mt-8 pt-4 border-t border-slate-300 text-[9px] text-slate-500 leading-relaxed">
          Projections use the same calculation engine as the Super Health Check report.
          Figures assume employer SG at 12% (contributions tax 15%), 2.5% inflation adjustment on withdrawals,
          and periodic 10%/5% market dip years in accumulation/withdrawal phases respectively.
          This document is general in nature and not personal financial advice.
        </div>
      </Page>
    </div>
  );
});
