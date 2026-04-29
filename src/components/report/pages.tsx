import type { ReportSummary } from "@/lib/calc";
import { fmtMoney, fmtPct } from "@/lib/calc";
import { PageShell, PageHeader, PageFooter, KpiCard, SectionCard, ProgressBar, ComparisonBar, Gauge } from "./primitives";

export function CoverPage({ s }: { s: ReportSummary }) {
  return (
    <PageShell>
      <PageHeader />
      {/* Hero */}
      <div className="relative -mx-14 -mt-2 mb-6 px-14 py-10 rounded-b-[28px] bg-gradient-to-br from-navy to-[hsl(215_60%_18%)] text-navy-foreground overflow-hidden">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-cyan/20 blur-2xl" />
        <div className="absolute -right-8 top-8 w-40 h-40 rounded-full bg-cyan/30" />
        <h1 className="relative text-[44px] leading-[1.05] font-black tracking-tight">
          SUPER HEALTH<br/>CHECK
        </h1>
        <p className="relative mt-3 text-sm max-w-md opacity-80">
          A complete modern review of the report experience, calculation visuals and client summary.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <KpiCard label="Prepared For" value={s.inputs.clientName} sub="Client report" />
        <KpiCard label="Current Balance" value={fmtMoney(s.startingBalance)} sub="Existing super balance" accent />
        <KpiCard label="Potential Extra" value={fmtMoney(Math.max(0, s.potentialUplift))} sub="Projected extra benefit" />
      </div>

      <SectionCard title="What this report does" icon="◆">
        <p className="text-sm text-muted-foreground leading-relaxed">
          It converts the key superannuation numbers into a clearer, finance-grade visual story:
          current position, retirement projection, income estimate, potential improvement and next
          steps. This is general information only and is not personal financial advice.
        </p>
      </SectionCard>

      <SectionCard title="Designed for clarity" icon="✦" className="mt-4">
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          {[
            "Modern finance UI",
            "Clear page sections",
            "Visual comparison bars",
            "Simplified assumptions",
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

export function SnapshotPage({ s }: { s: ReportSummary }) {
  const i = s.inputs;
  return (
    <PageShell>
      <PageHeader />
      <h2 className="text-3xl font-black text-navy">Executive snapshot</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Client details, current fund position and goals are presented in a clean dashboard format.
      </p>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Age" value={String(i.age)} sub="Current age" />
        <KpiCard label="Target Retirement" value={String(i.retirementAge)} sub="Desired retirement age" />
        <KpiCard label="Years Remaining" value={String(s.yearsRemaining)} sub="Until retirement" />
        <KpiCard label="Goal Balance" value={fmtMoney(s.goalBalance)} sub="Reference goal" accent />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <SectionCard title="Client profile" icon="◉">
          <Row label="Name" value={i.clientName} />
          <Row label="Annual income" value={fmtMoney(i.annualIncome)} />
          <Row label="After-tax employer contributions" value={fmtMoney(i.annualIncome * 0.12 * 0.85)} />
          <Row label="Desired retirement income" value={fmtMoney(s.annualWithdrawal)} />
        </SectionCard>
        <SectionCard title="Current super position" icon="◆">
          <Row label="Fund" value={i.fundName} />
          <Row label="Investment option" value={i.modelLabel} />
          <Row label="Risk category" value={s.riskProfile} />
          <Row label="Gross return" value={fmtPct(i.grossReturn)} />
          <Row label="Net return after fees" value={fmtPct(s.existingNetReturn - s.existingAdminPct)} />
        </SectionCard>
      </div>

      <SectionCard title="Goal progress">
        <ProgressBar pct={s.goalProgressPct} label={`${(s.goalProgressPct * 100).toFixed(1)}%`} />
        <div className="mt-3 text-sm font-bold text-navy">
          Projected balance at retirement: {fmtMoney(s.projectedExisting)}
        </div>
        <div className="text-xs text-muted-foreground">Goal balance: {fmtMoney(s.goalBalance)}</div>
        <div className="mt-2 text-[11px] text-muted-foreground italic">
          The goal is included as a reference point only and has not been treated as personal advice.
        </div>
      </SectionCard>

      <PageFooter />
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-navy tabular-nums">{value}</span>
    </div>
  );
}

export function IncomePage({ s }: { s: ReportSummary }) {
  const maxIncome = Math.max(s.totalIncomeExisting, s.totalIncomeComparison, 1);
  // Sustainability gauge: existing years out of 30 years post-retirement
  const sustainPct = Math.min(1, s.yearsIncomeExisting / 30);
  return (
    <PageShell>
      <PageHeader />
      <h2 className="text-3xl font-black text-navy">Retirement income view</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        This page translates the projected balance into an estimated retirement income outcome.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="Starting Balance" value={fmtMoney(s.projectedExisting)} sub="Projected at retirement" />
        <KpiCard label="Annual Withdrawal" value={fmtMoney(s.annualWithdrawal)} sub="Desired annual income" accent />
        <KpiCard label="Income Provided" value={fmtMoney(s.totalIncomeExisting)} sub="Estimated total" />
      </div>

      <SectionCard title="Income sustainability" className="mb-5">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs text-muted-foreground">Estimated $0 remaining at age</div>
            <div className="text-5xl font-black text-navy tabular-nums">{s.ageMoneyLastsExisting}</div>
            <div className="mt-1 text-sm font-bold text-cyan">{s.yearsIncomeExisting} years</div>
          </div>
          <div className="ml-auto">
            <Gauge value={s.yearsIncomeExisting} max={30} label={`${s.yearsIncomeExisting} yrs`} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 max-w-md">
          Retirement returns are reduced to allow for a more defensive investment mix. This is an
          illustrative calculation only.
        </p>
      </SectionCard>

      <SectionCard title="Current vs comparison retirement income">
        <div className="space-y-3">
          <ComparisonBar
            label="Current"
            value={s.totalIncomeExisting}
            max={maxIncome}
            displayValue={fmtMoney(s.totalIncomeExisting)}
            color="navy"
          />
          <ComparisonBar
            label="Comparison"
            value={s.totalIncomeComparison}
            max={maxIncome}
            displayValue={fmtMoney(s.totalIncomeComparison)}
            color="cyan"
          />
        </div>
        <div className="mt-4 text-sm text-navy font-semibold">
          Comparison estimated $0 remaining at age {s.ageMoneyLastsComparison}.
        </div>
      </SectionCard>

      <PageFooter />
    </PageShell>
  );
}
