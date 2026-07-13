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

interface Props {
  data: StrategyPaperData;
}

// Brand palette
const NAVY = "#0B1B3B";
const NAVY_DEEP = "#050F26";
const NAVY_INK = "#0A1830";
const GOLD = "#C9A24C";
const GOLD_SOFT = "#E5C87A";
const GOLD_DEEP = "#8A6E2A";
const INK = "#0F172A";
const MUTE = "#64748B";
const RULE = "#E2E8F0";
const EXISTING = "#94A3B8";
const COMPARISON = "#C9A24C";

const serif = { fontFamily: "'Fraunces', 'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', system-ui, sans-serif" };

/* ─────────────────────────── PAGE SHELL ─────────────────────────── */

function Page({
  children,
  bleed,
  style,
}: {
  children: React.ReactNode;
  bleed?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="strategy-page mx-auto shadow-2xl print:shadow-none relative overflow-hidden"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: bleed ? 0 : "16mm 16mm 14mm 16mm",
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

function RunningHeader({ client, section }: { client: string; section: string }) {
  return (
    <div className="flex items-center justify-between pb-3 mb-6" style={{ borderBottom: `1px solid ${RULE}` }}>
      <div className="flex items-center gap-2.5">
        <Monogram size={22} />
        <span className="text-[9px] uppercase tracking-[0.35em] font-semibold" style={{ color: NAVY }}>
          Advisor Link Online
        </span>
      </div>
      <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.3em]" style={{ color: MUTE }}>
        <span>{client || "Client"}</span>
        <span style={{ color: GOLD }}>·</span>
        <span style={{ color: NAVY }}>{section}</span>
      </div>
    </div>
  );
}

function RunningFooter({ page, total, date }: { page: number; total: number; date: string }) {
  return (
    <div className="mt-8 pt-3 flex items-center justify-between text-[8.5px] uppercase tracking-[0.3em]" style={{ borderTop: `1px solid ${RULE}`, color: MUTE }}>
      <span>Strategy Document</span>
      <span>{date}</span>
      <span>
        <span style={{ color: NAVY, fontWeight: 600 }}>{String(page).padStart(2, "0")}</span>
        <span style={{ color: GOLD }}> / </span>
        {String(total).padStart(2, "0")}
      </span>
    </div>
  );
}

function Monogram({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="4" stroke={GOLD} strokeWidth="1.2" />
      <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" fill={NAVY} fontFamily="'Fraunces', Georgia, serif" fontWeight="700" fontSize="18">
        A
      </text>
      <text x="70%" y="55%" textAnchor="middle" dominantBaseline="middle" fill={GOLD} fontFamily="'Fraunces', Georgia, serif" fontWeight="700" fontSize="18">
        L
      </text>
    </svg>
  );
}

/* ─────────────────────────── SECTION PRIMITIVES ─────────────────────────── */

function SectionMark({ n, kicker, title }: { n: string; kicker: string; title: string }) {
  return (
    <div className="flex items-end gap-5 mb-5">
      <div style={{ borderRight: `1px solid ${GOLD}` }} className="pr-5">
        <div className="text-[9px] uppercase tracking-[0.35em] font-semibold" style={{ color: GOLD_DEEP }}>
          Section
        </div>
        <div style={{ ...serif, color: NAVY, fontWeight: 500, fontSize: 40, lineHeight: 1 }} className="mt-1">
          {n}
        </div>
      </div>
      <div className="pb-1">
        <div className="text-[9px] uppercase tracking-[0.35em] font-semibold" style={{ color: GOLD }}>
          {kicker}
        </div>
        <h2 style={{ ...serif, color: NAVY }} className="text-[26px] font-semibold leading-tight mt-1">
          {title}
        </h2>
      </div>
    </div>
  );
}

function Rule({ my = 4 }: { my?: number }) {
  return <div style={{ background: RULE, height: 1, marginTop: `${my * 4}px`, marginBottom: `${my * 4}px` }} />;
}

function Row({
  label,
  existing,
  comparison,
  highlight,
}: {
  label: string;
  existing: React.ReactNode;
  comparison: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <tr>
      <td className="py-2 px-3 text-[10.5px] font-medium border-b" style={{ color: MUTE, borderColor: RULE }}>
        {label}
      </td>
      <td className="py-2 px-3 text-[11px] border-b text-slate-800" style={{ borderColor: RULE }}>
        {existing}
      </td>
      <td
        className="py-2 px-3 text-[11px] border-b font-semibold"
        style={{
          borderColor: RULE,
          color: highlight ? GOLD_DEEP : NAVY,
          background: highlight ? "rgba(201,162,76,0.12)" : "rgba(11,27,59,0.025)",
        }}
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
        <th className="py-2 px-3 text-left text-[9px] font-semibold uppercase tracking-[0.25em] border-b-2" style={{ color: MUTE, borderColor: RULE }} />
        <th className="py-2 px-3 text-left text-[9px] font-semibold uppercase tracking-[0.25em] border-b-2" style={{ color: MUTE, borderColor: RULE }}>
          Existing
        </th>
        <th className="py-2 px-3 text-left text-[9px] font-semibold uppercase tracking-[0.25em] border-b-2" style={{ color: NAVY, borderColor: GOLD }}>
          Recommended
        </th>
      </tr>
    </thead>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "navy",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "navy" | "gold" | "muted";
}) {
  const color = tone === "gold" ? GOLD_DEEP : tone === "muted" ? "#334155" : NAVY;
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.3em] font-semibold" style={{ color: MUTE }}>
        {label}
      </div>
      <div className="mt-1 text-[26px] font-semibold leading-tight" style={{ ...serif, color }}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] mt-1" style={{ color: MUTE }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Callout({ title, body, tone = "navy" }: { title: string; body: React.ReactNode; tone?: "navy" | "gold" }) {
  const bg = tone === "gold" ? "rgba(201,162,76,0.10)" : "rgba(11,27,59,0.04)";
  const bar = tone === "gold" ? GOLD : NAVY;
  const titleColor = tone === "gold" ? GOLD_DEEP : NAVY;
  return (
    <div className="p-4 rounded-sm" style={{ background: bg, borderLeft: `3px solid ${bar}` }}>
      <div className="text-[9px] uppercase tracking-[0.3em] font-semibold" style={{ color: titleColor }}>
        {title}
      </div>
      <div className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "#334155" }}>
        {body}
      </div>
    </div>
  );
}

