import { fmtMoney, fmtPct } from "@/lib/calc";
import {
  runScenario,
  employerSG,
  netEmployerContrib,
  annualAdviceFee,
  ageFromDob,
  type StrategyPaperData,
} from "@/lib/strategy-calc";
import { forwardRef, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import coverImg from "@/assets/strategy-cover.jpg";
import bannerImg from "@/assets/strategy-banner.jpg";

interface Props {
  data: StrategyPaperData;
}

// Brand palette (locked, used across chart + page chrome)
const NAVY = "#0B1B3B";
const NAVY_DEEP = "#050F26";
const GOLD = "#C9A24C";
const GOLD_SOFT = "#E5C87A";
const INK = "#0F172A";
const MUTE = "#64748B";
const EXISTING = "#94A3B8";      // slate — status quo
const COMPARISON = "#C9A24C";     // gold — recommended

const serif = { fontFamily: "'Fraunces', 'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', system-ui, sans-serif" };

// A4 page shell
function Page({ children, bleed, style }: { children: React.ReactNode; bleed?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      className="strategy-page mx-auto shadow-2xl print:shadow-none relative overflow-hidden"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: bleed ? 0 : "18mm 16mm",
        background: "#ffffff",
        color: INK,
        ...sans,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-4">
      {kicker && (
        <div style={{ color: GOLD, letterSpacing: "0.35em" }} className="text-[9px] font-semibold uppercase mb-1">
          {kicker}
        </div>
      )}
      <h2 style={{ ...serif, color: NAVY }} className="text-2xl font-semibold leading-tight">
        {children}
      </h2>
      <div style={{ background: GOLD }} className="h-[2px] w-10 mt-2" />
    </div>
  );
}

function Row({ label, existing, comparison, highlight }: { label: string; existing: React.ReactNode; comparison: React.ReactNode; highlight?: boolean }) {
  return (
    <tr>
      <td className="p-2.5 text-[10.5px] font-medium border-b border-slate-200" style={{ color: MUTE }}>{label}</td>
      <td className="p-2.5 text-[11px] border-b border-slate-200 text-slate-800">{existing}</td>
      <td
        className="p-2.5 text-[11px] border-b border-slate-200 font-semibold"
        style={{ color: highlight ? "#7A5E12" : NAVY, background: highlight ? "rgba(201,162,76,0.10)" : "rgba(11,27,59,0.03)" }}
      >
        {comparison}
      </td>
    </tr>
  );
}

function TableHead() {
  return (
    <thead>
      <tr>
        <th className="p-2.5 text-left text-[9px] font-semibold uppercase tracking-widest border-b-2" style={{ color: MUTE, borderColor: "#E2E8F0" }}></th>
        <th className="p-2.5 text-left text-[9px] font-semibold uppercase tracking-widest border-b-2" style={{ color: MUTE, borderColor: "#E2E8F0" }}>Existing</th>
        <th className="p-2.5 text-left text-[9px] font-semibold uppercase tracking-widest border-b-2" style={{ color: NAVY, borderColor: GOLD }}>Recommended</th>
      </tr>
    </thead>
  );
}

function Stat({ label, value, tone = "navy" }: { label: string; value: React.ReactNode; tone?: "navy" | "gold" | "muted" }) {
  const color = tone === "gold" ? GOLD : tone === "muted" ? MUTE : NAVY;
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: MUTE }}>{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ ...serif, color }}>{value}</div>
    </div>
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
  const cmpBal = data.comparison.superBalance || data.existing.superBalance;
  const cmpAdvice = annualAdviceFee(cmpBal, { adviceFeeFlat: 0, annualAdvicePct: data.fees.annualAdvicePct, annualFeeCap: data.fees.annualFeeCap });

  const uplift = cmp.projectedBalance - ex.projectedBalance;
  const upliftPct = ex.projectedBalance > 0 ? (uplift / ex.projectedBalance) * 100 : 0;

  const accSeries = useMemo(
    () => ex.accumulationSeries.map((r, i) => ({
      age: r.age,
      Existing: Math.round(r.balance),
      Recommended: Math.round(cmp.accumulationSeries[i]?.balance ?? 0),
    })),
    [ex.accumulationSeries, cmp.accumulationSeries],
  );

  const wdSeries = useMemo(() => {
    const maxLen = Math.max(ex.withdrawalSeries.length, cmp.withdrawalSeries.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      age: ex.withdrawalSeries[i]?.age ?? cmp.withdrawalSeries[i]?.age,
      Existing: Math.round(ex.withdrawalSeries[i]?.balance ?? 0),
      Recommended: Math.round(cmp.withdrawalSeries[i]?.balance ?? 0),
    }));
  }, [ex.withdrawalSeries, cmp.withdrawalSeries]);

  const feeCompare = [
    { name: "5-yr avg return", Existing: +(data.existing.fiveYearReturn * 100).toFixed(2), Recommended: +(data.comparison.fiveYearReturn * 100).toFixed(2) },
    { name: "Admin fee %", Existing: +(data.existing.adminFeePct * 100).toFixed(2), Recommended: +(data.comparison.adminFeePct * 100).toFixed(2) },
  ];

  const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div ref={ref} className="space-y-6" style={sans}>
      {/* ================= COVER ================= */}
      <Page bleed style={{ background: NAVY_DEEP }}>
        <div className="absolute inset-0">
          <img src={coverImg} alt="" className="w-full h-full object-cover opacity-70" />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, rgba(5,15,38,0.55) 0%, rgba(5,15,38,0.35) 40%, rgba(5,15,38,0.95) 100%)` }}
          />
        </div>
        <div className="relative h-full flex flex-col justify-between" style={{ minHeight: "297mm", padding: "22mm 20mm", color: "#F8FAFC" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ background: GOLD }} className="w-8 h-[2px]" />
              <div className="text-[10px] uppercase tracking-[0.4em]" style={{ color: GOLD_SOFT }}>Advisor Link Online</div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#CBD5E1" }}>Confidential</div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.5em] mb-4" style={{ color: GOLD }}>Strategy Document</div>
            <h1 style={{ ...serif, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.02em" }} className="text-[80px] text-white">
              Prepared for
            </h1>
            <h1 style={{ ...serif, fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.02em", color: GOLD }} className="text-[72px] mt-1">
              {data.clientName || "Client Name"}
            </h1>
            <div style={{ background: GOLD }} className="h-[2px] w-24 mt-8" />
            <p style={{ ...serif, color: "#E2E8F0" }} className="text-lg italic mt-6 max-w-[130mm] leading-relaxed">
              A tailored superannuation, insurance and retirement funding strategy — projected using our proprietary calculation engine and firm model portfolio research.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 text-[11px]" style={{ color: "#CBD5E1" }}>
            <div>
              <div className="uppercase tracking-[0.3em] text-[9px] mb-1" style={{ color: GOLD_SOFT }}>Prepared</div>
              <div className="text-white text-[13px]" style={serif}>{today}</div>
            </div>
            <div>
              <div className="uppercase tracking-[0.3em] text-[9px] mb-1" style={{ color: GOLD_SOFT }}>Horizon</div>
              <div className="text-white text-[13px]" style={serif}>{yearsToRet} years to retirement</div>
            </div>
            <div>
              <div className="uppercase tracking-[0.3em] text-[9px] mb-1" style={{ color: GOLD_SOFT }}>Adviser</div>
              <div className="text-white text-[13px]" style={serif}>Advisor Link Online</div>
            </div>
          </div>
        </div>
      </Page>

      {/* ================= EXECUTIVE SUMMARY ================= */}
      <Page>
        <SectionLabel kicker="01 · Overview">Executive Summary</SectionLabel>

        <p style={serif} className="text-[15px] italic leading-relaxed text-slate-700 mb-6 max-w-[160mm]">
          Based on {data.clientName || "the client"}'s current position — age {age}, retiring at {data.retirementAge} — we have modelled the existing arrangement against a firm-recommended {data.comparison.riskProfile.toLowerCase()} strategy.
        </p>

        <div className="grid grid-cols-3 gap-6 py-6 border-y border-slate-200">
          <Stat label="Projected — Existing" value={fmtMoney(ex.projectedBalance)} tone="muted" />
          <Stat label="Projected — Recommended" value={fmtMoney(cmp.projectedBalance)} tone="navy" />
          <Stat label={uplift >= 0 ? "Potential Uplift" : "Difference"} value={fmtMoney(Math.abs(uplift))} tone="gold" />
        </div>

        <div className="mt-8">
          <div className="text-[9px] uppercase tracking-widest font-semibold mb-3" style={{ color: MUTE }}>Balance at Retirement (Age {data.retirementAge})</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={[{ name: "At Retirement", Existing: Math.round(ex.projectedBalance), Recommended: Math.round(cmp.projectedBalance) }]} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid stroke="#EEF2F7" vertical={false} />
                <XAxis dataKey="name" stroke={MUTE} tick={{ fontSize: 10 }} />
                <YAxis stroke={MUTE} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Existing" fill={EXISTING} radius={[6, 6, 0, 0]} />
                <Bar dataKey="Recommended" fill={COMPARISON} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {upliftPct !== 0 && (
            <div className="text-center text-[11px] mt-2" style={{ color: MUTE }}>
              A projected <span style={{ color: GOLD, fontWeight: 600 }}>{upliftPct >= 0 ? "+" : ""}{upliftPct.toFixed(1)}%</span> difference at retirement.
            </div>
          )}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4">
          <div className="rounded-lg p-5" style={{ background: "rgba(11,27,59,0.04)", borderLeft: `3px solid ${NAVY}` }}>
            <div className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: MUTE }}>Existing money lasts to</div>
            <div className="text-2xl font-semibold mt-1" style={{ ...serif, color: NAVY }}>{ex.moneyNeverRunsOut ? "N/A" : `Age ${ex.ageMoneyLasts}`}</div>
            <div className="text-[10px] mt-1" style={{ color: MUTE }}>Total retirement income {ex.moneyNeverRunsOut ? "—" : fmtMoney(ex.totalIncome)}</div>
          </div>
          <div className="rounded-lg p-5" style={{ background: "rgba(201,162,76,0.10)", borderLeft: `3px solid ${GOLD}` }}>
            <div className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "#7A5E12" }}>Recommended money lasts to</div>
            <div className="text-2xl font-semibold mt-1" style={{ ...serif, color: NAVY }}>{cmp.moneyNeverRunsOut ? "N/A" : `Age ${cmp.ageMoneyLasts}`}</div>
            <div className="text-[10px] mt-1" style={{ color: MUTE }}>Total retirement income {cmp.moneyNeverRunsOut ? "—" : fmtMoney(cmp.totalIncome)}</div>
          </div>
        </div>
      </Page>

      {/* ================= CLIENT PROFILE + SUPER COMPARISON ================= */}
      <Page>
        <SectionLabel kicker="02 · Client">Your Position</SectionLabel>

        <div className="grid grid-cols-3 gap-6 py-5 mb-8 border-y border-slate-200">
          <Stat label="Annual income" value={fmtMoney(data.annualIncome)} />
          <Stat label="Employer SG (12%)" value={fmtMoney(sg)} />
          <Stat label="Net SG after 15% tax" value={fmtMoney(sgNet)} tone="muted" />
          <Stat label="Personal contribution" value={`${fmtMoney(data.personalContributionAmount)}`} tone="muted" />
          <Stat label="Desired retirement income" value={fmtMoney(data.desiredIncomeAmount)} />
          <Stat label="Retirement goal balance" value={fmtMoney(data.goalBalance)} tone="gold" />
        </div>

        <SectionLabel kicker="03 · Superannuation">Fund Comparison</SectionLabel>
        <table className="w-full border-collapse mb-6">
          <TableHead />
          <tbody>
            <Row label="Fund" existing={data.existing.fundName || "—"} comparison={data.comparison.fundName || "Firm model portfolio"} />
            <Row label="Super balance" existing={fmtMoney(data.existing.superBalance)} comparison={fmtMoney(cmpBal)} />
            <Row label="Investment model" existing={data.existing.modelLabel} comparison={data.comparison.modelLabel} />
            <Row label="Risk profile" existing={data.existing.riskProfile} comparison={data.comparison.riskProfile} />
            <Row label="Investment options" existing={data.existing.numInvestmentOptions} comparison={data.comparison.numInvestmentOptions} />
            <Row label="5-yr average return" existing={fmtPct(data.existing.fiveYearReturn, 2)} comparison={fmtPct(data.comparison.fiveYearReturn, 2)} highlight />
            <Row label="Admin fee (%)" existing={fmtPct(data.existing.adminFeePct, 2)} comparison={fmtPct(data.comparison.adminFeePct, 2)} />
            <Row label="Admin fee (flat)" existing={fmtMoney(data.existing.adminFeeFlat)} comparison={fmtMoney(data.comparison.adminFeeFlat)} />
            <Row label="Existing adviser fee" existing={fmtMoney(data.existing.adviserFee)} comparison="—" />
          </tbody>
        </table>

        <div className="mt-6">
          <div className="text-[9px] uppercase tracking-widest font-semibold mb-3" style={{ color: MUTE }}>Return vs Admin Fee (%)</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={feeCompare} layout="vertical" margin={{ top: 5, right: 24, left: 40, bottom: 5 }}>
                <CartesianGrid stroke="#EEF2F7" horizontal={false} />
                <XAxis type="number" stroke={MUTE} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                <YAxis type="category" dataKey="name" stroke={MUTE} tick={{ fontSize: 10 }} width={110} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Existing" fill={EXISTING} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Recommended" fill={COMPARISON} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Page>

      {/* ================= ACCUMULATION ================= */}
      <Page>
        <SectionLabel kicker="04 · Growth">Accumulation Projection</SectionLabel>
        <p className="text-[12px] leading-relaxed text-slate-600 mb-5 max-w-[160mm]">
          Projected super balance from age {age} to {data.retirementAge}, using the same calculation engine as our Super Health Check — 12% SG, 15% contributions tax, and periodic market dip years.
        </p>

        <div style={{ height: 300 }} className="mb-6">
          <ResponsiveContainer>
            <AreaChart data={accSeries} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="gExisting" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EXISTING} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={EXISTING} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="age" stroke={MUTE} tick={{ fontSize: 10 }} />
              <YAxis stroke={MUTE} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} labelFormatter={(l) => `Age ${l}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Existing" stroke={EXISTING} strokeWidth={2} fill="url(#gExisting)" />
              <Area type="monotone" dataKey="Recommended" stroke={GOLD} strokeWidth={2.5} fill="url(#gRec)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="p-2 text-left uppercase tracking-widest text-[9px] font-semibold border-b-2" style={{ color: MUTE, borderColor: "#E2E8F0" }}>Age</th>
              <th className="p-2 text-right uppercase tracking-widest text-[9px] font-semibold border-b-2" style={{ color: MUTE, borderColor: "#E2E8F0" }}>Existing balance</th>
              <th className="p-2 text-right uppercase tracking-widest text-[9px] font-semibold border-b-2" style={{ color: NAVY, borderColor: GOLD }}>Recommended balance</th>
            </tr>
          </thead>
          <tbody>
            {accSeries.map((r) => (
              <tr key={r.age}>
                <td className="p-1.5 border-b border-slate-100 font-medium">{r.age}</td>
                <td className="p-1.5 border-b border-slate-100 text-right text-slate-700">{fmtMoney(r.Existing)}</td>
                <td className="p-1.5 border-b border-slate-100 text-right font-semibold" style={{ color: NAVY, background: "rgba(201,162,76,0.06)" }}>{fmtMoney(r.Recommended)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Page>

      {/* ================= WITHDRAWAL + INSURANCE ================= */}
      <Page>
        <SectionLabel kicker="05 · Retirement">Withdrawal Projection</SectionLabel>
        <p className="text-[12px] leading-relaxed text-slate-600 mb-5 max-w-[160mm]">
          Drawing {fmtMoney(data.desiredIncomeAmount)} {data.desiredIncomeFrequency.toLowerCase()} (indexed at 2.5% p.a.) from age {data.retirementAge} onward.
        </p>

        <div style={{ height: 260 }} className="mb-8">
          <ResponsiveContainer>
            <LineChart data={wdSeries} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="age" stroke={MUTE} tick={{ fontSize: 10 }} />
              <YAxis stroke={MUTE} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} labelFormatter={(l) => `Age ${l}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Existing" stroke={EXISTING} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Recommended" stroke={GOLD} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <SectionLabel kicker="06 · Protection">Insurance Comparison</SectionLabel>
        <table className="w-full border-collapse">
          <TableHead />
          <tbody>
            <Row label="Provider" existing={data.existingInsurance.provider || "—"} comparison={data.comparisonInsurance.provider || "—"} />
            <Row label="Life cover" existing={fmtMoney(data.existingInsurance.lifeCover)} comparison={fmtMoney(data.comparisonInsurance.lifeCover)} />
            <Row label="TPD cover" existing={fmtMoney(data.existingInsurance.tpdCover)} comparison={fmtMoney(data.comparisonInsurance.tpdCover)} />
            <Row label="Income protection" existing={`${fmtMoney(data.existingInsurance.ipMonthly)} / month`} comparison={`${fmtMoney(data.comparisonInsurance.ipMonthly)} / month`} />
            <Row label="Waiting period" existing={data.existingInsurance.waitingPeriod} comparison={data.comparisonInsurance.waitingPeriod} />
            <Row label="Benefit period" existing={data.existingInsurance.benefitPeriod} comparison={data.comparisonInsurance.benefitPeriod} />
            <Row label="Premium (annual)" existing={fmtMoney(data.existingInsurance.premiumAnnual)} comparison={fmtMoney(data.comparisonInsurance.premiumAnnual)} highlight />
            <Row label="Structure" existing={data.existingInsurance.structure} comparison={data.comparisonInsurance.structure} />
            <Row label="IP type" existing={data.existingInsurance.type} comparison={data.comparisonInsurance.type} />
          </tbody>
        </table>
      </Page>

      {/* ================= FEES + NOTES ================= */}
      <Page>
        <SectionLabel kicker="07 · Advice">Fees Summary</SectionLabel>
        <table className="w-full border-collapse mb-8">
          <TableHead />
          <tbody>
            <Row label="Advice / implementation (one-off)" existing="—" comparison={fmtMoney(data.fees.adviceFeeFlat)} />
            <Row label="Annual advice fee %" existing="—" comparison={fmtPct(data.fees.annualAdvicePct, 2)} />
            <Row label="Annual advice fee cap" existing="—" comparison={fmtMoney(data.fees.annualFeeCap)} />
            <Row label="Effective annual advice fee (yr 1)" existing={fmtMoney(exAdvice)} comparison={fmtMoney(cmpAdvice)} highlight />
          </tbody>
        </table>

        {data.researchNotes && (
          <>
            <SectionLabel kicker="08 · Research">Research & Notes</SectionLabel>
            <div className="rounded-lg p-5 text-[11.5px] leading-relaxed whitespace-pre-wrap text-slate-700" style={{ background: "rgba(11,27,59,0.03)", borderLeft: `3px solid ${GOLD}` }}>
              {data.researchNotes}
            </div>
          </>
        )}

        <div className="mt-10">
          <img src={bannerImg} alt="" className="w-full h-24 object-cover rounded-lg" />
        </div>

        <div className="mt-8 pt-4 border-t border-slate-200 text-[9px] leading-relaxed" style={{ color: MUTE }}>
          <p className="mb-1"><span style={{ color: NAVY, fontWeight: 600 }}>Methodology.</span> Projections use the same calculation engine as the Super Health Check report: employer SG at 12% (contributions tax 15%), 2.5% inflation adjustment on withdrawals, and periodic 10%/5% market dip years in accumulation/withdrawal phases respectively.</p>
          <p><span style={{ color: NAVY, fontWeight: 600 }}>Disclaimer.</span> This document is general in nature and does not constitute personal financial advice. Consider your objectives, financial situation and needs, and read the relevant Product Disclosure Statement before making any decision.</p>
        </div>

        <div className="mt-6 flex items-center justify-between text-[9px]" style={{ color: MUTE }}>
          <span className="uppercase tracking-[0.3em]">Advisor Link Online</span>
          <span>{today}</span>
        </div>
      </Page>
    </div>
  );
});
