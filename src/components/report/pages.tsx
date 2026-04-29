import type { ReportSummary } from "@/lib/calc";
import {
  fmtMoney, fmtPct,
  comparisonAdminPct, COMPARISON_ADMIN_FLAT,
  comparisonAnnualFee, comparisonAdviceFee,
} from "@/lib/calc";
import {
  PageShell, PageHeader, PageFooter, KpiCard, SectionCard,
  ProgressBar, ComparisonBar, Gauge,
  AccumulationChart, WithdrawalChart,
  FeeRow, FeeTableHeader, Disclaimer,
} from "./primitives";
import riskIllustration from "@/assets/risk-illustration.jpg";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-navy tabular-nums">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 1 — COVER                                                     */
/* ------------------------------------------------------------------ */
export function CoverPage({ s }: { s: ReportSummary }) {
  return (
    <PageShell>
      <PageHeader />
      <div className="relative -mx-14 -mt-2 mb-6 px-14 py-10 rounded-b-[28px] bg-gradient-to-br from-navy to-[hsl(215_60%_18%)] text-navy-foreground overflow-hidden">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-cyan/20 blur-2xl" />
        <div className="absolute -right-8 top-8 w-40 h-40 rounded-full bg-cyan/30" />
        <h1 className="relative text-[44px] leading-[1.05] font-black tracking-tight">
          SUPER HEALTH<br/>CHECK
        </h1>
        <p className="relative mt-3 text-sm max-w-md opacity-80">
          A complete review of your superannuation: current position, projection to retirement, income outlook, fees and a comparison scenario.
        </p>
        <div className="relative mt-5 flex gap-2">
          <span className="px-2.5 py-1 rounded-md bg-white/10 backdrop-blur text-[10px] font-bold tracking-wider">PREPARED FOR</span>
          <span className="px-2.5 py-1 rounded-md bg-cyan text-cyan-foreground text-[10px] font-bold tracking-wider">{s.inputs.clientName.toUpperCase()}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="Current Balance" value={fmtMoney(s.startingBalance)} sub={s.inputs.fundName} accent />
        <KpiCard label="Years to Retirement" value={String(s.yearsRemaining)} sub={`Age ${s.inputs.age} → ${s.retirementAge}`} />
        <KpiCard label="Potential Extra" value={fmtMoney(Math.max(0, s.potentialUplift))} sub="At retirement vs current" />
      </div>

      <SectionCard title="What's inside this report" icon="◆">
        <div className="grid grid-cols-2 gap-y-2 text-xs">
          {[
            "Client snapshot & goals",
            "Current fund details",
            "Comparison scenario",
            "Accumulation projection chart",
            "Retirement income & sustainability",
            "Fee comparison (line by line)",
            "Assumptions used",
            "General-advice disclaimer",
          ].map(t => (
            <div key={t} className="flex items-center gap-2">
              <span className="text-cyan font-bold">✓</span>
              <span className="text-foreground">{t}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 2 — CLIENT SNAPSHOT                                           */
/* ------------------------------------------------------------------ */
export function SnapshotPage({ s }: { s: ReportSummary }) {
  const i = s.inputs;
  const sgContrib = i.annualIncome * 0.12 * 0.85;
  return (
    <PageShell>
      <PageHeader pageLabel="CLIENT SNAPSHOT" />
      <h2 className="text-3xl font-black text-navy">Executive snapshot</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Personal details, goals and the current super position at a glance.
      </p>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Age" value={String(i.age)} sub="Current age" />
        <KpiCard label="Target Retirement" value={String(i.retirementAge)} sub="Desired age" />
        <KpiCard label="Years Remaining" value={String(s.yearsRemaining)} sub="Until retirement" />
        <KpiCard label="Goal Balance" value={fmtMoney(s.goalBalance)} sub="Reference goal" accent />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <SectionCard title="Client profile" icon="◉">
          <Row label="Name" value={i.clientName} />
          <Row label="Annual income" value={fmtMoney(i.annualIncome)} />
          <Row label="Net super contribution (12% × 0.85)" value={fmtMoney(sgContrib)} />
          <Row label="Desired retirement income" value={`${fmtMoney(i.desiredIncomeAmount)} ${i.desiredIncomeFrequency.toLowerCase()}`} />
          <Row label="Annualised desired income" value={fmtMoney(s.annualWithdrawal)} />
        </SectionCard>
        <SectionCard title="Goals" icon="◆">
          <Row label="Retirement age goal" value={i.retirementAge} />
          <Row label="Reference balance goal" value={fmtMoney(s.goalBalance)} />
          <Row label="Projected balance at retirement" value={fmtMoney(s.projectedExisting)} />
          <Row label="Goal progress" value={fmtPct(s.goalProgressPct)} />
          <div className="mt-3">
            <ProgressBar pct={s.goalProgressPct} label={`${(s.goalProgressPct * 100).toFixed(1)}% of goal`} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Position summary" icon="✦">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Based on {s.inputs.clientName.split(" ")[0]}'s current balance of <strong className="text-navy">{fmtMoney(s.startingBalance)}</strong>,
          continued contributions of <strong className="text-navy">{fmtMoney(sgContrib)}</strong> per year and the existing fund's net return,
          the projected balance at age {s.retirementAge} is <strong className="text-navy">{fmtMoney(s.projectedExisting)}</strong>.
          The reference goal of {fmtMoney(s.goalBalance)} is included for context only.
        </p>
      </SectionCard>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 3 — CURRENT FUND vs COMPARISON                                */
/* ------------------------------------------------------------------ */
export function FundsPage({ s }: { s: ReportSummary }) {
  const i = s.inputs;
  const cmpAdminFlatPct = COMPARISON_ADMIN_FLAT / i.superBalance;
  const cmpAdminBalPct = comparisonAdminPct(i.superBalance);
  return (
    <PageShell>
      <PageHeader pageLabel="FUND DETAILS" />
      <h2 className="text-3xl font-black text-navy">Current fund vs comparison</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Side-by-side view of the existing fund settings and the comparison scenario used throughout this report.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <SectionCard title="Current fund" icon="◆">
          <Row label="Fund name" value={i.fundName} />
          <Row label="Investment option" value={i.modelLabel} />
          <Row label="Growth assets" value={fmtPct(i.growthAssetsPct, 0)} />
          <Row label="Risk profile" value={s.riskProfile} />
          <Row label="Gross return (assumed)" value={fmtPct(i.grossReturn)} />
          <Row label="Admin fee — flat" value={fmtMoney(i.adminFeeFlat)} />
          <Row label="Admin fee — % of balance" value={fmtPct(i.adminFeePct, 2)} />
          <Row label="Effective admin fee %" value={fmtPct(s.existingAdminPct, 2)} />
          <Row label="Net return after fees & inflation drag" value={fmtPct(s.existingNetReturn - 0.025 - s.existingAdminPct)} />
        </SectionCard>
        <SectionCard title="Comparison scenario" icon="◉">
          <Row label="Scenario" value="Aligned to risk profile" />
          <Row label="Risk profile" value={s.riskProfile} />
          <Row label="Gross return (tiered by profile)" value={fmtPct(s.comparisonReturn)} />
          <Row label="Admin fee — flat" value={fmtMoney(COMPARISON_ADMIN_FLAT)} />
          <Row label="Admin fee — flat as % of balance" value={fmtPct(cmpAdminFlatPct, 2)} />
          <Row label="Admin fee — tiered %" value={fmtPct(cmpAdminBalPct, 2)} />
          <Row label="Annual fee (1.76% capped at $5,000)" value={fmtMoney(comparisonAnnualFee(i.superBalance))} />
          <Row label="Advice fee (4.4% capped at $6,500)" value={fmtMoney(comparisonAdviceFee(i.superBalance))} />
          <Row label="Net return after fees & inflation drag" value={fmtPct(s.comparisonReturn - 0.025 - s.comparisonAdminPct)} />
        </SectionCard>
      </div>

      <SectionCard title="Risk profile band" icon="✦">
        <div className="grid grid-cols-5 gap-2 text-center">
          {(["Conservative", "Moderate", "Balanced", "Growth", "High Growth"] as const).map(p => (
            <div
              key={p}
              className={
                "rounded-lg border px-2 py-3 text-[11px] font-bold " +
                (p === s.riskProfile
                  ? "bg-navy text-navy-foreground border-navy"
                  : "bg-secondary/50 text-muted-foreground border-border")
              }
            >
              {p}
              <div className="text-[9px] font-normal opacity-70 mt-0.5">
                {p === "Conservative" && "5%"}
                {p === "Moderate" && "7%"}
                {p === "Balanced" && "10%"}
                {p === "Growth" && "13%"}
                {p === "High Growth" && "15%"}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Profile is determined by the <strong>growth assets %</strong> of the current investment option.
          Comparison gross returns are illustrative tiered figures.
        </p>
      </SectionCard>

      <div className="mt-5 relative rounded-2xl overflow-hidden bg-gradient-to-br from-navy to-[hsl(215_60%_18%)] flex-1 min-h-[260px]">
        <img
          src={riskIllustration}
          alt="Illustration of long-term superannuation growth toward retirement"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/10 to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 text-navy-foreground">
          <div className="text-[10px] tracking-[0.25em] font-bold text-cyan mb-1">CLIMB, DON'T COAST</div>
          <div className="text-lg font-black leading-tight max-w-sm">
            Make sure you can still climb the mountain. Don't be the one stuck in the bus taking photos.
          </div>
        </div>
      </div>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 4 — ACCUMULATION PROJECTION                                   */
/* ------------------------------------------------------------------ */
export function ProjectionPage({ s }: { s: ReportSummary }) {
  return (
    <PageShell>
      <PageHeader pageLabel="ACCUMULATION" />
      <h2 className="text-3xl font-black text-navy">Projection to retirement</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Year-by-year projection of the current fund vs the comparison scenario, including periodic market dips.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="Current Balance" value={fmtMoney(s.startingBalance)} sub="Today" />
        <KpiCard label="Projected — Current" value={fmtMoney(s.projectedExisting)} sub={`At age ${s.retirementAge}`} />
        <KpiCard label="Projected — Comparison" value={fmtMoney(s.projectedComparison)} sub={`At age ${s.retirementAge}`} accent />
      </div>

      <SectionCard title="Balance projection" icon="◆" className="mb-5">
        <AccumulationChart
          data={s.accumulationSeries}
          retirementAge={s.retirementAge}
          goalBalance={s.goalBalance}
        />
        <div className="grid grid-cols-3 gap-3 mt-3 text-[11px]">
          <div className="rounded-md bg-secondary/50 px-3 py-2">
            <div className="text-muted-foreground">Goal balance</div>
            <div className="font-bold text-navy tabular-nums">{fmtMoney(s.goalBalance)}</div>
          </div>
          <div className="rounded-md bg-secondary/50 px-3 py-2">
            <div className="text-muted-foreground">Difference (current vs goal)</div>
            <div className="font-bold text-navy tabular-nums">{fmtMoney(s.projectedExisting - s.goalBalance)}</div>
          </div>
          <div className="rounded-md bg-cyan/10 px-3 py-2">
            <div className="text-muted-foreground">Potential uplift</div>
            <div className="font-bold text-cyan tabular-nums">{fmtMoney(Math.max(0, s.potentialUplift))}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Selected projection years" icon="◉">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">
          <div>Age</div>
          <div className="text-right">Year</div>
          <div className="text-right">Current</div>
          <div className="text-right">Comparison</div>
        </div>
        {sampleRows(s.accumulationSeries, 6).map((r, idx) => {
          const yearNumber = new Date().getFullYear() + (r.age - s.inputs.age);
          return (
            <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 py-1.5 text-xs border-b border-border last:border-0">
              <div className="font-semibold text-navy">{r.age}</div>
              <div className="text-right text-muted-foreground tabular-nums">{yearNumber}</div>
              <div className="text-right tabular-nums">{fmtMoney(r.existing)}</div>
              <div className="text-right tabular-nums text-cyan font-semibold">{fmtMoney(r.comparison)}</div>
            </div>
          );
        })}
      </SectionCard>

      <PageFooter />
    </PageShell>
  );
}

function sampleRows<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  const step = (arr.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, k) => arr[Math.round(k * step)]);
}

/* ------------------------------------------------------------------ */
/* PAGE 5 — RETIREMENT INCOME & DRAWDOWN                              */
/* ------------------------------------------------------------------ */
export function IncomePage({ s }: { s: ReportSummary }) {
  const maxIncome = Math.max(s.totalIncomeExisting, s.totalIncomeComparison, 1);
  return (
    <PageShell>
      <PageHeader pageLabel="RETIREMENT INCOME" />
      <h2 className="text-3xl font-black text-navy">Retirement income view</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Translating the projected balance into a sustainable retirement income with a defensive investment mix.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="Starting Balance" value={fmtMoney(s.projectedExisting)} sub="Projected at retirement" />
        <KpiCard label="Annual Withdrawal" value={fmtMoney(s.annualWithdrawal)} sub="Desired annual income" accent />
        <KpiCard label="Total Income — Current" value={fmtMoney(s.totalIncomeExisting)} sub={`Over ${s.yearsIncomeExisting} yrs`} />
      </div>

      <SectionCard title="Drawdown projection" icon="◆" className="mb-5">
        <WithdrawalChart existing={s.withdrawalExisting} comparison={s.withdrawalComparison} />
      </SectionCard>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Income sustainability — current">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Money lasts to age</div>
              <div className="text-4xl font-black text-navy tabular-nums">{s.ageMoneyLastsExisting}</div>
              <div className="mt-1 text-xs font-bold text-cyan">{s.yearsIncomeExisting} years of income</div>
            </div>
            <div className="ml-auto"><Gauge value={s.yearsIncomeExisting} max={30} label={`${s.yearsIncomeExisting} yrs`} /></div>
          </div>
        </SectionCard>
        <SectionCard title="Income sustainability — comparison">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Money lasts to age</div>
              <div className="text-4xl font-black text-navy tabular-nums">{s.ageMoneyLastsComparison}</div>
              <div className="mt-1 text-xs font-bold text-cyan">{s.yearsIncomeComparison} years of income</div>
            </div>
            <div className="ml-auto"><Gauge value={s.yearsIncomeComparison} max={30} label={`${s.yearsIncomeComparison} yrs`} /></div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Total income provided" icon="✦" className="mt-5">
        <div className="space-y-3">
          <ComparisonBar label="Current" value={s.totalIncomeExisting} max={maxIncome} displayValue={fmtMoney(s.totalIncomeExisting)} color="navy" />
          <ComparisonBar label="Comparison" value={s.totalIncomeComparison} max={maxIncome} displayValue={fmtMoney(s.totalIncomeComparison)} color="cyan" />
        </div>
      </SectionCard>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 6 — FEES & ASSUMPTIONS & DISCLAIMER                            */
/* ------------------------------------------------------------------ */
export function FeesAndDisclosurePage({ s }: { s: ReportSummary }) {
  const i = s.inputs;
  const exFlat = i.adminFeeFlat;
  const exPctFee = i.adminFeePct * i.superBalance;
  const exTotalFee = exFlat + exPctFee;

  const cmpFlat = COMPARISON_ADMIN_FLAT;
  const cmpAdmin = comparisonAdminPct(i.superBalance) * i.superBalance;
  const cmpAnnual = comparisonAnnualFee(i.superBalance);
  const cmpAdvice = comparisonAdviceFee(i.superBalance);
  const cmpTotalFee = cmpFlat + cmpAdmin + cmpAdvice;

  return (
    <PageShell>
      <PageHeader pageLabel="FEES & ASSUMPTIONS" />
      <h2 className="text-3xl font-black text-navy">Fees & assumptions</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        A line-by-line view of fees, the assumptions powering the projection, and important disclaimers.
      </p>

      <SectionCard title="Annual fee comparison (year 1)" icon="◆" className="mb-5">
        <FeeTableHeader />
        <FeeRow label="Admin fee — flat" current={exFlat} comparison={cmpFlat} />
        <FeeRow label="Admin fee — % of balance" current={exPctFee} comparison={cmpAdmin} />
        
        <FeeRow label="Advice fee (one-off, year 1)" current={0} comparison={cmpAdvice} />
        <FeeRow label="Total" current={exTotalFee} comparison={cmpTotalFee} highlight />
        <p className="text-[10px] text-muted-foreground mt-2">
          Comparison fees include a tiered admin %, and a 4.4% advice fee capped at $6,500 (deducted upfront).
        </p>
      </SectionCard>

      <Disclaimer>
        The information in this Super Health Check is general in nature only and does not take into account
        your personal objectives, financial situation or needs. It is based on the inputs provided and the
        assumptions stated above. Investment returns are not guaranteed; past performance is not a reliable
        indicator of future performance. All figures are illustrative only and should not be relied upon as
        personal financial advice. Before acting on any information you should consider its appropriateness
        having regard to your own circumstances and obtain personal advice from a licensed financial adviser.
        Fees, returns, contribution rates and tax settings used in this report are simplified for illustration.
      </Disclaimer>

      <PageFooter />
    </PageShell>
  );
}
