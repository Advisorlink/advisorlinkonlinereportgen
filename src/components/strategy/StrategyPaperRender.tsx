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
import logoLightAsset from "@/assets/finance-direct-logo-official.png.asset.json";
const logoUrl = logoLightAsset.url;

// Renders the transparent Finance Direct logo tinted to any solid color via CSS mask.
// Aspect ratio of the source PNG is ~4.22:1.
function GoldLogo({ height, color }: { height: number; color: string }) {
  return (
    <div
      aria-label="Finance Direct"
      style={{
        height,
        width: height * 4.22,
        backgroundColor: color,
        WebkitMaskImage: `url(${logoUrl})`,
        maskImage: `url(${logoUrl})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
      }}
    />
  );
}

interface Props {
  data: StrategyPaperData;
}

/* Brand palette */
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

const FIRM = {
  name: "Finance Direct",
  legal: "Finance Direct Pty Ltd",
  afsl: "AFSL 552 108",
  abn: "ABN 47 218 903 771",
  address: "Level 12, 88 Phillip Street, Sydney NSW 2000",
  phone: "1300 348 623",
  email: "advice@financedirect.com.au",
  web: "financedirect.com.au",
};

const serif = { fontFamily: "'Fraunces', 'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', system-ui, sans-serif" };

/* ── PAGE SHELL ── */
function Page({
  children, bleed, style,
}: { children: React.ReactNode; bleed?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      className="strategy-page mx-auto shadow-2xl print:shadow-none relative overflow-hidden"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: bleed ? 0 : "14mm 16mm 12mm 16mm",
        background: "#ffffff",
        color: INK,
        display: bleed ? "block" : "flex",
        flexDirection: bleed ? undefined : "column",
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
    <div className="flex items-center justify-between pb-3 mb-5" style={{ borderBottom: `1px solid ${RULE}` }}>
      <GoldLogo height={22} color={GOLD} />
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
    <div className="mt-auto pt-3 flex items-center justify-between text-[8.5px] uppercase tracking-[0.3em]"
      style={{ borderTop: `1px solid ${RULE}`, color: MUTE }}>
      <span>{FIRM.name} · Strategy Document</span>
      <span>{date}</span>
      <span>
        <span style={{ color: NAVY, fontWeight: 600 }}>{String(page).padStart(2, "0")}</span>
        <span style={{ color: GOLD }}> / </span>
        {String(total).padStart(2, "0")}
      </span>
    </div>
  );
}

/* Refined section header — no huge Roman numeral, kicker + gold rule + title */
function SectionMark({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-2">
        <div style={{ background: GOLD, height: 1, width: 28 }} />
        <div className="text-[9px] uppercase tracking-[0.4em] font-semibold" style={{ color: GOLD_DEEP }}>{kicker}</div>
      </div>
      <h2 style={{ ...serif, color: NAVY }} className="text-[28px] font-semibold leading-[1.1] tracking-tight">{title}</h2>
    </div>
  );
}

function Rule({ my = 4 }: { my?: number }) {
  return <div style={{ background: RULE, height: 1, marginTop: `${my * 4}px`, marginBottom: `${my * 4}px` }} />;
}

function Row({ label, existing, comparison, highlight }:
  { label: string; existing: React.ReactNode; comparison: React.ReactNode; highlight?: boolean }) {
  return (
    <tr>
      <td className="py-2 px-3 text-[10.5px] font-medium border-b" style={{ color: MUTE, borderColor: RULE }}>{label}</td>
      <td className="py-2 px-3 text-[11px] border-b text-slate-800" style={{ borderColor: RULE }}>{existing}</td>
      <td className="py-2 px-3 text-[11px] border-b font-semibold"
        style={{
          borderColor: RULE,
          color: highlight ? GOLD_DEEP : NAVY,
          background: highlight ? "rgba(201,162,76,0.10)" : "rgba(11,27,59,0.02)",
        }}>{comparison}</td>
    </tr>
  );
}

function TableHead() {
  return (
    <thead>
      <tr>
        <th className="py-2 px-3 text-left text-[9px] font-semibold uppercase tracking-[0.25em] border-b-2"
          style={{ color: MUTE, borderColor: RULE }} />
        <th className="py-2 px-3 text-left text-[9px] font-semibold uppercase tracking-[0.25em] border-b-2"
          style={{ color: MUTE, borderColor: RULE }}>Existing</th>
        <th className="py-2 px-3 text-left text-[9px] font-semibold uppercase tracking-[0.25em] border-b-2"
          style={{ color: NAVY, borderColor: GOLD }}>Recommended</th>
      </tr>
    </thead>
  );
}

function Stat({ label, value, sub, tone = "navy" }:
  { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "navy" | "gold" | "muted" }) {
  const color = tone === "gold" ? GOLD_DEEP : tone === "muted" ? "#334155" : NAVY;
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.3em] font-semibold" style={{ color: MUTE }}>{label}</div>
      <div className="mt-1 text-[24px] font-semibold leading-tight" style={{ ...serif, color }}>{value}</div>
      {sub && <div className="text-[10px] mt-1" style={{ color: MUTE }}>{sub}</div>}
    </div>
  );
}

/* Refined note — minimal, editorial. No more colored pill boxes. */
function Note({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3" style={{ borderTop: `1px solid ${RULE}` }}>
      <div className="text-[8.5px] uppercase tracking-[0.35em] font-semibold mb-1.5" style={{ color: GOLD_DEEP }}>{label}</div>
      <div className="text-[11px] leading-relaxed" style={{ color: "#334155" }}>{children}</div>
    </div>
  );
}

/* ── COMPONENT ── */
export const StrategyPaperRender = forwardRef<HTMLDivElement, Props>(function StrategyPaperRender({ data }, ref) {
  const age = ageFromDob(data.clientDob);
  const yearsToRet = Math.max(0, data.retirementAge - age);
  const sg = employerSG(data.annualIncome);
  const sgNet = netEmployerContrib(data.annualIncome);

  const ex = runScenario(data, data.existing);
  const cmp = runScenario(data, data.comparison);

  const exAdvice = annualAdviceFee(data.existing.superBalance, {
    adviceFeeFlat: 0, annualAdvicePct: data.fees.annualAdvicePct, annualFeeCap: data.fees.annualFeeCap,
  });
  const cmpBal = data.comparison.superBalance || data.existing.superBalance;
  const cmpAdvice = annualAdviceFee(cmpBal, {
    adviceFeeFlat: 0, annualAdvicePct: data.fees.annualAdvicePct, annualFeeCap: data.fees.annualFeeCap,
  });

  const uplift = cmp.projectedBalance - ex.projectedBalance;
  const upliftPct = ex.projectedBalance > 0 ? (uplift / ex.projectedBalance) * 100 : 0;
  const incomeUplift = cmp.totalIncome - ex.totalIncome;

  const accSeries = useMemo(() => ex.accumulationSeries.map((r, i) => ({
    age: r.age, Existing: Math.round(r.balance), Recommended: Math.round(cmp.accumulationSeries[i]?.balance ?? 0),
  })), [ex.accumulationSeries, cmp.accumulationSeries]);

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
    return `FD-${String(new Date().getFullYear()).slice(-2)}-${String(seed % 9999).padStart(4, "0")}`;
  }, [clientName, data.clientDob]);
  const TOTAL_PAGES = 6;

  return (
    <div ref={ref} className="space-y-6" style={sans}>

      {/* ═════ 01 · COVER (full bleed) ═════ */}
      <Page bleed style={{ background: NAVY_DEEP }}>
        <div className="absolute inset-0">
          <img src={coverImg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{
            background: `linear-gradient(180deg, rgba(5,15,38,0.55) 0%, rgba(5,15,38,0.35) 35%, rgba(5,15,38,0.85) 78%, rgba(5,15,38,0.98) 100%)`,
          }} />
        </div>

        <div className="relative flex flex-col justify-between"
          style={{ minHeight: "297mm", padding: "22mm 24mm", color: "#F8FAFC" }}>

          {/* HEADER — horizontal logo, no white box */}
          <div className="flex items-start justify-between">
            <img src={logoLight} alt={FIRM.name} style={{ height: 42, width: "auto" }} />
            <div className="text-right">
              <div className="text-[8.5px] uppercase tracking-[0.35em]" style={{ color: "#CBD5E1" }}>Private & Confidential</div>
              <div className="text-[8.5px] uppercase tracking-[0.35em] mt-1" style={{ color: GOLD_SOFT }}>Doc No. {refNo}</div>
              <div className="text-[8.5px] uppercase tracking-[0.35em] mt-1" style={{ color: "#CBD5E1" }}>{today}</div>
            </div>
          </div>

          {/* TITLE */}
          <div className="relative">
            <div className="absolute left-0 top-2 bottom-2 w-px"
              style={{ background: `linear-gradient(180deg, transparent, ${GOLD}, transparent)` }} />
            <div className="pl-8">
              <div className="text-[10px] uppercase tracking-[0.6em] mb-6" style={{ color: GOLD }}>Strategy Document</div>
              <h1 style={{ ...serif, fontWeight: 300, lineHeight: 0.95, letterSpacing: "-0.03em" }}
                className="text-[68px] text-white">
                A Strategy<br />
                <span style={{ fontStyle: "italic", fontWeight: 400 }}>for the years</span><br />
                <span style={{ color: GOLD_SOFT, fontWeight: 500 }}>ahead.</span>
              </h1>

              <div className="mt-10 flex items-center gap-4">
                <div style={{ background: GOLD, height: 1, width: 40 }} />
                <div className="text-[9px] uppercase tracking-[0.4em]" style={{ color: GOLD_SOFT }}>Prepared for</div>
              </div>
              <div style={{ ...serif, color: "#F8FAFC", fontWeight: 400, letterSpacing: "-0.01em" }}
                className="text-[38px] mt-3 leading-none">{clientName}</div>
              <div style={{ color: "#CBD5E1" }} className="text-[11px] mt-2 uppercase tracking-[0.25em]">
                Age {age} · Retiring at {data.retirementAge} · {yearsToRet} year horizon
              </div>

              <p style={{ ...serif, color: "#CBD5E1", fontStyle: "italic" }}
                className="text-[13px] mt-7 max-w-[125mm] leading-relaxed">
                A tailored superannuation, insurance and retirement funding strategy, benchmarked
                against our firm model portfolio research and prepared exclusively for you.
              </p>
            </div>
          </div>

          {/* FOOTER */}
          <div>
            <div style={{ background: GOLD, height: 1, opacity: 0.5 }} className="mb-5" />
            <div className="flex items-end justify-between">
              <div>
                <div className="uppercase tracking-[0.3em] text-[8.5px]" style={{ color: GOLD_SOFT }}>Prepared by</div>
                <div className="text-white text-[15px] mt-1.5" style={serif}>{FIRM.legal}</div>
                <div className="text-[9px] mt-1" style={{ color: "#CBD5E1" }}>
                  {FIRM.afsl} · {FIRM.abn}
                </div>
              </div>
              <div className="text-right text-[9px]" style={{ color: "#CBD5E1" }}>
                <div>{FIRM.address}</div>
                <div className="mt-1">{FIRM.phone} · {FIRM.email}</div>
              </div>
            </div>
          </div>
        </div>
      </Page>

      {/* ═════ 02 · CONTENTS + EXECUTIVE SUMMARY ═════ */}
      <Page>
        <RunningHeader client={clientName} section="Executive Summary" />

        <div className="grid grid-cols-[1fr_2fr] gap-8">
          {/* CONTENTS */}
          <aside>
            <div className="text-[9px] uppercase tracking-[0.35em] font-semibold" style={{ color: GOLD_DEEP }}>Contents</div>
            <ol className="mt-4 space-y-2.5">
              {[
                { t: "Executive Summary", p: "02" },
                { t: "Your Position Today", p: "03" },
                { t: "Accumulation Projection", p: "04" },
                { t: "Retirement Income", p: "05" },
                { t: "Insurance, Fees & Notes", p: "06" },
              ].map((c, i) => (
                <li key={i} className="flex items-baseline gap-3 text-[11px]">
                  <span style={{ color: GOLD, fontWeight: 600, width: 16 }} className="text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ color: NAVY }} className="flex-1">{c.t}</span>
                  <span style={{ color: MUTE }} className="text-[9px] tracking-[0.2em]">p.{c.p}</span>
                </li>
              ))}
            </ol>

            <div className="mt-8 p-4" style={{ background: NAVY, color: "#F8FAFC" }}>
              <div className="text-[9px] uppercase tracking-[0.35em]" style={{ color: GOLD_SOFT }}>Client Reference</div>
              <div style={{ ...serif }} className="text-[16px] mt-1.5">{clientName}</div>
              <div className="text-[10px] mt-3 space-y-1.5" style={{ color: "#CBD5E1" }}>
                <div className="flex justify-between"><span>Age</span><span style={{ color: GOLD_SOFT }}>{age}</span></div>
                <div className="flex justify-between"><span>Retires at</span><span style={{ color: GOLD_SOFT }}>{data.retirementAge}</span></div>
                <div className="flex justify-between"><span>Horizon</span><span style={{ color: GOLD_SOFT }}>{yearsToRet} yrs</span></div>
                <div className="flex justify-between"><span>Ref.</span><span style={{ color: GOLD_SOFT }}>{refNo}</span></div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-[9px] uppercase tracking-[0.35em] font-semibold" style={{ color: GOLD_DEEP }}>About {FIRM.name}</div>
              <p className="text-[10.5px] mt-2 leading-relaxed" style={{ color: "#475569" }}>
                A private wealth practice delivering evidence-based strategy for accumulators
                and retirees across Australia. Every recommendation is modelled, benchmarked
                and stress-tested against long-run capital market assumptions.
              </p>
            </div>
          </aside>

          {/* EXECUTIVE SUMMARY */}
          <section className="flex flex-col">
            <SectionMark kicker="Overview" title="Executive Summary" />

            <p className="text-[12px] leading-relaxed text-slate-700 mb-5">
              Based on {clientName}&apos;s current position (age {age}, retiring at {data.retirementAge}),
              we have modelled the existing arrangement against a firm-recommended {data.comparison.riskProfile.toLowerCase()}
              {" "}strategy. Projections use identical assumptions across both scenarios so the difference
              is attributable to fund construction, fees and asset allocation alone.
            </p>

            <div className="grid grid-cols-3 gap-5 py-4"
              style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
              <Stat label={`Existing at ${data.retirementAge}`} value={fmtMoney(ex.projectedBalance)} tone="muted" />
              <Stat label={`Recommended at ${data.retirementAge}`} value={fmtMoney(cmp.projectedBalance)} />
              <Stat
                label={uplift >= 0 ? "Projected uplift" : "Difference"}
                value={fmtMoney(Math.abs(uplift))}
                tone="gold"
                sub={upliftPct !== 0 ? `${upliftPct >= 0 ? "+" : ""}${upliftPct.toFixed(1)}% vs existing` : undefined}
              />
            </div>

            <div className="mt-4" style={{ height: 170 }}>
              <ResponsiveContainer>
                <BarChart
                  data={[{ name: `At age ${data.retirementAge}`, Existing: Math.round(ex.projectedBalance), Recommended: Math.round(cmp.projectedBalance) }]}
                  margin={{ top: 6, right: 12, left: 0, bottom: 4 }} barCategoryGap="30%">
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

            {/* Outlook strip */}
            <div className="mt-5 grid grid-cols-2 gap-0" style={{ border: `1px solid ${RULE}` }}>
              <div className="p-4" style={{ borderRight: `1px solid ${RULE}`, background: "#F8FAFC" }}>
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: EXISTING }} />
                  <div className="text-[9px] uppercase tracking-[0.3em] font-semibold" style={{ color: MUTE }}>Existing outlook</div>
                </div>
                <div style={{ ...serif, color: NAVY }} className="text-[20px] mt-2 font-semibold">
                  {ex.moneyNeverRunsOut ? "Age 100+" : `Age ${ex.ageMoneyLasts}`}
                </div>
                <div className="text-[10.5px] mt-1" style={{ color: "#475569" }}>
                  Total lifetime income {fmtMoney(ex.totalIncome)}.
                </div>
              </div>
              <div className="p-4" style={{ background: NAVY, color: "#F8FAFC" }}>
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: GOLD }} />
                  <div className="text-[9px] uppercase tracking-[0.3em] font-semibold" style={{ color: GOLD_SOFT }}>Recommended outlook</div>
                </div>
                <div style={{ ...serif, color: GOLD_SOFT }} className="text-[20px] mt-2 font-semibold">
                  {cmp.moneyNeverRunsOut ? "Age 100+" : `Age ${cmp.ageMoneyLasts}`}
                </div>
                <div className="text-[10.5px] mt-1" style={{ color: "#CBD5E1" }}>
                  Total lifetime income {fmtMoney(cmp.totalIncome)} ({fmtMoney(Math.abs(incomeUplift))} more).
                </div>
              </div>
            </div>

            <div className="mt-5 flex-1">
              <div className="text-[9px] uppercase tracking-[0.3em] font-semibold mb-2" style={{ color: GOLD_DEEP }}>
                Key findings
              </div>
              <ul className="space-y-2 text-[11px] leading-relaxed" style={{ color: "#334155" }}>
                <li className="flex gap-2"><span style={{ color: GOLD }}>◆</span>
                  Reallocating from {data.existing.modelLabel} to the firm {data.comparison.modelLabel} model
                  lifts the projected 5-year average return from {fmtPct(data.existing.fiveYearReturn, 2)} to
                  {" "}{fmtPct(data.comparison.fiveYearReturn, 2)}.</li>
                <li className="flex gap-2"><span style={{ color: GOLD }}>◆</span>
                  Over {yearsToRet} years the compounded uplift is projected at {fmtMoney(Math.abs(uplift))}
                  ({upliftPct >= 0 ? "+" : ""}{upliftPct.toFixed(1)}% at retirement).</li>
                <li className="flex gap-2"><span style={{ color: GOLD }}>◆</span>
                  Retirement income capacity increases by {fmtMoney(Math.abs(incomeUplift))} across the drawdown phase.</li>
                <li className="flex gap-2"><span style={{ color: GOLD }}>◆</span>
                  Insurance restructure lifts protection quality (see final section) with a manageable premium impact.</li>
              </ul>
            </div>
          </section>
        </div>

        <RunningFooter page={2} total={TOTAL_PAGES} date={today} />
      </Page>

      {/* ═════ 03 · YOUR POSITION ═════ */}
      <Page>
        <RunningHeader client={clientName} section="Your Position" />
        <SectionMark kicker="Client" title={`Your Position Today · Age ${age}`} />

        <div className="grid grid-cols-3 gap-x-8 gap-y-6 py-5"
          style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
          <Stat label="Current age" value={`${age} yrs`} sub={`Retiring at ${data.retirementAge} (${yearsToRet} yrs away)`} />
          <Stat label="Annual income" value={fmtMoney(data.annualIncome)} />
          <Stat label="Retirement goal" value={fmtMoney(data.goalBalance)} tone="gold" />
          <Stat label="Employer SG (12%)" value={fmtMoney(sg)} sub="Pre-tax contribution" />
          <Stat label="Net SG (after 15% tax)" value={fmtMoney(sgNet)} tone="muted" />
          <Stat label="Personal contribution"
            value={fmtMoney(data.personalContributionAmount)} sub={data.personalContributionFrequency} tone="muted" />
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-8 mt-8">
          <div>
            <h3 style={{ ...serif, color: NAVY }} className="text-[16px] font-semibold mb-3">
              Superannuation Fund Comparison
            </h3>
            <table className="w-full border-collapse">
              <TableHead />
              <tbody>
                <Row label="Fund" existing={data.existing.fundName || "Not stated"} comparison={data.comparison.fundName || "Firm model portfolio"} />
                <Row label="Super balance" existing={fmtMoney(data.existing.superBalance)} comparison={fmtMoney(cmpBal)} />
                <Row label="Investment model" existing={data.existing.modelLabel} comparison={data.comparison.modelLabel} />
                <Row label="Risk profile" existing={data.existing.riskProfile} comparison={data.comparison.riskProfile} />
                <Row label="Investment options" existing={data.existing.numInvestmentOptions} comparison={data.comparison.numInvestmentOptions} />
                <Row label="5-yr average return" existing={fmtPct(data.existing.fiveYearReturn, 2)} comparison={fmtPct(data.comparison.fiveYearReturn, 2)} highlight />
                <Row label="Admin fee (%)" existing={fmtPct(data.existing.adminFeePct, 2)} comparison={fmtPct(data.comparison.adminFeePct, 2)} />
                <Row label="Admin fee (flat)" existing={fmtMoney(data.existing.adminFeeFlat)} comparison={fmtMoney(data.comparison.adminFeeFlat)} />
                <Row label="Existing adviser fee" existing={fmtMoney(data.existing.adviserFee)} comparison="n/a" />
              </tbody>
            </table>
          </div>

          <div>
            <h3 style={{ ...serif, color: NAVY }} className="text-[16px] font-semibold mb-3">Return vs Fee</h3>
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

            <Note label="Observation">
              The recommended portfolio delivers a{" "}
              <b style={{ color: NAVY }}>{((data.comparison.fiveYearReturn - data.existing.fiveYearReturn) * 100).toFixed(2)}%</b>{" "}
              higher 5-year average return with an admin fee differential of{" "}
              <b style={{ color: NAVY }}>{((data.comparison.adminFeePct - data.existing.adminFeePct) * 100).toFixed(2)}%</b>.
            </Note>
          </div>
        </div>

        <RunningFooter page={3} total={TOTAL_PAGES} date={today} />
      </Page>

      {/* ═════ 04 · ACCUMULATION ═════ */}
      <Page>
        <RunningHeader client={clientName} section="Accumulation Projection" />
        <SectionMark kicker="Growth" title="Accumulation to Retirement" />

        <div className="grid grid-cols-[2fr_1fr] gap-8">
          <div>
            <p className="text-[11.5px] leading-relaxed text-slate-700 mb-4">
              Projected super balance from age {age} to {data.retirementAge}, using the same calculation
              engine as our Super Health Check: 12% employer SG, 15% contributions tax, and periodic
              market dip years reflecting realistic long-run volatility.
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
              <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: GOLD_SOFT }}>At Retirement</div>
              <div className="mt-2" style={{ ...serif, fontSize: 28, color: GOLD_SOFT }}>{fmtMoney(cmp.projectedBalance)}</div>
              <div className="text-[10px] mt-1" style={{ color: "#CBD5E1" }}>Recommended portfolio</div>
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgba(201,162,76,0.4)` }}>
                <div className="text-[10px]" style={{ color: "#CBD5E1" }}>Existing portfolio</div>
                <div className="mt-1" style={{ ...serif, fontSize: 18, color: "#F8FAFC" }}>{fmtMoney(ex.projectedBalance)}</div>
              </div>
            </div>

            <Note label="Key insight">
              Over {yearsToRet} years, the {(data.comparison.fiveYearReturn * 100).toFixed(1)}% projected return
              compounds into an additional <b style={{ color: NAVY }}>{fmtMoney(Math.abs(uplift))}</b> at retirement.
            </Note>

            <div className="text-[10px] text-slate-600 leading-relaxed">
              <b style={{ color: NAVY }}>Assumptions.</b> Contributions include 12% SG plus personal
              contributions of {fmtMoney(data.personalContributionAmount)}{" "}
              {data.personalContributionFrequency.toLowerCase()}. Returns are net of investment fees
              and reduced by dip years at set intervals.
            </div>
          </aside>
        </div>

        <Rule my={4} />

        <h3 style={{ ...serif, color: NAVY }} className="text-[13px] font-semibold mb-2">Year-by-year projection</h3>
        <div className="grid grid-cols-2 gap-x-6">
          {[accSeries.slice(0, Math.ceil(accSeries.length / 2)), accSeries.slice(Math.ceil(accSeries.length / 2))].map((half, k) => (
            <table key={k} className="w-full border-collapse text-[9.5px]">
              <thead>
                <tr>
                  <th className="py-1.5 px-2 text-left uppercase tracking-[0.2em] text-[8px] font-semibold border-b" style={{ color: MUTE, borderColor: RULE }}>Age</th>
                  <th className="py-1.5 px-2 text-right uppercase tracking-[0.2em] text-[8px] font-semibold border-b" style={{ color: MUTE, borderColor: RULE }}>Existing</th>
                  <th className="py-1.5 px-2 text-right uppercase tracking-[0.2em] text-[8px] font-semibold border-b-2" style={{ color: NAVY, borderColor: GOLD }}>Recommended</th>
                </tr>
              </thead>
              <tbody>
                {half.map((r) => (
                  <tr key={r.age}>
                    <td className="py-1 px-2 border-b" style={{ borderColor: "#F1F5F9", color: NAVY, fontWeight: 500 }}>{r.age}</td>
                    <td className="py-1 px-2 border-b text-right text-slate-600" style={{ borderColor: "#F1F5F9" }}>{fmtMoney(r.Existing)}</td>
                    <td className="py-1 px-2 border-b text-right font-semibold"
                      style={{ color: NAVY, background: "rgba(201,162,76,0.06)", borderColor: "#F1F5F9" }}>{fmtMoney(r.Recommended)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>

        <RunningFooter page={4} total={TOTAL_PAGES} date={today} />
      </Page>

      {/* ═════ 05 · RETIREMENT INCOME (denser, no empty space) ═════ */}
      <Page>
        <RunningHeader client={clientName} section="Retirement Income" />
        <SectionMark kicker="Retirement" title="Drawdown & Longevity" />

        <p className="text-[11.5px] leading-relaxed text-slate-700 mb-4 max-w-[170mm]">
          Drawing <b style={{ color: NAVY }}>{fmtMoney(data.desiredIncomeAmount)}</b>{" "}
          {data.desiredIncomeFrequency.toLowerCase()} (indexed at 2.5% p.a.) from age {data.retirementAge}.
          The chart shows how each portfolio sustains that income across retirement.
        </p>

        {/* Chart + longevity panel */}
        <div className="grid grid-cols-[2fr_1fr] gap-6">
          <div style={{ height: 260 }}>
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

          <div className="p-5" style={{ background: NAVY, color: "#F8FAFC" }}>
            <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: GOLD_SOFT }}>Longevity</div>
            <div className="mt-3 text-[10px]" style={{ color: "#CBD5E1" }}>Existing lasts to</div>
            <div style={{ ...serif, fontSize: 26, color: "#F8FAFC", lineHeight: 1.1 }}>
              {ex.moneyNeverRunsOut ? "Age 100+" : `Age ${ex.ageMoneyLasts}`}
            </div>
            <div className="mt-4 pt-4 text-[10px]" style={{ color: "#CBD5E1", borderTop: `1px solid rgba(201,162,76,0.4)` }}>
              Recommended lasts to
            </div>
            <div style={{ ...serif, fontSize: 26, color: GOLD_SOFT, lineHeight: 1.1 }}>
              {cmp.moneyNeverRunsOut ? "Age 100+" : `Age ${cmp.ageMoneyLasts}`}
            </div>
            <div className="mt-5 pt-4 text-[10.5px] leading-relaxed" style={{ color: "#CBD5E1", borderTop: `1px solid rgba(201,162,76,0.4)` }}>
              Recommended structure delivers <span style={{ color: GOLD_SOFT, fontWeight: 600 }}>{fmtMoney(cmp.totalIncome)}</span>{" "}
              across retirement — an additional <span style={{ color: GOLD_SOFT, fontWeight: 600 }}>{fmtMoney(Math.abs(incomeUplift))}</span> versus existing.
            </div>
          </div>
        </div>

        {/* Totals strip */}
        <div className="grid grid-cols-4 gap-5 mt-6 py-4"
          style={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
          <Stat label="Existing total income" value={fmtMoney(ex.totalIncome)} tone="muted" />
          <Stat label="Recommended total income" value={fmtMoney(cmp.totalIncome)} tone="gold" />
          <Stat label="Additional income" value={fmtMoney(Math.abs(incomeUplift))} />
          <Stat label="Longevity gap"
            value={
              ex.moneyNeverRunsOut && cmp.moneyNeverRunsOut
                ? "0 yrs"
                : `${Math.max(0, (cmp.moneyNeverRunsOut ? 100 : cmp.ageMoneyLasts) - (ex.moneyNeverRunsOut ? 100 : ex.ageMoneyLasts))} yrs`
            }
            tone="gold" />
        </div>

        {/* Editorial commentary — fills the bottom instead of leaving whitespace */}
        <div className="grid grid-cols-2 gap-8 mt-6 flex-1">
          <div>
            <div className="text-[9px] uppercase tracking-[0.35em] font-semibold mb-2" style={{ color: MUTE }}>Longevity risk · Existing</div>
            <div style={{ ...serif, color: NAVY }} className="text-[15px] font-semibold mb-2">The pattern to watch</div>
            <p className="text-[11px] leading-relaxed" style={{ color: "#334155" }}>
              {ex.moneyNeverRunsOut
                ? <>Under current settings, the balance sustains withdrawals through age 100 with capital remaining. Continued monitoring is recommended as fee drag and market cycles will still influence long-term capacity.</>
                : <>Capital depletes at <b style={{ color: NAVY }}>age {ex.ageMoneyLasts}</b>, exposing {clientName} to longevity risk should life expectancy exceed projections. Without structural change, drawdowns in the mid-70s onward would rely on the age pension or asset drawdown outside super.</>}
            </p>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.35em] font-semibold mb-2" style={{ color: GOLD_DEEP }}>Longevity outlook · Recommended</div>
            <div style={{ ...serif, color: NAVY }} className="text-[15px] font-semibold mb-2">The compounding effect</div>
            <p className="text-[11px] leading-relaxed" style={{ color: "#334155" }}>
              {cmp.moneyNeverRunsOut
                ? <>The recommended portfolio maintains withdrawals through <b style={{ color: NAVY }}>age 100</b> with meaningful capital preserved, providing resilience against longevity risk and flexibility for legacy planning or aged-care funding.</>
                : <>Capital sustains until <b style={{ color: NAVY }}>age {cmp.ageMoneyLasts}</b>, extending funded retirement by {Math.max(0, cmp.ageMoneyLasts - ex.ageMoneyLasts)} additional years compared to the existing arrangement.</>}
            </p>
          </div>
        </div>

        <RunningFooter page={5} total={TOTAL_PAGES} date={today} />
      </Page>

      {/* ═════ 06 · INSURANCE, FEES, NOTES & CLOSE ═════ */}
      <Page>
        <RunningHeader client={clientName} section="Insurance, Fees & Notes" />
        <SectionMark kicker="Protection" title="Insurance Comparison" />

        <table className="w-full border-collapse mb-7">
          <TableHead />
          <tbody>
            <Row label="Provider" existing={data.existingInsurance.provider || "Not stated"} comparison={data.comparisonInsurance.provider || "Not stated"} />
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

        <SectionMark kicker="Advice" title="Fees Summary" />
        <table className="w-full border-collapse mb-7">
          <TableHead />
          <tbody>
            <Row label="Advice / implementation (one-off)" existing="n/a" comparison={fmtMoney(data.fees.adviceFeeFlat)} />
            <Row label="Annual advice fee %" existing="n/a" comparison={fmtPct(data.fees.annualAdvicePct, 2)} />
            <Row label="Annual advice fee cap" existing="n/a" comparison={fmtMoney(data.fees.annualFeeCap)} />
            <Row label="Effective annual advice fee (yr 1)" existing={fmtMoney(exAdvice)} comparison={fmtMoney(cmpAdvice)} highlight />
          </tbody>
        </table>

        {/* Research & Adviser Notes — proper section */}
        <SectionMark kicker="Adviser" title="Research & Notes" />
        <div className="p-5 mb-6" style={{ background: "#F8FAFC", borderLeft: `3px solid ${GOLD}` }}>
          {data.researchNotes ? (
            <p className="text-[11.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "#1E293B" }}>
              {data.researchNotes}
            </p>
          ) : (
            <p className="text-[11px] italic" style={{ color: MUTE }}>
              Adviser research notes will appear here. Add commentary from the client data form to
              record the rationale, product research, and any strategy-specific considerations.
            </p>
          )}
        </div>

        {/* SIGN-OFF */}
        <div className="p-6" style={{ background: NAVY_INK, color: "#F8FAFC", borderTop: `2px solid ${GOLD}` }}>
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="text-[9px] uppercase tracking-[0.35em]" style={{ color: GOLD_SOFT }}>Prepared with care for</div>
              <div style={{ ...serif }} className="text-[22px] mt-1">{clientName}</div>
              <div className="text-[9.5px] mt-2" style={{ color: "#CBD5E1" }}>
                {FIRM.legal} · {FIRM.afsl} · {FIRM.abn}
              </div>
            </div>
            <div className="text-right">
              <img src={logoLight} alt={FIRM.name} style={{ height: 30, width: "auto", marginLeft: "auto" }} />
              <div className="text-[9px] mt-2" style={{ color: "#CBD5E1" }}>{FIRM.phone}</div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 text-[8.5px] leading-relaxed" style={{ color: MUTE }}>
          <p className="mb-1.5">
            <span style={{ color: NAVY, fontWeight: 600 }}>Methodology.</span> Projections use the
            same calculation engine as our Super Health Check: employer SG at 12% (contributions tax 15%),
            2.5% inflation adjustment on withdrawals, and periodic market dip years in accumulation and
            withdrawal phases. Outcomes are illustrative and are not a guarantee of future performance.
          </p>
          <p className="mb-1.5">
            <span style={{ color: NAVY, fontWeight: 600 }}>General Advice Warning.</span> The information
            in this document has been prepared by {FIRM.legal} ({FIRM.afsl}, {FIRM.abn}) and is general in
            nature. It does not take into account your personal objectives, financial situation or needs.
            Before acting on any recommendation, consider its appropriateness to your circumstances and
            read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD).
            Where insurance replacement is recommended, existing cover should not be cancelled until
            replacement cover has been formally accepted by the new insurer.
          </p>
          <p>
            <span style={{ color: NAVY, fontWeight: 600 }}>Confidentiality.</span> This document is
            prepared exclusively for {clientName} and may not be reproduced or distributed without
            written consent from {FIRM.legal}.
          </p>
        </div>

        <RunningFooter page={6} total={TOTAL_PAGES} date={today} />
      </Page>
    </div>
  );
});
