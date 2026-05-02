import { Check, Info, Star } from "lucide-react";
import type { ReportSummary, FundEntry } from "@/lib/calc";
import {
  fmtMoney, fmtPct,
  comparisonAdminPct, COMPARISON_ADMIN_FLAT,
  comparisonAnnualFee, comparisonAdviceFee,
  getAllFunds, totalBalance, weightedGrowthPct,
  existingReturnPct, inferRiskProfile,
} from "@/lib/calc";
import {
  PageShell, PageHeader, PageFooter, KpiCard, SectionCard,
  ProgressBar, ComparisonBar, Gauge,
  AccumulationChart, WithdrawalChart,
  FeeRow, FeeTableHeader, Disclaimer,
} from "./primitives";
import riskIllustration from "@/assets/risk-illustration.jpg";
import logoUrl from "@/assets/logo.svg";
import asicRegistered from "@/assets/asic-registered.png";
import logoInheritance from "@/assets/logo-inheritance.png";
import logoMyAdvice from "@/assets/logo-myadvice.png";
import logoPure from "@/assets/logo-pure.png";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-navy tabular-nums">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 1 - COVER                                                     */
/* ------------------------------------------------------------------ */
export function CoverPage({ s }: { s: ReportSummary }) {
  return (
    <PageShell>
      {/* Unified cover hero - logo + title in one cohesive block so the PDF
          renders a single, seamless header section. */}
      <header
        className="relative -mx-14 -mt-[16mm] mb-6 px-14 pt-7 pb-10 rounded-b-[28px] text-navy-foreground overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, hsl(215 65% 14%) 0%, hsl(215 60% 18%) 40%, hsl(205 60% 26%) 80%, hsl(195 75% 34%) 100%)",
        }}
      >
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-cyan/20 blur-3xl pointer-events-none" />
        <div className="absolute -right-10 top-10 w-44 h-44 rounded-full bg-cyan/25 pointer-events-none" />
        <div className="absolute -left-20 -bottom-24 w-72 h-72 rounded-full bg-[hsl(225_85%_60%)]/15 blur-3xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4 text-base">
          <img src={logoUrl} alt="Advisor Link Online" className="h-12 w-auto" />
          <div className="text-right leading-[1.5] opacity-90">
            <div className="font-bold tracking-wide text-lg">Advisor Link Pty Ltd</div>
            <div className="text-base">(07) 5241 1244</div>
            <div className="text-base">21 Upton Street,</div>
            <div className="text-base">Bundall QLD 4217</div>
            <div className="text-base">admin@advisorlinkonline.com.au</div>
          </div>
        </div>

        <div className="relative mt-8">
          <div className="h-[3px] w-12 rounded-full bg-cyan mb-4" />
          <h1 className="text-[44px] leading-[1.02] font-black tracking-tight">
            SUPER PERFORMANCE<br/>REPORT
          </h1>
          <p className="mt-3 text-sm max-w-lg opacity-80 leading-relaxed">
            A complete factual report of your superannuation: current position, projection to retirement, income outlook, fees and a comparison scenario.
          </p>
          <div className="mt-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan">Prepared For</div>
            <div className="mt-1 text-2xl font-bold tracking-tight">{s.inputs.clientName}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="Current Balance" value={fmtMoney(s.startingBalance)} sub={getAllFunds(s.inputs).length > 1 ? `${getAllFunds(s.inputs).length} funds combined` : s.inputs.fundName} accent />
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
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy">
            Disclaimer
          </h3>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Advisor Link Online is an independent education and referral service and is not licensed to provide financial advice. This Super Performance Report contains factual information only, based on publicly available data (e.g. RateCity, APRA reports, or your fund's website). It does not constitute personal or general financial product advice and does not consider your specific objectives, financial situation, or needs. All comparisons, projections, and illustrations are for information purposes only and are based on current public data. Past performance is not a reliable indicator of future results. If you believe an improvement may be possible, we can introduce you to a licensed financial adviser at your request from our referral network to contact you and provide a Statement of Advice after assessing your circumstances.
        </p>
      </div>

      {/* ASIC trust strip */}
      <div className="mt-5 rounded-2xl border border-border bg-white p-5 shadow-card">
        <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
          <img
            src={asicRegistered}
            alt="ASIC registered company extract for Advisorlink Pty Ltd"
            className="h-24 w-auto object-contain"
            loading="lazy"
          />
          <div>
            <div className="text-[10px] tracking-[0.22em] font-semibold text-cyan mb-1">100% ASIC REGULATED</div>
            <div className="text-lg text-navy leading-tight font-medium" style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }}>
              ADVISORLINK PTY LTD &nbsp;·&nbsp; ACN 671 139 923
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Registered with the Australian Securities &amp; Investments Commission. We operate
              as an independent education and referral service - never a product issuer.
            </p>
          </div>
        </div>
      </div>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 1.5 - WHO WE ARE                                              */
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
      <h2 className="mt-1 text-2xl font-bold font-heading text-navy">Who we are & why people choose us</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Advisor Link is a 100% ASIC-regulated research and referral company. We don't sell
        products - we help you understand your super and, if you choose, connect you with a
        licensed adviser from our trusted network.
      </p>

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
              <div className="text-sm font-semibold text-navy leading-tight">Google Reviews</div>
              <div className="flex flex-row items-center gap-1.5 mt-2 whitespace-nowrap">
                 <span className="inline-flex items-center">
                   {[0,1,2,3,4].map(i => (
                     <Star key={i} className="w-3.5 h-3.5 fill-[#FBBC05] text-[#FBBC05]" />
                   ))}
                 </span>
               </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] tracking-[0.2em] font-bold text-cyan">VERIFIED</span>
            <span className="text-[10px] font-medium text-muted-foreground italic">Just Google us and check yourself - 5.0 star rating on Google</span>
          </div>
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
              <div className="flex items-center">
                {[0,1,2,3,4].map(i => (
                  <Star key={i} className="w-3 h-3 fill-[#FBBC05] text-[#FBBC05] block" />
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-foreground">"{r.text}"</p>
              <div className="mt-3">
                <div className="text-[11px] font-bold text-navy leading-tight font-heading">{r.name}</div>
                <div className="text-[9px] text-muted-foreground">{r.loc}</div>
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
/* PAGE 2 - CLIENT SNAPSHOT                                           */
/* ------------------------------------------------------------------ */
export function SnapshotPage({ s }: { s: ReportSummary }) {
  const i = s.inputs;
  const sgContrib = i.annualIncome * 0.12 * 0.85;
  return (
    <PageShell>
      <PageHeader pageLabel="CLIENT SNAPSHOT" />
      <h2 className="mt-1 text-2xl font-bold font-heading text-navy">Executive snapshot</h2>
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
          Based on {s.inputs.clientName.split(" ")[0]}'s current {getAllFunds(s.inputs).length > 1 ? "combined " : ""}balance of <strong className="text-navy">{fmtMoney(s.startingBalance)}</strong>{getAllFunds(s.inputs).length > 1 ? ` across ${getAllFunds(s.inputs).length} funds` : ""},
          continued contributions of <strong className="text-navy">{fmtMoney(sgContrib)}</strong> per year and the existing fund{getAllFunds(s.inputs).length > 1 ? "s'" : "'s"} net return,
          the projected balance at age {s.retirementAge} is <strong className="text-navy">{fmtMoney(s.projectedExisting)}</strong>.
          The reference target of {fmtMoney(s.goalBalance)} is included for context only.
        </p>
      </SectionCard>

      <SectionCard title="Selected projection years" icon="◉" className="mt-5">
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
              <div className="font-bold text-navy">{r.age}</div>
              <div className="text-right text-muted-foreground tabular-nums">{yearNumber}</div>
              <div className="text-right tabular-nums">{fmtMoney(r.existing)}</div>
              <div className="text-right tabular-nums text-cyan font-bold">{fmtMoney(r.comparison)}</div>
            </div>
          );
        })}
      </SectionCard>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 3 - CURRENT FUND vs COMPARISON                                */
/* ------------------------------------------------------------------ */
export function FundsPage({ s }: { s: ReportSummary }) {
  const i = s.inputs;
  const funds = getAllFunds(i);
  const total = totalBalance(i);
  const hasMultiple = funds.length > 1;
  const wGrowth = weightedGrowthPct(i);
  const wReturn = existingReturnPct(i);
  const cmpAdminFlatPct = total > 0 ? COMPARISON_ADMIN_FLAT / total : 0;
  const cmpAdminBalPct = comparisonAdminPct(total);
  return (
    <PageShell>
      <PageHeader pageLabel="FUND DETAILS" />
      <h2 className="mt-1 text-2xl font-bold font-heading text-navy">Current fund{hasMultiple ? "s" : ""} vs comparison</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        {hasMultiple
          ? "Combined view of all existing funds and the comparison scenario used throughout this report."
          : "Side-by-side view of the existing fund settings and the comparison scenario used throughout this report."}
      </p>

      {hasMultiple ? (
        <>
          {/* Individual fund cards */}
          <div className={`grid gap-4 mb-4 ${funds.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {funds.map((f, idx) => (
              <SectionCard key={idx} title={`Fund ${idx + 1}: ${f.fundName}`} icon="◆">
                <Row label="Investment option" value={f.modelLabel} />
                <Row label="Balance" value={fmtMoney(f.superBalance)} />
                <Row label="Growth assets" value={fmtPct(f.growthAssetsPct, 0)} />
                <Row label="Investment risk profile" value={f.investmentRiskProfile || inferRiskProfile(f.growthAssetsPct)} />
                <Row label="5-year net return" value={fmtPct(f.grossReturn)} />
                <Row label="Admin fee - flat" value={fmtMoney(f.adminFeeFlat)} />
                <Row label="Admin fee - %" value={fmtPct(f.adminFeePct, 2)} />
                <Row label="Effective admin fee %" value={fmtPct(f.superBalance > 0 ? f.adminFeeFlat / f.superBalance + f.adminFeePct : 0, 2)} />
              </SectionCard>
            ))}
          </div>
          {/* Combined weighted summary */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <SectionCard title="Combined / weighted" icon="✦">
              <Row label="Total balance" value={fmtMoney(total)} />
              <Row label="Weighted growth assets" value={fmtPct(wGrowth, 0)} />
              <Row label="Weighted 5-year return" value={fmtPct(wReturn)} />
              <Row label="Risk profile (weighted)" value={s.riskProfile} />
            </SectionCard>
            <SectionCard title="Comparison scenario" icon="◉">
              <Row label="Scenario" value="Aligned to risk profile" />
              <Row label="Risk profile" value={s.riskProfile} />
              <Row label="Net return (tiered by profile)" value={fmtPct(s.comparisonReturn - s.comparisonAdminPct - (Math.min(total * 0.0176, 5000) / (total || 1)))} />
              <Row label="Admin fee - flat" value={fmtMoney(COMPARISON_ADMIN_FLAT)} />
              <Row label="Admin fee - flat as % of balance" value={fmtPct(cmpAdminFlatPct, 2)} />
              <Row label="Admin fee - tiered %" value={fmtPct(cmpAdminBalPct, 2)} />
              <Row label="Optional annual advice fee" value="1.76%" />
              <Row label="Once off service fee" value={fmtMoney(comparisonAdviceFee(total))} />
            </SectionCard>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <SectionCard title="Current fund" icon="◆">
            <Row label="Fund name" value={i.fundName} />
            <Row label="Investment option" value={i.modelLabel} />
            <Row label="Growth assets" value={fmtPct(i.growthAssetsPct, 0)} />
            <Row label="Investment risk profile" value={i.investmentRiskProfile || s.riskProfile} />
            <Row label="5-year net return" value={fmtPct(i.grossReturn)} />
            <Row label="Admin fee - flat" value={fmtMoney(i.adminFeeFlat)} />
            <Row label="Admin fee - % of balance" value={fmtPct(i.adminFeePct, 2)} />
            <Row label="Effective admin fee %" value={fmtPct(s.existingAdminPct, 2)} />
          </SectionCard>
          <SectionCard title="Comparison scenario" icon="◉">
            <Row label="Scenario" value="Aligned to risk profile" />
            <Row label="Risk profile" value={s.riskProfile} />
            <Row label="Net return (tiered by profile)" value={fmtPct(s.comparisonReturn - s.comparisonAdminPct - (Math.min(i.superBalance * 0.0176, 5000) / i.superBalance))} />
            <Row label="Admin fee - flat" value={fmtMoney(COMPARISON_ADMIN_FLAT)} />
            <Row label="Admin fee - flat as % of balance" value={fmtPct(cmpAdminFlatPct, 2)} />
            <Row label="Admin fee - tiered %" value={fmtPct(cmpAdminBalPct, 2)} />
            <Row label="Optional annual advice fee" value="1.76%" />
            <Row label="Once off service fee" value={fmtMoney(comparisonAdviceFee(i.superBalance))} />
          </SectionCard>
        </div>
      )}

      <SectionCard title="Risk profile band" icon="✦">
        <div className="grid grid-cols-5 gap-2 text-center">
          {(["Conservative", "Moderate", "Balanced", "Growth", "High Growth"] as const).map(p => (
            <div
              key={p}
              className={
                "rounded-lg border px-2 py-3 text-[11px] font-semibold " +
                (p === s.riskProfile
                  ? "bg-navy text-navy-foreground border-navy"
                  : "bg-secondary/50 text-muted-foreground border-border")
              }
            >
              {p}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          {hasMultiple
            ? "Profile is determined by the weighted average growth assets % across all funds."
            : "Profile is determined by the growth assets % of the current investment option."}
          {" "}Comparison gross returns are illustrative tiered figures.
        </p>
      </SectionCard>

      <div className="mt-5 relative rounded-2xl overflow-hidden bg-gradient-to-br from-navy to-[hsl(215_60%_18%)] flex-1 min-h-[260px] shadow-card">
        <img
          src={riskIllustration}
          alt="Illustration of long-term superannuation growth toward retirement"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-navy/10" />
        <div className="absolute bottom-5 left-6 right-6 text-white">
          <div className="text-[10px] tracking-[0.25em] font-bold text-cyan mb-1 my-px">​</div>
          <div className="leading-tight max-w-sm font-medium font-heading py-[14px] text-xl !text-white drop-shadow-md">
            "Make sure you can still climb the mountain. Don't be the one stuck in the bus taking photos."
          </div>
        </div>
      </div>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 4 - ACCUMULATION PROJECTION                                   */
/* ------------------------------------------------------------------ */
export function ProjectionPage({ s }: { s: ReportSummary }) {
  const i = s.inputs;
  const cmpAfterFees = s.comparisonReturn - s.comparisonAdminPct - Math.min(i.superBalance * 0.0176, 5000) / i.superBalance;
  return (
    <PageShell>
      <PageHeader pageLabel="ACCUMULATION" />
      <h2 className="mt-1 text-2xl font-bold font-heading text-navy">Projection to retirement</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Year-by-year projection of the current fund vs the comparison scenario, including periodic market dips.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <KpiCard label="Current Balance" value={fmtMoney(s.startingBalance)} sub="Today" />
        <KpiCard label="Projected - Current" value={fmtMoney(s.projectedExisting)} sub={`At age ${s.retirementAge}`} />
        <KpiCard label="Projected - Comparison" value={fmtMoney(s.projectedComparison)} sub={`At age ${s.retirementAge}`} accent />
      </div>

      <div className="mb-5 flex items-center justify-between rounded-lg border border-navy bg-navy px-4 py-2.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white">5 Year Return (p.a.)</div>
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Current</span>
            <span className="text-base font-bold text-white tabular-nums">{(s.existingNetReturn * 100).toFixed(2)}%</span>
          </div>
          <div className="h-4 w-px bg-white/30" />
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Comparison</span>
            <span className="text-base font-bold text-cyan tabular-nums">{(cmpAfterFees * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>

      <SectionCard title="Balance projection" icon="◆" className="mb-5">
        <AccumulationChart
          data={s.accumulationSeries}
          retirementAge={s.retirementAge}
          goalBalance={s.goalBalance}
        />
        <div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">
          After fees and market corrections
        </div>
        <div className="mt-2 flex justify-center">
          <div className="rounded-lg bg-cyan/10 px-8 py-4 text-center min-w-[260px]">
            <div className="text-xs text-muted-foreground">Potential uplift</div>
            <div className="text-2xl text-cyan tabular-nums mt-1 font-bold">{fmtMoney(Math.max(0, s.potentialUplift))}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Projection assumptions" icon="◆">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan/15 text-cyan text-xs font-bold">%</span>
              <div className="text-[11px] font-bold uppercase tracking-wider text-navy">Inflation</div>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              Set at <strong className="text-navy">2.5% p.a.</strong> for the rising cost of living. All results are shown in <strong className="text-navy">today's dollars</strong>.
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan/15 text-cyan text-xs font-bold">↗</span>
              <div className="text-[11px] font-bold uppercase tracking-wider text-navy">Performance</div>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              Employer contributions, rates of return and fees are assumed to remain <strong className="text-navy">consistent</strong> across the projection.
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan/15 text-cyan text-xs font-bold">⚠</span>
              <div className="text-[11px] font-bold uppercase tracking-wider text-navy">Market crash</div>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              A <strong className="text-navy">10% loss every 7 years</strong> is factored in to account for periodic market corrections.
            </div>
          </div>
        </div>
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
/* PAGE 5 - RETIREMENT INCOME & DRAWDOWN                              */
/* ------------------------------------------------------------------ */
export function IncomePage({ s }: { s: ReportSummary }) {
  const maxIncome = Math.max(s.totalIncomeExisting, s.totalIncomeComparison, 1);
  return (
    <PageShell>
      <PageHeader pageLabel="RETIREMENT INCOME" />
      <h2 className="mt-1 text-2xl font-bold font-heading text-navy">Retirement income view</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        How long will your money potentially last when you need it the most?
      </p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <KpiCard label="Starting Balance" value={fmtMoney(s.projectedExisting)} sub={`Projected at retirement (age ${s.retirementAge})`} />
        <KpiCard label="Annual Withdrawal" value={fmtMoney(s.annualWithdrawal)} sub="Desired annual income" accent />
      </div>

      <SectionCard title="Drawdown projection" icon="◆" className="mb-5">
        <WithdrawalChart existing={s.withdrawalExisting} comparison={s.withdrawalComparison} />
      </SectionCard>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Income sustainability - current">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Money lasts to age</div>
              <div className="text-4xl text-navy tabular-nums font-bold">{s.ageMoneyLastsExisting}</div>
              <div className="mt-1 text-xs font-bold text-cyan">{s.yearsIncomeExisting} years of income</div>
            </div>
            <div className="ml-auto"><Gauge value={s.yearsIncomeExisting} max={30} label={`${s.yearsIncomeExisting} yrs`} /></div>
          </div>
        </SectionCard>
        <SectionCard title="Income sustainability - comparison">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Money lasts to age</div>
              <div className="text-4xl text-navy tabular-nums font-bold">{s.ageMoneyLastsComparison}</div>
              <div className="mt-1 text-xs font-bold text-cyan">{s.yearsIncomeComparison} years of income</div>
            </div>
            <div className="ml-auto"><Gauge value={s.yearsIncomeComparison} max={30} label={`${s.yearsIncomeComparison} yrs`} /></div>
          </div>
        </SectionCard>
      </div>

      {(s.totalIncomeComparison - s.totalIncomeExisting > 0 || s.yearsIncomeComparison - s.yearsIncomeExisting > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {s.totalIncomeComparison - s.totalIncomeExisting > 0 && (
            <div className="rounded-md bg-cyan/10 border border-cyan/30 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-navy">Additional retirement income</div>
              <div className="mt-1 text-2xl text-cyan tabular-nums font-bold">
                +{fmtMoney(s.totalIncomeComparison - s.totalIncomeExisting)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Extra income provided over retirement</div>
            </div>
          )}
          {s.yearsIncomeComparison - s.yearsIncomeExisting > 0 && (
            <div className="rounded-md bg-cyan/10 border border-cyan/30 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-navy">Additional years of income</div>
              <div className="mt-1 text-2xl text-cyan tabular-nums font-bold">
                +{s.yearsIncomeComparison - s.yearsIncomeExisting} yrs
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Longer your money lasts</div>
            </div>
          )}
        </div>
      )}

      <SectionCard title="Projection assumptions" icon="◆" className="mt-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan/15 text-cyan text-[10px] font-bold">↘</span>
              <div className="text-[10px] font-bold uppercase tracking-wider text-navy">Returns</div>
            </div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              Returns in retirement are set at <strong className="text-navy">50% of accumulation returns</strong> to account for reduced growth assets.
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan/15 text-cyan text-[10px] font-bold">%</span>
              <div className="text-[10px] font-bold uppercase tracking-wider text-navy">Inflation</div>
            </div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              Set at <strong className="text-navy">2.5% p.a.</strong> for the rising cost of living. Results shown in <strong className="text-navy">today's dollars</strong>.
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan/15 text-cyan text-[10px] font-bold">↗</span>
              <div className="text-[10px] font-bold uppercase tracking-wider text-navy">Performance</div>
            </div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              Rates of return and fees are assumed to remain <strong className="text-navy">consistent</strong> across the projection.
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan/15 text-cyan text-[10px] font-bold">⚠</span>
              <div className="text-[10px] font-bold uppercase tracking-wider text-navy">Market crash</div>
            </div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              A <strong className="text-navy">5% loss every 7 years</strong> is factored in to account for periodic market corrections.
            </div>
          </div>
        </div>
      </SectionCard>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE - POTENTIAL IMPROVEMENT SUMMARY                                */
/* ------------------------------------------------------------------ */
export function ImprovementSummaryPage({ s }: { s: ReportSummary }) {
  const balanceUplift = Math.max(0, s.potentialUplift);
  const incomeUplift = Math.max(0, s.totalIncomeComparison - s.totalIncomeExisting);
  const yearsUplift = Math.max(0, s.yearsIncomeComparison - s.yearsIncomeExisting);
  const totalBenefit = balanceUplift + incomeUplift;
  const eligible = totalBenefit > 100_000;

  return (
    <PageShell>
      <PageHeader pageLabel="POTENTIAL IMPROVEMENT" />
      <h2 className="mt-1 text-2xl font-bold font-heading text-navy">Potential improvement summary</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        A consolidated view of the projected uplift if the comparison scenario were implemented, and your eligibility for an adviser referral.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="Extra at retirement" value={fmtMoney(balanceUplift)} sub={`At age ${s.retirementAge}`} accent />
        <KpiCard label="Extra retirement income" value={fmtMoney(incomeUplift)} sub="Across drawdown" />
        <KpiCard label="Extra years of income" value={`${yearsUplift} yrs`} sub="Money lasts longer" />
      </div>

      <SectionCard title="Total projected extra benefit" icon="◆" className="mb-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Balance uplift + additional retirement income
            </div>
            <div className="mt-1 text-4xl text-cyan tabular-nums font-bold">{fmtMoney(totalBenefit)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Potential Combined lifetime benefit after receiving licenced financial advice.
            </div>
          </div>
          <div className={cnTone(eligible)}>
            <div className="text-[10px] font-bold uppercase tracking-wider">{eligible ? "Eligible for referral" : "Not currently eligible"}</div>
            <div className="text-base mt-0.5 font-medium">{eligible ? "✓ $100,000+ threshold met" : "Below $100,000 threshold"}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Factors Influencing the Projection" icon="◉" className="mb-5">
        <div className="space-y-2">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3 pb-2 border-b-2 border-navy text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <div>Driver</div>
            <div className="text-right">Current</div>
            <div className="text-right">Comparison</div>
          </div>
          <Row label="Net investment return (accumulation)" value={
            <span><span className="text-muted-foreground font-semibold mr-3">{fmtPct(s.existingNetReturn)}</span><span className="text-cyan">{fmtPct(s.comparisonReturn - s.comparisonAdminPct - (Math.min(s.inputs.superBalance * 0.0176, 5000) / s.inputs.superBalance))}</span></span>
          } />
          <Row label="Admin fee % of balance" value={
            <span><span className="text-muted-foreground font-semibold mr-3">{fmtPct(s.existingAdminPct, 2)}</span><span className="text-cyan">{fmtPct(s.comparisonAdminPct, 2)}</span></span>
          } />
          <Row label="Projected balance at retirement" value={
            <span><span className="text-muted-foreground font-semibold mr-3">{fmtMoney(s.projectedExisting)}</span><span className="text-cyan">{fmtMoney(s.projectedComparison)}</span></span>
          } />
          <Row label="Years of retirement income" value={
            <span><span className="text-muted-foreground font-semibold mr-3">{s.yearsIncomeExisting} yrs</span><span className="text-cyan">{s.yearsIncomeComparison} yrs</span></span>
          } />
        </div>
      </SectionCard>

      <SectionCard title="Referral eligibility criteria" icon="✓">
        <p className="text-xs text-muted-foreground mb-3">
          To be referred to a licensed financial adviser from our network, the following criteria must be met:
        </p>
        <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan text-cyan-foreground text-xs font-bold">1</span>
            <div>
              <div className="text-sm font-bold text-navy font-heading">Total projected extra benefit must exceed $100,000</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Calculated as the balance uplift at retirement plus the additional retirement income generated by the comparison scenario over the drawdown phase.
              </div>
              <div className="mt-2 text-[11px]">
                <span className="font-semibold text-navy">Your result:</span>{" "}
                <span className={eligible ? "text-online font-bold" : "text-destructive font-bold"}>
                  {fmtMoney(totalBenefit)} {eligible ? "- eligible" : "- below threshold"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <PageFooter />
    </PageShell>
  );
}

function cnTone(eligible: boolean) {
  return eligible
    ? "rounded-lg border border-online/40 bg-online/10 text-online px-4 py-3 min-w-[220px]"
    : "rounded-lg border border-border bg-secondary/60 text-muted-foreground px-4 py-3 min-w-[220px]";
}

/* ------------------------------------------------------------------ */
/* PAGE - WHAT'S NEXT                                                  */
/* ------------------------------------------------------------------ */
export function WhatsNextPage({ s }: { s: ReportSummary }) {
  const totalBenefit = Math.max(0, s.potentialUplift) + Math.max(0, s.totalIncomeComparison - s.totalIncomeExisting);
  const eligible = totalBenefit > 100_000;

  const steps = [
    {
      n: "1",
      title: "Review this report",
      body: "Read through the projection, fee comparison and income outlook. Make sure the inputs reflect your real situation - especially salary, balance, fees and retirement age.",
    },
    {
      n: "2",
      title: "Check your eligibility",
      body: "If your total projected extra benefit exceeds $100,000, you qualify for a no-obligation introduction to a licensed financial adviser from our referral network.",
    },
    {
      n: "3",
      title: "Request a referral",
      body: "Reply to the email containing this report, or contact Advisor Link Online. We'll match you with an adviser suited to your situation.",
    },
    {
      n: "4",
      title: "Receive personal advice",
      body: "Your adviser will assess your full circumstances and provide a Statement of Advice tailored to you - covering investment options, fees, insurance and retirement strategy.",
    },
  ];

  return (
    <PageShell>
      <PageHeader pageLabel="WHAT'S NEXT" />
      <h2 className="mt-1 text-2xl font-bold font-heading text-navy">What's next</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        How to act on the findings in this report and access personal financial advice if you choose to.
      </p>

      <div
        className="rounded-2xl px-6 py-5 mb-5 text-navy-foreground overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, hsl(215 60% 18%) 0%, hsl(200 70% 32%) 100%)" }}
      >
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-cyan/30 blur-2xl" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">Your eligibility</div>
            <div className="mt-1 text-2xl font-bold font-heading !text-white drop-shadow-md">
              {eligible ? "You qualify for an adviser referral" : "Referral threshold not met"}
            </div>
            <div className="mt-1 text-xs opacity-80 text-white">
              Total projected extra benefit: <span className="font-bold tabular-nums">{fmtMoney(totalBenefit)}</span> · Threshold: $100,000
            </div>
          </div>
          <div className={`px-4 py-2 rounded-md text-sm font-bold ${eligible ? "bg-online text-white" : "bg-white/10 text-white/80"}`}>
            {eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}
          </div>
        </div>
      </div>


      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-border" />
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan">How a referral works</div>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "$", title: "No cost to you", body: "Advisor Link Online does not charge you for the introduction. We are an education and referral service only." },
            { icon: "✦", title: "Independent network", body: "Advisers in our network are licensed in Australia and assessed for quality. You are under no obligation to proceed." },
            { icon: "🔒", title: "Your data, your control", body: "We only share your details with an adviser once you confirm you'd like to be contacted." },
          ].map((c) => (
            <div key={c.title} className="relative rounded-xl border border-border bg-card p-4 overflow-hidden group">
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-cyan/5 group-hover:bg-cyan/10 transition-colors" />
              <div className="relative">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan/10 text-cyan text-base font-bold mb-2.5">
                  {c.icon}
                </div>
                <div className="text-navy mb-1 text-sm font-bold font-heading">{c.title}</div>
                <div className="text-[10.5px] text-muted-foreground leading-relaxed">{c.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/5 via-transparent to-transparent p-5">

        <div className="grid grid-cols-3 gap-4">
          {[
            { n: "01", title: "Best interest duty", body: "An adviser will only recommend personal advice if it is genuinely in your best interest. If it isn't, they won't proceed." },
            { n: "02", title: "Annual opt-in", body: "Ongoing advice fees require your written consent every year. You sign a renewal document annually before any fee can be charged - giving you full control." },
            { n: "03", title: "Paid from super", body: "If you choose to engage an adviser, fees are deducted from your superannuation balance - not paid out of pocket." },
          ].map((c) => (
            <div key={c.n} className="relative">
              <div className="text-3xl font-bold text-cyan/30 leading-none mb-1.5 tabular-nums">{c.n}</div>
              <div className="h-px w-8 bg-cyan mb-2" />
              <div className="text-navy mb-1 text-sm font-bold font-heading">{c.title}</div>
              <div className="text-[10.5px] text-muted-foreground leading-relaxed">{c.body}</div>
            </div>
          ))}
        </div>
      </div>


      <div
        className="mb-4 rounded-2xl overflow-hidden relative text-navy-foreground shadow-elevated"
        style={{ background: "linear-gradient(120deg, hsl(215 65% 10%) 0%, hsl(210 60% 16%) 50%, hsl(200 70% 22%) 100%)" }}
      >
        {/* Decorative glow */}
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-cyan/25 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-56 h-56 rounded-full bg-cyan/10 blur-3xl pointer-events-none" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-cyan via-cyan/70 to-cyan/30" />

        <div className="relative px-6 py-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
          {/* Left: kicker + headline */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan">
                Ready to finally get some help?
              </div>
            </div>
            <div className="text-2xl leading-tight font-bold font-heading !text-white drop-shadow-md">
              Call your <span className="text-cyan">Senior Research Consultant</span> today<br />
              for a no-obligation chat.
            </div>
          </div>

          {/* Right: consultant card */}
          <div className="rounded-xl bg-white/[0.06] backdrop-blur border border-white/15 px-5 py-4 min-w-[260px]">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <div className="text-base font-bold leading-tight font-heading !text-white drop-shadow-md">Travis Seckod</div>
                <div className="text-[10px] uppercase tracking-wider text-white/70 font-bold mt-0.5">
                  Director · Senior Research
                </div>
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan whitespace-nowrap pt-1">
                Your Consultant
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <a
                href="tel:0485991688"
                className="flex items-center gap-2.5 text-[12px] font-bold text-white"
              >
                <span className="h-6 w-6 rounded-full bg-cyan/20 text-cyan flex items-center justify-center text-[11px]">☎</span>
                <span className="tabular-nums">0485 991 688</span>
              </a>
              <a
                href="mailto:admin@advisorlinkonline.com.au"
                className="flex items-center gap-2.5 text-[12px] font-semibold text-white"
              >
                <span className="h-6 w-6 rounded-full bg-cyan/20 text-cyan flex items-center justify-center text-[11px]">✉</span>
                <span>admin@advisorlinkonline.com.au</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <Disclaimer>
        Advisor Link Online is an independent education and referral service and is not licensed to provide financial advice.
        This Super Performance Report contains factual information only and does not constitute personal advice. Eligibility for
        a referral is based solely on the projected extra benefit shown in this report and does not guarantee a particular outcome.
        A licensed financial adviser will assess your full circumstances before providing a Statement of Advice.
      </Disclaimer>

      <PageFooter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE 6 - FEES & ASSUMPTIONS & DISCLAIMER                            */
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
      <h2 className="mt-1 text-2xl font-bold font-heading text-navy">Fees & assumptions</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        A line-by-line view of fees, the assumptions powering the projection, and important disclaimers.
      </p>

      <SectionCard title="Annual fee comparison (year 1)" icon="◆" className="mb-5">
        <FeeTableHeader />
        <FeeRow label="Admin fee - flat" current={exFlat} comparison={cmpFlat} />
        <FeeRow label="Admin fee - % of balance" current={exPctFee} comparison={cmpAdmin} />
        
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