/* ─────────────────────────── COMPONENT ─────────────────────────── */

export const StrategyPaperRender = forwardRef<HTMLDivElement, Props>(function StrategyPaperRender({ data }, ref) {
  const age = ageFromDob(data.clientDob);
  const yearsToRet = Math.max(0, data.retirementAge - age);
  const sg = employerSG(data.annualIncome);
  const sgNet = netEmployerContrib(data.annualIncome);

  const ex = runScenario(data, data.existing);
  const cmp = runScenario(data, data.comparison);

  const exAdvice = annualAdviceFee(data.existing.superBalance, {
    adviceFeeFlat: 0,
    annualAdvicePct: data.fees.annualAdvicePct,
    annualFeeCap: data.fees.annualFeeCap,
  });
  const cmpBal = data.comparison.superBalance || data.existing.superBalance;
  const cmpAdvice = annualAdviceFee(cmpBal, {
    adviceFeeFlat: 0,
    annualAdvicePct: data.fees.annualAdvicePct,
    annualFeeCap: data.fees.annualFeeCap,
  });

  const uplift = cmp.projectedBalance - ex.projectedBalance;
  const upliftPct = ex.projectedBalance > 0 ? (uplift / ex.projectedBalance) * 100 : 0;
  const incomeUplift = cmp.totalIncome - ex.totalIncome;

  const accSeries = useMemo(
    () =>
      ex.accumulationSeries.map((r, i) => ({
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
  const clientName = data.clientName || "Client Name";
  const refNo = useMemo(() => {
    const seed = (clientName + data.clientDob).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return `ALO-${String(new Date().getFullYear()).slice(-2)}-${String(seed % 9999).padStart(4, "0")}`;
  }, [clientName, data.clientDob]);
  const TOTAL_PAGES = 6;

  return (
    <div ref={ref} className="space-y-6" style={sans}>
      {/* ═══════════════════════════ 01 · COVER ═══════════════════════════ */}
      <Page bleed style={{ background: NAVY_DEEP }}>
        {/* photographic backdrop */}
        <div className="absolute inset-0">
          <img src={coverImg} alt="" className="w-full h-full object-cover" style={{ opacity: 0.85 }} />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(5,15,38,0.55) 0%, rgba(5,15,38,0.25) 32%, rgba(5,15,38,0.85) 78%, rgba(5,15,38,0.98) 100%)`,
            }}
          />
        </div>

        {/* ornamental frame */}
        <div className="absolute pointer-events-none" style={{ inset: "10mm", border: `1px solid ${GOLD}`, opacity: 0.55 }} />
        <div className="absolute pointer-events-none" style={{ inset: "11.5mm", border: `1px solid ${GOLD}`, opacity: 0.2 }} />

        {/* corner ornaments */}
        {[
          { top: "9mm", left: "9mm" },
          { top: "9mm", right: "9mm" },
          { bottom: "9mm", left: "9mm" },
          { bottom: "9mm", right: "9mm" },
        ].map((pos, i) => (
          <div key={i} className="absolute" style={pos as React.CSSProperties}>
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="2.5" fill="none" stroke={GOLD} strokeWidth="1" />
              <circle cx="7" cy="7" r="0.9" fill={GOLD} />
            </svg>
          </div>
        ))}

        <div className="relative flex flex-col justify-between" style={{ minHeight: "297mm", padding: "22mm 22mm", color: "#F8FAFC" }}>
          {/* HEADER */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Monogram size={38} />
              <div>
                <div className="text-[9px] uppercase tracking-[0.4em] font-semibold" style={{ color: GOLD_SOFT }}>
                  Advisor Link Online
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "#94A3B8", ...serif, fontStyle: "italic" }}>
                  Private Wealth · Est. 2018
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8.5px] uppercase tracking-[0.35em]" style={{ color: "#CBD5E1" }}>
                Confidential
              </div>
              <div className="text-[8.5px] uppercase tracking-[0.35em] mt-1" style={{ color: GOLD_SOFT }}>
                No. {refNo}
              </div>
            </div>
          </div>

          {/* TITLE BLOCK */}
          <div className="relative">
            {/* vertical rule */}
            <div className="absolute left-0 top-2 bottom-2 w-px" style={{ background: `linear-gradient(180deg, transparent, ${GOLD}, transparent)` }} />
            <div className="pl-8">
              <div className="text-[10px] uppercase tracking-[0.6em] mb-6" style={{ color: GOLD }}>
                — Strategy Document
              </div>
              <h1
                style={{ ...serif, fontWeight: 300, lineHeight: 0.95, letterSpacing: "-0.03em" }}
                className="text-[68px] text-white"
              >
                A Strategy
                <br />
                <span style={{ fontStyle: "italic", fontWeight: 400 }}>for the years</span>
                <br />
                <span style={{ color: GOLD_SOFT, fontWeight: 500 }}>ahead.</span>
              </h1>

              <div className="mt-10 flex items-center gap-4">
                <div style={{ background: GOLD, height: 1, width: 40 }} />
                <div className="text-[9px] uppercase tracking-[0.4em]" style={{ color: GOLD_SOFT }}>
                  Prepared for
                </div>
              </div>
              <div style={{ ...serif, color: "#F8FAFC", fontWeight: 400, letterSpacing: "-0.01em" }} className="text-[38px] mt-3 leading-none">
                {clientName}
              </div>

              <p style={{ ...serif, color: "#CBD5E1", fontStyle: "italic" }} className="text-[13px] mt-7 max-w-[125mm] leading-relaxed">
                A tailored superannuation, insurance and retirement funding strategy — modelled on the same proprietary calculation engine that powers our Super Health Check and benchmarked against our firm model portfolio research.
              </p>
            </div>
          </div>

          {/* FOOTER META */}
          <div>
            <div style={{ background: GOLD, height: 1, opacity: 0.4 }} className="mb-5" />
            <div className="grid grid-cols-4 gap-6">
              {[
                { k: "Prepared", v: today },
                { k: "Horizon", v: `${yearsToRet} years` },
                { k: "Retirement Age", v: `${data.retirementAge}` },
                { k: "Adviser", v: "Advisor Link" },
              ].map((c) => (
                <div key={c.k}>
                  <div className="uppercase tracking-[0.3em] text-[8.5px]" style={{ color: GOLD_SOFT }}>
                    {c.k}
                  </div>
                  <div className="text-white text-[13px] mt-1.5" style={serif}>
                    {c.v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Page>

      {/* ═══════════════════════════ 02 · CONTENTS + EXEC SUMMARY ═══════════════════════════ */}
      <Page>
        <RunningHeader client={clientName} section="Executive Summary" />

        <div className="grid grid-cols-[1fr_2fr] gap-8">
          {/* LEFT — contents column */}
          <aside>
            <div className="text-[9px] uppercase tracking-[0.35em] font-semibold" style={{ color: GOLD_DEEP }}>
              Contents
            </div>
            <ol className="mt-4 space-y-3">
              {[
                { n: "I", t: "Executive Summary" },
                { n: "II", t: "Your Position" },
                { n: "III", t: "Fund Comparison" },
                { n: "IV", t: "Accumulation" },
                { n: "V", t: "Retirement Income" },
                { n: "VI", t: "Insurance & Fees" },
              ].map((c) => (
                <li key={c.n} className="flex items-baseline gap-3 text-[11px]">
                  <span style={{ ...serif, color: GOLD, fontWeight: 500, width: 24 }}>{c.n}</span>
                  <span style={{ color: NAVY }}>{c.t}</span>
                </li>
              ))}
            </ol>

            <div className="mt-10 p-4" style={{ background: NAVY, color: "#F8FAFC" }}>
              <div className="text-[9px] uppercase tracking-[0.35em]" style={{ color: GOLD_SOFT }}>
                Client Reference
              </div>
              <div style={{ ...serif }} className="text-[16px] mt-1.5">
                {clientName}
              </div>
              <div className="text-[10px] mt-3 space-y-1.5" style={{ color: "#CBD5E1" }}>
                <div className="flex justify-between">
                  <span>Age</span>
                  <span style={{ color: GOLD_SOFT }}>{age}</span>
                </div>
                <div className="flex justify-between">
                  <span>Retires</span>
                  <span style={{ color: GOLD_SOFT }}>{data.retirementAge}</span>
                </div>
                <div className="flex justify-between">
                  <span>Horizon</span>
                  <span style={{ color: GOLD_SOFT }}>{yearsToRet} yrs</span>
                </div>
                <div className="flex justify-between">
                  <span>Ref.</span>
                  <span style={{ color: GOLD_SOFT }}>{refNo}</span>
                </div>
              </div>
            </div>

            <p style={{ ...serif, fontStyle: "italic", color: MUTE }} className="text-[10.5px] mt-8 leading-relaxed">
              &ldquo;The best time to plant a tree was twenty years ago. The second best time is now.&rdquo;
            </p>
          </aside>

          {/* RIGHT — executive summary */}
          <section>
            <SectionMark n="I" kicker="Overview" title="Executive Summary" />

            <p className="text-[12px] leading-relaxed text-slate-700 mb-5">
              <span style={{ ...serif, color: NAVY, fontSize: 42, lineHeight: 0.85, float: "left", marginRight: 8, marginTop: 4 }}>B</span>
              ased on {clientName}&apos;s current position — age {age}, retiring at {data.retirementAge} — we have modelled the existing arrangement against a firm-recommended {data.comparison.riskProfile.toLowerCase()} strategy. Projections use identical assumptions across both scenarios so the difference is attributable to fund construction, fees and asset allocation alone.
            </p>

            <div className="grid grid-cols-3 gap-5 py-4" style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
              <Stat label="Existing at retirement" value={fmtMoney(ex.projectedBalance)} tone="muted" />
              <Stat label="Recommended" value={fmtMoney(cmp.projectedBalance)} />
              <Stat
                label={uplift >= 0 ? "Projected uplift" : "Difference"}
                value={fmtMoney(Math.abs(uplift))}
                tone="gold"
                sub={upliftPct !== 0 ? `${upliftPct >= 0 ? "+" : ""}${upliftPct.toFixed(1)}% at retirement` : undefined}
              />
            </div>

            <div className="mt-5" style={{ height: 180 }}>
              <ResponsiveContainer>
                <BarChart
                  data={[{ name: `Age ${data.retirementAge}`, Existing: Math.round(ex.projectedBalance), Recommended: Math.round(cmp.projectedBalance) }]}
                  margin={{ top: 6, right: 12, left: 0, bottom: 4 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="name" stroke={MUTE} tick={{ fontSize: 10 }} />
                  <YAxis stroke={MUTE} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
                  <Bar dataKey="Existing" fill={EXISTING} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Recommended" fill={COMPARISON} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Rule my={3} />

            <div className="grid grid-cols-2 gap-4">
              <Callout
                title="Existing outlook"
                body={
                  <>
                    Balance is projected to last until <b style={{ color: NAVY }}>{ex.moneyNeverRunsOut ? "age 100+" : `age ${ex.ageMoneyLasts}`}</b>, delivering an estimated {fmtMoney(ex.totalIncome)} in total retirement income.
                  </>
                }
              />
              <Callout
                tone="gold"
                title="Recommended outlook"
                body={
                  <>
                    Balance is projected to last until <b style={{ color: NAVY }}>{cmp.moneyNeverRunsOut ? "age 100+" : `age ${cmp.ageMoneyLasts}`}</b>, delivering {fmtMoney(cmp.totalIncome)} — an additional {fmtMoney(Math.abs(incomeUplift))} of lifetime income.
                  </>
                }
              />
            </div>
          </section>
        </div>

        <RunningFooter page={2} total={TOTAL_PAGES} date={today} />
      </Page>

      {/* ═══════════════════════════ 03 · YOUR POSITION ═══════════════════════════ */}
      <Page>
        <RunningHeader client={clientName} section="Your Position" />
        <SectionMark n="II" kicker="Client" title="Your Position Today" />

        <div className="grid grid-cols-3 gap-x-8 gap-y-6 py-5" style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
          <Stat label="Annual income" value={fmtMoney(data.annualIncome)} />
          <Stat label="Employer SG (12%)" value={fmtMoney(sg)} sub="Pre-tax contribution" />
          <Stat label="Net SG (after 15% tax)" value={fmtMoney(sgNet)} tone="muted" />
          <Stat
            label="Personal contribution"
            value={fmtMoney(data.personalContributionAmount)}
            sub={data.personalContributionFrequency}
            tone="muted"
          />
          <Stat label="Desired retirement income" value={fmtMoney(data.desiredIncomeAmount)} sub={data.desiredIncomeFrequency} />
          <Stat label="Retirement goal" value={fmtMoney(data.goalBalance)} tone="gold" />
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-8 mt-8">
          <div>
            <h3 style={{ ...serif, color: NAVY }} className="text-[16px] font-semibold mb-3">
              Superannuation Fund Comparison
            </h3>
            <table className="w-full border-collapse">
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
          </div>

          <div>
            <h3 style={{ ...serif, color: NAVY }} className="text-[16px] font-semibold mb-3">
              Return vs Fee
            </h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={feeCompare} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#EEF2F7" horizontal={false} />
                  <XAxis type="number" stroke={MUTE} tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
                  <YAxis type="category" dataKey="name" stroke={MUTE} tick={{ fontSize: 9 }} width={90} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="Existing" fill={EXISTING} radius={[0, 3, 3, 0]} />
                  <Bar dataKey="Recommended" fill={COMPARISON} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Callout
              tone="gold"
              title="Observation"
              body={
                <>
                  The recommended portfolio delivers a{" "}
                  <b style={{ color: NAVY }}>
                    {((data.comparison.fiveYearReturn - data.existing.fiveYearReturn) * 100).toFixed(2)}%
                  </b>{" "}
                  higher 5-year average return with an admin fee differential of{" "}
                  <b style={{ color: NAVY }}>{((data.comparison.adminFeePct - data.existing.adminFeePct) * 100).toFixed(2)}%</b>.
                </>
              }
            />
          </div>
        </div>

        <RunningFooter page={3} total={TOTAL_PAGES} date={today} />
      </Page>

      {/* ═══════════════════════════ 04 · ACCUMULATION ═══════════════════════════ */}
      <Page>
        <RunningHeader client={clientName} section="Accumulation Projection" />
        <SectionMark n="III" kicker="Growth" title="Accumulation to Retirement" />

        <div className="grid grid-cols-[2fr_1fr] gap-8">
          <div>
            <p className="text-[11.5px] leading-relaxed text-slate-700 mb-4">
              Projected super balance from age {age} to {data.retirementAge}, using the same calculation engine as our Super Health Check — 12% employer SG, 15% contributions tax, and periodic market dip years reflecting realistic long-run volatility.
            </p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={accSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
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
                  <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
                  <Area type="monotone" dataKey="Existing" stroke={EXISTING} strokeWidth={2} fill="url(#gExisting)" />
                  <Area type="monotone" dataKey="Recommended" stroke={GOLD} strokeWidth={2.5} fill="url(#gRec)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="p-4" style={{ background: NAVY, color: "#F8FAFC" }}>
              <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: GOLD_SOFT }}>
                At Retirement
              </div>
              <div className="mt-2" style={{ ...serif, fontSize: 28, color: GOLD_SOFT }}>
                {fmtMoney(cmp.projectedBalance)}
              </div>
              <div className="text-[10px] mt-1" style={{ color: "#CBD5E1" }}>
                Recommended portfolio
              </div>
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgba(201,162,76,0.4)` }}>
                <div className="text-[10px]" style={{ color: "#CBD5E1" }}>
                  Existing portfolio
                </div>
                <div className="mt-1" style={{ ...serif, fontSize: 18, color: "#F8FAFC" }}>
                  {fmtMoney(ex.projectedBalance)}
                </div>
              </div>
            </div>

            <Callout
              tone="gold"
              title="Key insight"
              body={
                <>
                  Over {yearsToRet} years, the {(data.comparison.fiveYearReturn * 100).toFixed(1)}% projected return compounds into an additional{" "}
                  <b style={{ color: NAVY }}>{fmtMoney(Math.abs(uplift))}</b> at retirement.
                </>
              }
            />

            <div className="text-[10px] text-slate-600 leading-relaxed">
              <b style={{ color: NAVY }}>Assumptions.</b> Contributions include 12% SG plus personal contributions of {fmtMoney(data.personalContributionAmount)} {data.personalContributionFrequency.toLowerCase()}. Returns are net of investment fees and reduced by dip years at set intervals.
            </div>
          </aside>
        </div>

        <Rule my={4} />

        <h3 style={{ ...serif, color: NAVY }} className="text-[13px] font-semibold mb-2">
          Year-by-year projection
        </h3>
        <div className="grid grid-cols-2 gap-x-6">
          {[accSeries.slice(0, Math.ceil(accSeries.length / 2)), accSeries.slice(Math.ceil(accSeries.length / 2))].map((half, k) => (
            <table key={k} className="w-full border-collapse text-[9.5px]">
              <thead>
                <tr>
                  <th className="py-1.5 px-2 text-left uppercase tracking-[0.2em] text-[8px] font-semibold border-b" style={{ color: MUTE, borderColor: RULE }}>
                    Age
                  </th>
                  <th className="py-1.5 px-2 text-right uppercase tracking-[0.2em] text-[8px] font-semibold border-b" style={{ color: MUTE, borderColor: RULE }}>
                    Existing
                  </th>
                  <th className="py-1.5 px-2 text-right uppercase tracking-[0.2em] text-[8px] font-semibold border-b-2" style={{ color: NAVY, borderColor: GOLD }}>
                    Recommended
                  </th>
                </tr>
              </thead>
              <tbody>
                {half.map((r) => (
                  <tr key={r.age}>
                    <td className="py-1 px-2 border-b" style={{ borderColor: "#F1F5F9", color: NAVY, fontWeight: 500 }}>{r.age}</td>
                    <td className="py-1 px-2 border-b text-right text-slate-600" style={{ borderColor: "#F1F5F9" }}>
                      {fmtMoney(r.Existing)}
                    </td>
                    <td className="py-1 px-2 border-b text-right font-semibold" style={{ color: NAVY, background: "rgba(201,162,76,0.06)", borderColor: "#F1F5F9" }}>
                      {fmtMoney(r.Recommended)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>

        <RunningFooter page={4} total={TOTAL_PAGES} date={today} />
      </Page>

      {/* ═══════════════════════════ 05 · WITHDRAWAL ═══════════════════════════ */}
      <Page>
        <RunningHeader client={clientName} section="Retirement Income" />
        <SectionMark n="IV" kicker="Retirement" title="Drawdown & Longevity" />

        <p className="text-[11.5px] leading-relaxed text-slate-700 mb-4 max-w-[170mm]">
          Drawing <b style={{ color: NAVY }}>{fmtMoney(data.desiredIncomeAmount)}</b> {data.desiredIncomeFrequency.toLowerCase()} — indexed at 2.5% p.a. — from age {data.retirementAge}. The chart below shows how each portfolio sustains that income across retirement.
        </p>

        <div style={{ height: 300 }} className="mb-5">
          <ResponsiveContainer>
            <LineChart data={wdSeries} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="age" stroke={MUTE} tick={{ fontSize: 10 }} />
              <YAxis stroke={MUTE} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} labelFormatter={(l) => `Age ${l}`} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
              <Line type="monotone" dataKey="Existing" stroke={EXISTING} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Recommended" stroke={GOLD} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-4 gap-5 py-4" style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
          <Stat label="Existing lasts to" value={ex.moneyNeverRunsOut ? "100+" : `Age ${ex.ageMoneyLasts}`} tone="muted" />
          <Stat label="Recommended lasts to" value={cmp.moneyNeverRunsOut ? "100+" : `Age ${cmp.ageMoneyLasts}`} />
          <Stat label="Existing total income" value={fmtMoney(ex.totalIncome)} tone="muted" />
          <Stat label="Recommended total income" value={fmtMoney(cmp.totalIncome)} tone="gold" />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <Callout
            title="Longevity risk — existing"
            body={
              ex.moneyNeverRunsOut ? (
                <>Under current settings, the balance sustains withdrawals through age 100 with capital remaining.</>
              ) : (
                <>Capital depletes at age {ex.ageMoneyLasts}, exposing {clientName} to longevity risk should life expectancy exceed projections.</>
              )
            }
          />
          <Callout
            tone="gold"
            title="Longevity outlook — recommended"
            body={
              cmp.moneyNeverRunsOut ? (
                <>The recommended portfolio maintains withdrawals through age 100 with meaningful capital preserved.</>
              ) : (
                <>Capital sustains until age {cmp.ageMoneyLasts} — {cmp.ageMoneyLasts - ex.ageMoneyLasts} additional years of funded retirement versus the existing arrangement.</>
              )
            }
          />
        </div>

        <RunningFooter page={5} total={TOTAL_PAGES} date={today} />
      </Page>

      {/* ═══════════════════════════ 06 · INSURANCE, FEES & CLOSE ═══════════════════════════ */}
      <Page>
        <RunningHeader client={clientName} section="Insurance & Fees" />
        <SectionMark n="V" kicker="Protection" title="Insurance Comparison" />

        <table className="w-full border-collapse mb-8">
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

        <SectionMark n="VI" kicker="Advice" title="Fees Summary" />
        <div className="grid grid-cols-[3fr_2fr] gap-6">
          <table className="w-full border-collapse">
            <TableHead />
            <tbody>
              <Row label="Advice / implementation (one-off)" existing="—" comparison={fmtMoney(data.fees.adviceFeeFlat)} />
              <Row label="Annual advice fee %" existing="—" comparison={fmtPct(data.fees.annualAdvicePct, 2)} />
              <Row label="Annual advice fee cap" existing="—" comparison={fmtMoney(data.fees.annualFeeCap)} />
              <Row label="Effective annual advice fee (yr 1)" existing={fmtMoney(exAdvice)} comparison={fmtMoney(cmpAdvice)} highlight />
            </tbody>
          </table>

          {data.researchNotes ? (
            <Callout title="Research & Notes" body={<span className="whitespace-pre-wrap">{data.researchNotes}</span>} />
          ) : (
            <Callout
              tone="gold"
              title="Value in advice"
              body={
                <>
                  Even after fees, the recommended structure is projected to deliver{" "}
                  <b style={{ color: NAVY }}>{fmtMoney(Math.abs(incomeUplift))}</b> of additional lifetime retirement income.
                </>
              }
            />
          )}
        </div>

        {/* SIGN-OFF STRIP */}
        <div className="mt-10 p-6" style={{ background: NAVY_INK, color: "#F8FAFC", borderTop: `2px solid ${GOLD}` }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.35em]" style={{ color: GOLD_SOFT }}>
                Prepared with care for
              </div>
              <div style={{ ...serif }} className="text-[22px] mt-1">
                {clientName}
              </div>
            </div>
            <div className="text-right">
              <Monogram size={34} />
              <div className="text-[9px] uppercase tracking-[0.35em] mt-2" style={{ color: GOLD_SOFT }}>
                Advisor Link Online
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 text-[8.5px] leading-relaxed" style={{ color: MUTE }}>
          <p className="mb-1">
            <span style={{ color: NAVY, fontWeight: 600 }}>Methodology.</span> Projections use the same calculation engine as the Super Health Check: employer SG at 12% (contributions tax 15%), 2.5% inflation adjustment on withdrawals, and periodic market dip years in accumulation and withdrawal phases.
          </p>
          <p>
            <span style={{ color: NAVY, fontWeight: 600 }}>Disclaimer.</span> This document is general in nature and does not constitute personal financial advice. Consider your objectives, financial situation and needs, and read the relevant Product Disclosure Statement before making any decision.
          </p>
        </div>

        <RunningFooter page={6} total={TOTAL_PAGES} date={today} />
      </Page>
    </div>
  );
});
