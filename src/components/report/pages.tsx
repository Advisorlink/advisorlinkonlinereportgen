import { Check, Info, Star } from "lucide-react";
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
import asicRegistered from "@/assets/asic-registered.png";
import logoInheritance from "@/assets/logo-inheritance.png";
import logoMyAdvice from "@/assets/logo-myadvice.png";
import logoPure from "@/assets/logo-pure.png";

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
      <PageHeader flush />
      <div
        className="relative -mx-14 -mt-px mb-6 px-14 pt-6 pb-10 rounded-b-[28px] text-navy-foreground overflow-hidden"
        style={{
          background:
            "linear-gradient(165deg, hsl(215 60% 18%) 0%, hsl(210 55% 24%) 55%, hsl(200 70% 32%) 100%)",
        }}
      >
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-cyan/20 blur-2xl" />
        <div className="absolute -right-8 top-8 w-40 h-40 rounded-full bg-cyan/30" />
        <h1 className="relative text-[44px] leading-[1.05] font-black tracking-tight">
          SUPER PERFORMANCE<br/>REPORT
        </h1>
        <p className="relative mt-3 text-sm max-w-md opacity-80">
          A complete review of your superannuation: current position, projection to retirement, income outlook, fees and a comparison scenario.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="Current Balance" value={fmtMoney(s.startingBalance)} sub={s.inputs.fundName} accent />
        <KpiCard label="Years to Retirement" value={String(s.yearsRemaining)} sub={`Age ${s.inputs.age} → ${s.retirementAge}`} />
        <KpiCard label="Potential Extra" value={fmtMoney(Math.max(0, s.potentialUplift))} sub="At retirement vs current" />
      </div>

      <SectionCard title="What's inside this report" icon="◆">
        <div className="grid grid-cols-2 gap-y-2 text-xs">
          {[
            "Client snapshot & targets",
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

      <div className="mt-5 rounded-xl bg-white border border-border p-5 shadow-[0_20px_45px_-15px_hsl(215_60%_15%/0.25),0_8px_20px_-8px_hsl(215_60%_15%/0.15)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-1.5 h-5 rounded-full bg-cyan" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-navy">
            Disclaimer
          </h3>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Advisor Link Online is an independent education and referral service and is not licensed to provide financial advice. This Super Performance Report contains factual information only, based on publicly available data (e.g. RateCity, APRA reports, or your fund's website). It does not constitute personal or general financial product advice and does not consider your specific objectives, financial situation, or needs. All comparisons, projections, and illustrations are for information purposes only and are based on current public data. Past performance is not a reliable indicator of future results. If you believe an improvement may be possible, we can introduce you to a licensed financial adviser at your request from our referral network to contact you and provide a Statement of Advice after assessing your circumstances.
        </p>
      </div>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 1.5 — WHO WE ARE                                              */
/* ------------------------------------------------------------------ */
export function WhoWeArePage() {
  const vetting = [
    "ASIC Registered",
    "RG146 Compliant",
    "Meets our reputational standards",
    "Aligns with our values",
    "Minimum 5 years experience providing advice",
  ];
  const restrictions = [
    "Due to ASIC regulations, only a licensed adviser can discuss recommended product names.",
    "This report does not include your personal contributions.",
    "This report does not include insurance considerations.",
  ];

  return (
    <PageShell>
      <PageHeader pageLabel="WHO WE ARE" />
      <h2 className="text-3xl font-black text-navy">Who we are & why people choose us</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Advisor Link is a 100% ASIC-regulated research and referral company. We don't sell
        products — we help you understand your super and, if you choose, connect you with a
        licensed adviser from our trusted network.
      </p>

      {/* ASIC trust strip */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-card mb-5">
        <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
          <img
            src={asicRegistered}
            alt="ASIC registered company extract for Advisorlink Pty Ltd"
            className="h-24 w-auto object-contain"
            loading="lazy"
          />
          <div>
            <div className="text-[10px] tracking-[0.22em] font-bold text-cyan mb-1">100% ASIC REGULATED</div>
            <div className="text-lg font-black text-navy leading-tight">
              ADVISORLINK PTY LTD &nbsp;·&nbsp; ACN 671 139 923
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Registered with the Australian Securities &amp; Investments Commission. We operate
              as an independent education and referral service — never a product issuer.
            </p>
          </div>
        </div>
      </div>

      {/* Trusted advisers */}
      <SectionCard title="Some of our trusted advisers" icon="◆" className="mb-5">
        <p className="text-xs text-muted-foreground mb-3">
          We only refer to licensed firms that meet a strict vetting standard.
        </p>
        <div className="rounded-xl bg-white border border-border px-6 py-5 grid grid-cols-3 gap-6 items-center shadow-card">
          <img src={logoInheritance} alt="Inheritance Financial Advice" className="max-h-12 w-auto object-contain mx-auto" loading="lazy" />
          <img src={logoMyAdvice} alt="MyAdvice Hub" className="max-h-12 w-auto object-contain mx-auto" loading="lazy" />
          <img src={logoPure} alt="Pure" className="max-h-12 w-auto object-contain mx-auto" loading="lazy" />
        </div>
      </SectionCard>

      {/* Two columns: vetting + restrictions */}
      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Advisor Link vetting" icon="✓">
          <ul className="space-y-2">
            {vetting.map(v => (
              <li key={v} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 inline-flex shrink-0 items-center justify-center w-4 h-4 rounded-full bg-cyan text-cyan-foreground">
                  <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
                </span>
                <span className="text-foreground">{v}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Limits of this report" icon="!">
          <ul className="space-y-2">
            {restrictions.map(r => (
              <li key={r} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 inline-flex shrink-0 items-center justify-center w-4 h-4 rounded-full bg-navy text-navy-foreground">
                  <Info className="w-2.5 h-2.5" strokeWidth={3} />
                </span>
                <span className="text-foreground leading-snug">{r}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Google-style reviews */}
      <div className="mt-5 rounded-2xl border border-border bg-white p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 48 48" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
              <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
              <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
              <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
            </svg>
            <div>
              <div className="text-sm font-bold text-navy leading-tight">Google Reviews</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex">
                  {[0,1,2,3,4].map(i => (
                    <Star key={i} className="w-3.5 h-3.5 fill-[#FBBC05] text-[#FBBC05]" />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-foreground">5.0 stars</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] tracking-[0.2em] font-bold text-cyan">VERIFIED</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            {
              name: "Gay Tooze",
              loc: "Verified Google Review",
              initials: "GT",
              color: "bg-[hsl(210_70%_55%)]",
              text: "Travis was very professional & knowledgeable as we looked at my superannuation statement together, pointing out things I had never noticed or realised before. I have not been happy with my Superannuation's performance and now I am taking steps to do something about this. Thank you Travis.",
            },
            {
              name: "Kim Homersham",
              loc: "Verified Google Review",
              initials: "KH",
              color: "bg-[hsl(150_55%_42%)]",
              text: "Travis made it very easy to understand and clear how the changes will make a huge difference to my super in years to come. You really can't go wrong by making the appointment with the financial advisor. Thanks for your help and friendly nature Travis.",
            },
            {
              name: "Michael Kelly",
              loc: "Verified Google Review",
              initials: "MK",
              color: "bg-[hsl(15_80%_55%)]",
              text: "Travis was very helpful and explained the entire process to me in an easy to understand way. It was a pleasure dealing with someone who came across as friendly, knowledgeable and willing to assist. Most notably though was Travis' patience and professional approach.",
            },
          ].map(r => (
            <div key={r.name} className="rounded-xl border border-border bg-secondary/30 p-3.5">
              <div className="flex">
                {[0,1,2,3,4].map(i => (
                  <Star key={i} className="w-3 h-3 fill-[#FBBC05] text-[#FBBC05]" />
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-foreground">"{r.text}"</p>
              <div className="mt-3 flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full ${r.color} text-white text-[10px] font-bold flex items-center justify-center`}>
                  {r.initials}
                </div>
                <div>
                  <div className="text-[11px] font-bold text-navy leading-tight">{r.name}</div>
                  <div className="text-[9px] text-muted-foreground">{r.loc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
        Personal details, targets and the current super position at a glance.
      </p>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Age" value={String(i.age)} sub="Current age" />
        <KpiCard label="Target Retirement" value={String(i.retirementAge)} sub="Desired age" />
        <KpiCard label="Years Remaining" value={String(s.yearsRemaining)} sub="Until retirement" />
        <KpiCard label="Target Balance" value={fmtMoney(s.goalBalance)} sub="Reference target" accent />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <SectionCard title="Client profile" icon="◉">
          <Row label="Name" value={i.clientName} />
          <Row label="Annual income" value={fmtMoney(i.annualIncome)} />
          <Row label="Net super contribution (12% × 0.85)" value={fmtMoney(sgContrib)} />
          <Row label="Desired retirement income" value={`${fmtMoney(i.desiredIncomeAmount)} ${i.desiredIncomeFrequency.toLowerCase()}`} />
          <Row label="Annualised desired income" value={fmtMoney(s.annualWithdrawal)} />
        </SectionCard>
        <SectionCard title="Targets" icon="◆">
          <Row label="Retirement age target" value={i.retirementAge} />
          <Row label="Reference balance target" value={fmtMoney(s.goalBalance)} />
          <Row label="Projected balance at retirement" value={fmtMoney(s.projectedExisting)} />
          <Row label="Target progress" value={fmtPct(s.goalProgressPct)} />
          <div className="mt-3">
            <ProgressBar pct={s.goalProgressPct} label={`${(s.goalProgressPct * 100).toFixed(1)}% of target`} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Position summary" icon="✦">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Based on {s.inputs.clientName.split(" ")[0]}'s current balance of <strong className="text-navy">{fmtMoney(s.startingBalance)}</strong>,
          continued contributions of <strong className="text-navy">{fmtMoney(sgContrib)}</strong> per year and the existing fund's net return,
          the projected balance at age {s.retirementAge} is <strong className="text-navy">{fmtMoney(s.projectedExisting)}</strong>.
          The reference target of {fmtMoney(s.goalBalance)} is included for context only.
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
          
        </SectionCard>
        <SectionCard title="Comparison scenario" icon="◉">
          <Row label="Scenario" value="Aligned to risk profile" />
          <Row label="Risk profile" value={s.riskProfile} />
          <Row label="Gross return (tiered by profile)" value={fmtPct(s.comparisonReturn)} />
          <Row label="Admin fee — flat" value={fmtMoney(COMPARISON_ADMIN_FLAT)} />
          <Row label="Admin fee — flat as % of balance" value={fmtPct(cmpAdminFlatPct, 2)} />
          <Row label="Admin fee — tiered %" value={fmtPct(cmpAdminBalPct, 2)} />
          <Row label="Optional annual advice fee" value="1.76%" />
          <Row label="Once off service fee" value={fmtMoney(comparisonAdviceFee(i.superBalance))} />
          
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

      <div className="mt-5 relative rounded-2xl overflow-hidden bg-gradient-to-br from-navy to-[hsl(215_60%_18%)] flex-1 min-h-[260px] shadow-card">
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
            <div className="text-muted-foreground">Target balance</div>
            <div className="font-bold text-navy tabular-nums">{fmtMoney(s.goalBalance)}</div>
          </div>
          <div className="rounded-md bg-secondary/50 px-3 py-2">
            <div className="text-muted-foreground">Difference (current vs target)</div>
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
        The information in this Super Performance Report is general in nature only and does not take into account
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
