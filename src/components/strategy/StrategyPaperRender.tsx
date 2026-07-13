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
import logoLightAsset from "@/assets/finance-direct-logo-v2.png.asset.json";
const logoUrl = logoLightAsset.url;
// Aspect ratio of the source PNG: 1600 x 544 => ~2.94:1
const LOGO_ASPECT = 2.94;

// Renders the transparent Finance Direct logo tinted to any solid color via CSS mask.
function GoldLogo({ height, color }: { height: number; color: string }) {
  return (
    <div
      aria-label="Finance Direct"
      style={{
        height,
        width: height * LOGO_ASPECT,
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

/* Brand palette, deep navy + warm yellow gold */
const NAVY = "#0A1F4D";
const NAVY_DEEP = "#050F2E";
const NAVY_INK = "#081733";
const GOLD = "#E8B840";        // primary yellow-gold
const GOLD_SOFT = "#F5D26A";   // light yellow-gold
const GOLD_DEEP = "#B8891E";   // darker warm gold (for text on light)
const INK = "#0F172A";
const MUTE = "#64748B";
const RULE = "#E2E8F0";
const EXISTING = "#94A3B8";
const COMPARISON = "#E8B840";

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

/* Refined section header */
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
          background: highlight ? "rgba(232,184,64,0.10)" : "rgba(11,27,59,0.02)",
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

/* ── AdvisorLink-style primitives ── */

// Dark navy band across the top of interior pages with a bigger left-aligned logo.
// The decorative gold "bubble" sits below the band as a soft background element on the page.
function TopBand() {
  return (
    <div className="relative w-full" style={{ background: NAVY_DEEP, height: "24mm" }}>
      <div className="absolute inset-0 flex items-center" style={{ padding: "0 16mm" }}>
        <GoldLogo height={44} color={GOLD} />
      </div>
      {/* thin gold underline */}
      <div className="absolute left-0 right-0" style={{ bottom: 0, height: 2, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT}, transparent)` }} />
    </div>
  );
}

// Big soft gold bubble that lives in the page background (not the header)
function BackgroundBubble() {
  return (
    <div aria-hidden className="absolute pointer-events-none" style={{
      right: "-40mm", top: "60mm", width: "160mm", height: "160mm", borderRadius: "50%",
      background: `radial-gradient(circle at 35% 35%, ${GOLD_SOFT} 0%, ${GOLD} 45%, transparent 72%)`,
      opacity: 0.10, filter: "blur(2px)", zIndex: 0,
    }} />
  );
}

// Page hero: title + subtitle (like "Executive snapshot / Personal details…")
function PageHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 style={{ ...serif, color: NAVY, letterSpacing: "-0.02em" }} className="text-[30px] font-semibold leading-[1.05]">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[11.5px] leading-relaxed mt-2 max-w-[170mm]" style={{ color: "#475569" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// Rounded card container
function Card({ children, className = "", style, tone = "light" }:
  { children: React.ReactNode; className?: string; style?: React.CSSProperties; tone?: "light" | "gold" | "navy" }) {
  const bg = tone === "gold" ? "rgba(232,184,64,0.08)" : tone === "navy" ? NAVY_DEEP : "#FFFFFF";
  const border = tone === "gold" ? "rgba(232,184,64,0.35)" : tone === "navy" ? NAVY_DEEP : RULE;
  return (
    <div className={className} style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 16px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// Small stat pill (label / value / underline / sub), aligned via fixed row heights
function MiniStat({ label, value, sub, accent = "navy" }:
  { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: "navy" | "gold" | "white" }) {
  const color = accent === "gold" ? GOLD_DEEP : accent === "white" ? "#FFFFFF" : NAVY;
  const underline = accent === "gold" ? GOLD : accent === "white" ? GOLD : NAVY;
  const labelColor = accent === "white" ? "rgba(255,255,255,0.7)" : MUTE;
  const subColor = accent === "white" ? "rgba(255,255,255,0.75)" : MUTE;
  return (
    <div className="flex flex-col" style={{ minHeight: 78 }}>
      <div className="text-[8.5px] uppercase tracking-[0.28em] font-semibold" style={{ color: labelColor, minHeight: 22, lineHeight: "11px" }}>{label}</div>
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 22, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", minHeight: 22 }}>
        {value}
      </div>
      <div style={{ height: 2, width: 22, background: underline, marginTop: 6, borderRadius: 2, opacity: 0.7 }} />
      <div className="text-[9.5px] mt-1.5" style={{ color: subColor, minHeight: 12 }}>{sub || "\u00A0"}</div>
    </div>
  );
}

// Card heading with diamond/dot bullet
function CardTitle({ children, icon = "diamond", onDark }: { children: React.ReactNode; icon?: "diamond" | "dot" | "plus" | "check"; onDark?: boolean }) {
  const glyph = icon === "diamond" ? "◆" : icon === "plus" ? "✦" : icon === "check" ? "✓" : "●";
  return (
    <div className="flex items-center gap-2 mb-3">
      <span style={{ color: GOLD, fontSize: 12 }}>{glyph}</span>
      <span style={{ ...serif, color: onDark ? "#FFFFFF" : NAVY, fontSize: 15, fontWeight: 600 }}>{children}</span>
    </div>
  );
}

// Row inside a card: label left, value right, thin bottom rule
function KVRow({ label, value, last }: { label: React.ReactNode; value: React.ReactNode; last?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: last ? "none" : `1px solid ${RULE}` }}>
      <div className="text-[10.5px]" style={{ color: MUTE }}>{label}</div>
      <div className="text-[11px] font-semibold text-right" style={{ color: NAVY }}>{value}</div>
    </div>
  );
}

// Gold progress bar
function ProgressBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ background: "#E7ECF3", borderRadius: 999, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${p}%`, height: "100%", background: `linear-gradient(90deg, ${GOLD_DEEP}, ${GOLD})`, borderRadius: 999 }} />
    </div>
  );
}

function Stat({ label, value, sub, tone = "navy" }:
  { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "navy" | "gold" | "muted" }) {
  const color = tone === "gold" ? GOLD_DEEP : tone === "muted" ? "#334155" : NAVY;
  return (
    <div className="flex flex-col">
      <div
        className="text-[9px] uppercase tracking-[0.25em] font-semibold whitespace-nowrap overflow-hidden text-ellipsis"
        style={{ color: MUTE, minHeight: 24, lineHeight: "12px" }}
        title={label}
      >
        {label}
      </div>
      <div
        className="text-[24px] font-semibold leading-none tabular-nums"
        style={{ ...serif, color, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] mt-1 tabular-nums" style={{ color: MUTE, fontVariantNumeric: "tabular-nums" }}>{sub}</div>}
    </div>
  );
}

/* Refined note, minimal, editorial. */
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
  const TOTAL_PAGES = 7;

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

          {/* HEADER, horizontal logo, no white box */}
          <div className="flex items-start justify-between">
            <GoldLogo height={44} color={GOLD} />
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

      {/* ═════ 02 · ABOUT, WHAT TO EXPECT & FIRM DETAILS ═════ */}
      <Page bleed>
        <TopBand />
        <div style={{ padding: "10mm 16mm 6mm 16mm", display: "flex", flexDirection: "column", minHeight: "calc(297mm - 24mm)" }}>
          <PageHero
            title="About this document"
            subtitle="A summary of what you will find in the pages ahead, how to read it, and the firm behind the advice."
          />

          {/* What to expect */}
          <Card className="mb-5">
            <CardTitle icon="plus">What to expect</CardTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                { n: "01", t: "Executive snapshot", d: "Your personal details, targets and where your super sits today." },
                { n: "02", t: "Your position and the impact of advice", d: "Current fund settings alongside the recommended strategy and fees." },
                { n: "03", t: "Projection to retirement", d: "Year by year balance projection with realistic market corrections built in." },
                { n: "04", t: "Retirement income view", d: "How long your money potentially lasts once you begin drawing an income." },
                { n: "05", t: "Insurance comparison", d: "Existing cover benchmarked against a recommended replacement." },
                { n: "06", t: "Fees and adviser notes", d: "Full fee breakdown and the reasoning behind each recommendation." },
              ].map((s) => (
                <div key={s.n} className="flex gap-3">
                  <div style={{ ...serif, color: GOLD_DEEP, fontSize: 18, fontWeight: 700, lineHeight: 1, minWidth: 26 }}>{s.n}</div>
                  <div>
                    <div className="text-[11.5px] font-semibold" style={{ color: NAVY }}>{s.t}</div>
                    <div className="text-[10.5px] leading-relaxed" style={{ color: "#475569" }}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Firm details */}
          <Card tone="navy" className="mb-5">
            <CardTitle icon="diamond" onDark>About Finance Direct</CardTitle>
            <p className="text-[11px] leading-relaxed mb-4" style={{ color: "#E2E8F0" }}>
              Finance Direct is a private wealth advisory firm helping Australians plan for retirement,
              protect their families and grow their superannuation with confidence. Every strategy paper
              is prepared by a qualified adviser using our own model portfolio research.
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {[
                ["Legal entity", FIRM.legal],
                ["AFSL", FIRM.afsl.replace(/^AFSL\s*/, "")],
                ["ABN", FIRM.abn.replace(/^ABN\s*/, "")],
                ["Phone", FIRM.phone],
                ["Email", FIRM.email],
                ["Website", FIRM.web],
                ["Address", FIRM.address],
                ["Document reference", refNo],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                  <div className="text-[9.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: GOLD_SOFT }}>{l}</div>
                  <div className="text-[10.5px] text-right" style={{ color: "#F8FAFC", fontVariantNumeric: "tabular-nums" }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Important information / disclaimer intro */}
          <Card className="flex-1">
            <CardTitle icon="check">Important information</CardTitle>
            <div className="text-[10.5px] leading-relaxed space-y-2" style={{ color: "#334155" }}>
              <p>
                <b style={{ color: NAVY }}>General advice warning.</b> The information in this document
                has been prepared by {FIRM.legal} ({FIRM.afsl}, {FIRM.abn}) and is general in nature.
                It does not take into account your personal objectives, financial situation or needs.
                Before acting on any recommendation, consider its appropriateness to your circumstances
                and read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD).
              </p>
              <p>
                <b style={{ color: NAVY }}>Projections.</b> All figures are illustrative and assume
                consistent contributions, a 2.5% inflation adjustment and periodic market corrections.
                Past performance is not a reliable indicator of future performance.
              </p>
              <p>
                <b style={{ color: NAVY }}>Insurance.</b> Where a replacement is recommended, your
                existing cover should not be cancelled until new cover has been formally accepted by
                the incoming insurer.
              </p>
              <p>
                <b style={{ color: NAVY }}>Confidentiality.</b> This document has been prepared
                exclusively for {clientName} and may not be reproduced or distributed without written
                consent from {FIRM.legal}.
              </p>
            </div>
          </Card>

          <RunningFooter page={2} total={TOTAL_PAGES} date={today} />
        </div>
      </Page>

      {/* ═════ 03 · EXECUTIVE SNAPSHOT ═════ */}
      <Page bleed>
        <TopBand />
        <div style={{ padding: "10mm 16mm 6mm 16mm", display: "flex", flexDirection: "column", minHeight: "calc(297mm - 22mm)" }}>
          <PageHero
            title="Executive snapshot"
            subtitle="Personal details, targets and the current super position at a glance."
          />

          {/* Top row: 4 pill cards */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <Card><MiniStat label="Age" value={age} sub="Current age" /></Card>
            <Card><MiniStat label="Target retirement" value={data.retirementAge} sub="Desired age" /></Card>
            <Card><MiniStat label="Years remaining" value={yearsToRet} sub="Until retirement" /></Card>
            <Card><MiniStat label="Target balance" value={fmtMoney(data.goalBalance)} accent="gold" sub="Reference target" /></Card>
          </div>

          {/* Client profile / Targets */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Card>
              <CardTitle icon="dot">Client profile</CardTitle>
              <KVRow label="Name" value={clientName} />
              <KVRow label="Annual income" value={fmtMoney(data.annualIncome)} />
              <KVRow label="Employer SG (12% × 0.85)" value={fmtMoney(sgNet)} />
              <KVRow label="Personal contribution" value={`${fmtMoney(data.personalContributionAmount)} ${data.personalContributionFrequency.toLowerCase()}`} />
              <KVRow label="Desired retirement income" value={`${fmtMoney(data.desiredIncomeAmount)} ${data.desiredIncomeFrequency.toLowerCase()}`} last />
            </Card>
            <Card>
              <CardTitle>Targets</CardTitle>
              <KVRow label="Retirement age target" value={data.retirementAge} />
              <KVRow label="Reference balance target" value={fmtMoney(data.goalBalance)} />
              <KVRow label="Projected balance at retirement" value={fmtMoney(cmp.projectedBalance)} />
              <div className="py-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10.5px]" style={{ color: MUTE }}>Target progress</div>
                  <div className="text-[11px] font-semibold" style={{ color: GOLD_DEEP }}>
                    {data.goalBalance > 0 ? `${((cmp.projectedBalance / data.goalBalance) * 100).toFixed(1)}%` : "-"}
                  </div>
                </div>
                <ProgressBar pct={data.goalBalance > 0 ? (cmp.projectedBalance / data.goalBalance) * 100 : 0} />
                <div className="text-[9.5px] mt-1.5 text-right" style={{ color: MUTE }}>
                  {data.goalBalance > 0 ? `${((cmp.projectedBalance / data.goalBalance) * 100).toFixed(1)}% of target` : ""}
                </div>
              </div>
            </Card>
          </div>

          {/* Position summary */}
          <Card className="mb-5">
            <CardTitle icon="plus">Position summary</CardTitle>
            <p className="text-[11px] leading-relaxed" style={{ color: "#334155" }}>
              Based on {clientName}&apos;s current balance of <b style={{ color: NAVY }}>{fmtMoney(data.existing.superBalance)}</b>,
              continued contributions of <b style={{ color: NAVY }}>{fmtMoney(sgNet + data.personalContributionAmount * (data.personalContributionFrequency === "Monthly" ? 12 : data.personalContributionFrequency === "Weekly" ? 52 : 1))}</b> per year
              and the existing fund&apos;s net return, the projected balance at age {data.retirementAge} is{" "}
              <b style={{ color: NAVY }}>{fmtMoney(ex.projectedBalance)}</b>. The reference target of {fmtMoney(data.goalBalance)} is included for context only.
            </p>
          </Card>

          {/* Selected projection years table */}
          <Card>
            <CardTitle icon="dot">Selected projection years</CardTitle>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="py-2 text-left text-[9px] uppercase tracking-[0.25em] font-semibold border-b" style={{ color: MUTE, borderColor: RULE }}>Age</th>
                  <th className="py-2 text-left text-[9px] uppercase tracking-[0.25em] font-semibold border-b" style={{ color: MUTE, borderColor: RULE }}>Year</th>
                  <th className="py-2 text-right text-[9px] uppercase tracking-[0.25em] font-semibold border-b" style={{ color: MUTE, borderColor: RULE }}>Current</th>
                  <th className="py-2 text-right text-[9px] uppercase tracking-[0.25em] font-semibold border-b" style={{ color: GOLD_DEEP, borderColor: RULE }}>Comparison</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const total = accSeries.length;
                  if (total === 0) return null;
                  const picks = Array.from(new Set([0, Math.floor(total * 0.25), Math.floor(total * 0.4), Math.floor(total * 0.6), Math.floor(total * 0.8), total - 1])).filter(i => i >= 0 && i < total);
                  const thisYear = new Date().getFullYear();
                  return picks.map((i) => {
                    const r = accSeries[i];
                    return (
                      <tr key={r.age}>
                        <td className="py-2 text-[11px] font-semibold border-b" style={{ color: NAVY, borderColor: "#F1F5F9" }}>{r.age}</td>
                        <td className="py-2 text-[11px] border-b" style={{ color: MUTE, borderColor: "#F1F5F9" }}>{thisYear + (r.age - age)}</td>
                        <td className="py-2 text-[11px] text-right border-b" style={{ color: NAVY, borderColor: "#F1F5F9" }}>{fmtMoney(r.Existing)}</td>
                        <td className="py-2 text-[11px] text-right font-semibold border-b" style={{ color: GOLD_DEEP, borderColor: "#F1F5F9" }}>{fmtMoney(r.Recommended)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </Card>

          <RunningFooter page={3} total={TOTAL_PAGES} date={today} />
        </div>
      </Page>

      {/* ═════ 03 · YOUR POSITION & IMPACT OF ADVICE ═════ */}
      <Page bleed>
        <TopBand />
        <div style={{ padding: "10mm 16mm 6mm 16mm", display: "flex", flexDirection: "column", minHeight: "calc(297mm - 22mm)" }}>
          <PageHero
            title="Your current position & the impact of advice"
            subtitle="Your existing fund settings alongside the projected impact of the recommended strategy."
          />

          <div className="grid grid-cols-2 gap-4 mb-5">
            <Card>
              <CardTitle>Current fund</CardTitle>
              <KVRow label="Fund name" value={data.existing.fundName || "Not stated"} />
              <KVRow label="Investment option" value={data.existing.modelLabel} />
              <KVRow label="Risk profile" value={data.existing.riskProfile} />
              <KVRow label="5-year net return" value={fmtPct(data.existing.fiveYearReturn, 2)} />
              <KVRow label="Admin fee, flat" value={fmtMoney(data.existing.adminFeeFlat)} />
              <KVRow label="Admin fee, % of balance" value={fmtPct(data.existing.adminFeePct, 2)} last />
              <div className="mt-4 p-3" style={{ background: "#F8FAFC", borderRadius: 8 }}>
                <div className="text-[8.5px] uppercase tracking-[0.28em] font-semibold" style={{ color: MUTE }}>
                  Projected at age {data.retirementAge}
                </div>
                <div className="mt-1" style={{ ...serif, color: NAVY, fontSize: 22, fontWeight: 600 }}>{fmtMoney(ex.projectedBalance)}</div>
                <div className="text-[9.5px] mt-1 italic" style={{ color: MUTE }}>after fees and market corrections</div>
              </div>
            </Card>

            <Card tone="navy">
              <CardTitle icon="dot" onDark>With financial advice</CardTitle>
              <div className="text-[10px] uppercase tracking-[0.28em] font-semibold" style={{ color: GOLD_SOFT }}>Potential improvement</div>
              <div className="mt-1 mb-3" style={{ ...serif, color: "#FFFFFF", fontSize: 18, fontWeight: 600 }}>
                +{((data.comparison.fiveYearReturn - data.existing.fiveYearReturn) * 100).toFixed(2)}% p.a. on current trajectory
              </div>
              <div className="text-[10px] uppercase tracking-[0.28em] font-semibold" style={{ color: GOLD_SOFT }}>How</div>
              <div className="mt-1 mb-3 text-[11px]" style={{ color: "#F1F5F9" }}>
                Reallocate from {data.existing.modelLabel} to {data.comparison.modelLabel}, and switch to {data.comparison.fundName || "the firm model portfolio"}.
              </div>
              <div className="text-[10px] uppercase tracking-[0.28em] font-semibold" style={{ color: GOLD_SOFT }}>One-off advice fee</div>
              <div className="mt-1 mb-3 text-[11px]" style={{ color: "#F1F5F9" }}>
                <b style={{ color: "#FFFFFF" }}>{fmtMoney(data.fees.adviceFeeFlat)}</b>, once off payment from super
              </div>
              <div className="text-[10px] uppercase tracking-[0.28em] font-semibold" style={{ color: GOLD_SOFT }}>Ongoing advisory fee</div>
              <div className="mt-1 mb-3 text-[11px]" style={{ color: "#F1F5F9" }}>
                <b style={{ color: "#FFFFFF" }}>{fmtPct(data.fees.annualAdvicePct, 2)} p.a.</b>, capped at {fmtMoney(data.fees.annualFeeCap)}
              </div>
              <div className="mt-4 p-3" style={{ background: "rgba(232,184,64,0.15)", border: `1px solid ${GOLD}`, borderRadius: 8 }}>
                <div className="text-[8.5px] uppercase tracking-[0.28em] font-semibold" style={{ color: GOLD_SOFT }}>
                  Recommended · Projected at age {data.retirementAge}
                </div>
                <div className="mt-1" style={{ ...serif, color: GOLD_SOFT, fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(cmp.projectedBalance)}</div>
                <div className="text-[9.5px] mt-1 italic" style={{ color: "rgba(255,255,255,0.7)" }}>after fees and market corrections</div>
              </div>
            </Card>
          </div>

          <Card>
            <CardTitle icon="plus">Risk profile band</CardTitle>
            <div className="grid grid-cols-5 gap-2">
              {["Conservative", "Moderate", "Balanced", "Growth", "High Growth"].map((label) => {
                const active = label.toLowerCase() === data.comparison.riskProfile.toLowerCase();
                return (
                  <div key={label} className="text-center py-3 text-[11px] font-semibold" style={{
                    borderRadius: 8,
                    border: `1px solid ${active ? NAVY : RULE}`,
                    background: active ? NAVY : "#FFFFFF",
                    color: active ? "#F8FAFC" : MUTE,
                  }}>
                    {label}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] mt-3" style={{ color: MUTE }}>
              Profile is determined by the growth assets mix of the recommended investment option. Comparison gross returns are illustrative tiered figures.
            </p>
          </Card>

          <div className="mt-5 flex-1">
            <Note label="Observation">
              {data.aiObservation ? (
                <span>{data.aiObservation}</span>
              ) : (
                <>The recommended portfolio delivers a{" "}
                <b style={{ color: NAVY }}>{((data.comparison.fiveYearReturn - data.existing.fiveYearReturn) * 100).toFixed(2)}%</b>{" "}
                higher 5-year average return with an admin fee differential of{" "}
                <b style={{ color: NAVY }}>{((data.comparison.adminFeePct - data.existing.adminFeePct) * 100).toFixed(2)}%</b>.</>
              )}
            </Note>
          </div>

          <RunningFooter page={4} total={TOTAL_PAGES} date={today} />
        </div>
      </Page>

      {/* ═════ 04 · PROJECTION TO RETIREMENT ═════ */}
      <Page bleed>
        <TopBand />
        <div style={{ padding: "10mm 16mm 6mm 16mm", display: "flex", flexDirection: "column", minHeight: "calc(297mm - 22mm)" }}>
          <PageHero
            title="Projection to retirement"
            subtitle="Year-by-year projection of the current fund versus the comparison scenario, including periodic market dips."
          />

          {/* Dark returns strip */}
          <div className="flex items-center justify-between px-4 py-3 mb-4" style={{ background: NAVY_DEEP, borderRadius: 8, color: "#F8FAFC" }}>
            <div className="text-[9.5px] uppercase tracking-[0.3em] font-semibold" style={{ color: GOLD_SOFT }}>
              5 year return (p.a.)
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-[0.25em]" style={{ color: "#CBD5E1" }}>Current</span>
                <span className="text-[13px] font-semibold" style={{ color: "#F8FAFC" }}>{fmtPct(data.existing.fiveYearReturn, 2)}</span>
              </div>
              <div style={{ width: 1, height: 16, background: "rgba(232,184,64,0.6)" }} />
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-[0.25em]" style={{ color: GOLD_SOFT }}>Comparison</span>
                <span className="text-[13px] font-semibold" style={{ color: GOLD_SOFT }}>{fmtPct(data.comparison.fiveYearReturn, 2)}</span>
              </div>
            </div>
          </div>

          <div className="p-3 mb-4 text-[10.5px] leading-relaxed" style={{ background: "rgba(232,184,64,0.08)", borderRadius: 8, color: "#334155" }}>
            <b style={{ color: NAVY }}>Illustration only:</b> the comparison figures below show what the recommended
            strategy could mean for balance at retirement, keeping the same risk profile and contribution pattern.
            Past performance is not indicative of future performance.
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card><MiniStat label="Current balance" value={fmtMoney(data.existing.superBalance)} sub="Today" /></Card>
            <Card><MiniStat label="Projected · Current" value={fmtMoney(ex.projectedBalance)} sub={`At age ${data.retirementAge}`} /></Card>
            <Card><MiniStat label="Projected · Comparison" value={fmtMoney(cmp.projectedBalance)} accent="gold" sub={`At age ${data.retirementAge}`} /></Card>
          </div>

          <Card className="mb-4">
            <CardTitle>Balance projection</CardTitle>
            <div style={{ height: 220 }}>
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
                  <Area type="monotone" dataKey="Existing" stroke={EXISTING} strokeWidth={2} fill="url(#gExisting)" name="Current" />
                  <Area type="monotone" dataKey="Recommended" stroke={GOLD} strokeWidth={2.5} fill="url(#gRec)" name="Comparison" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center mt-2">
              <div className="px-6 py-3 text-center" style={{ background: "rgba(232,184,64,0.10)", borderRadius: 8 }}>
                <div className="text-[9.5px] uppercase tracking-[0.3em] font-semibold" style={{ color: MUTE }}>
                  After fees and market corrections
                </div>
                <div className="text-[10.5px] mt-2" style={{ color: MUTE }}>Potential uplift</div>
                <div style={{ ...serif, color: GOLD_DEEP, fontSize: 26, fontWeight: 600 }}>
                  {fmtMoney(Math.abs(uplift))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Projection assumptions</CardTitle>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3" style={{ background: "#F8FAFC", borderRadius: 8 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div style={{ width: 20, height: 20, borderRadius: 999, background: "rgba(232,184,64,0.18)", color: GOLD_DEEP, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>%</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: NAVY }}>Inflation</div>
                </div>
                <div className="text-[10.5px] leading-relaxed" style={{ color: "#334155" }}>
                  Set at <b>2.5% p.a.</b> for the rising cost of living. Results shown in today&apos;s dollars.
                </div>
              </div>
              <div className="p-3" style={{ background: "#F8FAFC", borderRadius: 8 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div style={{ width: 20, height: 20, borderRadius: 999, background: "rgba(232,184,64,0.18)", color: GOLD_DEEP, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>↗</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: NAVY }}>Performance</div>
                </div>
                <div className="text-[10.5px] leading-relaxed" style={{ color: "#334155" }}>
                  Employer contributions, rates of return and fees are assumed to remain <b>consistent</b> across the projection.
                </div>
              </div>
              <div className="p-3" style={{ background: "#F8FAFC", borderRadius: 8 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div style={{ width: 20, height: 20, borderRadius: 999, background: "rgba(232,184,64,0.18)", color: GOLD_DEEP, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>!</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: NAVY }}>Market crash</div>
                </div>
                <div className="text-[10.5px] leading-relaxed" style={{ color: "#334155" }}>
                  A <b>10% loss every 7 years</b> is factored in to account for periodic market corrections.
                </div>
              </div>
            </div>
          </Card>

          <RunningFooter page={5} total={TOTAL_PAGES} date={today} />
        </div>
      </Page>

      {/* ═════ 05 · RETIREMENT INCOME VIEW ═════ */}
      <Page bleed>
        <TopBand />
        <div style={{ padding: "10mm 16mm 6mm 16mm", display: "flex", flexDirection: "column", minHeight: "calc(297mm - 22mm)" }}>
          <PageHero
            title="Retirement income view"
            subtitle="How long will your money potentially last when you need it most?"
          />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card><MiniStat label="Starting balance" value={fmtMoney(cmp.projectedBalance)} sub={`Projected at retirement (age ${data.retirementAge})`} /></Card>
            <Card><MiniStat label="Annual withdrawal" value={fmtMoney(data.desiredIncomeAmount * (data.desiredIncomeFrequency === "Weekly" ? 52 : data.desiredIncomeFrequency === "Monthly" ? 12 : 1))} accent="gold" sub="Desired annual income" /></Card>
          </div>

          <Card className="mb-4">
            <CardTitle>Drawdown projection</CardTitle>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={wdSeries} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="age" stroke={MUTE} tick={{ fontSize: 10 }} />
                  <YAxis stroke={MUTE} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} labelFormatter={(l) => `Age ${l}`} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
                  <Line type="monotone" dataKey="Existing" stroke={EXISTING} strokeWidth={2} dot={false} name="Current drawdown" />
                  <Line type="monotone" dataKey="Recommended" stroke={GOLD} strokeWidth={2.5} dot={false} name="Comparison drawdown" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card tone="navy">
              <CardTitle icon="dot" onDark>Income sustainability, current</CardTitle>
              <div className="text-[9px] uppercase tracking-[0.28em] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Money lasts to age</div>
              <div className="mt-2" style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#FFFFFF", fontSize: 34, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                {ex.moneyNeverRunsOut ? "100+" : ex.ageMoneyLasts}
              </div>
              <div className="text-[10.5px] mt-1" style={{ color: GOLD_SOFT, fontWeight: 600 }}>
                {ex.moneyNeverRunsOut ? "Fully funded" : `${Math.max(0, ex.ageMoneyLasts - data.retirementAge)} years of income`}
              </div>
            </Card>
            <Card tone="navy">
              <CardTitle icon="dot" onDark>Income sustainability, comparison</CardTitle>
              <div className="text-[9px] uppercase tracking-[0.28em] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Money lasts to age</div>
              <div className="mt-2" style={{ fontFamily: "'Inter', system-ui, sans-serif", color: GOLD_SOFT, fontSize: 34, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                {cmp.moneyNeverRunsOut ? "100+" : cmp.ageMoneyLasts}
              </div>
              <div className="text-[10.5px] mt-1" style={{ color: GOLD_SOFT, fontWeight: 600 }}>
                {cmp.moneyNeverRunsOut ? "Fully funded" : `${Math.max(0, cmp.ageMoneyLasts - data.retirementAge)} years of income`}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card tone="navy">
              <div className="text-[9px] uppercase tracking-[0.28em] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Additional retirement income</div>
              <div className="mt-2" style={{ fontFamily: "'Inter', system-ui, sans-serif", color: GOLD_SOFT, fontSize: 26, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                +{fmtMoney(Math.abs(incomeUplift))}
              </div>
              <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>Extra income provided over retirement</div>
            </Card>
            <Card tone="navy">
              <div className="text-[9px] uppercase tracking-[0.28em] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Additional years of income</div>
              <div className="mt-2" style={{ fontFamily: "'Inter', system-ui, sans-serif", color: GOLD_SOFT, fontSize: 26, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                +{Math.max(0, (cmp.moneyNeverRunsOut ? 100 : cmp.ageMoneyLasts) - (ex.moneyNeverRunsOut ? 100 : ex.ageMoneyLasts))} yrs
              </div>
              <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>Longer your money lasts</div>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1">
            <div>
              <div className="text-[9px] uppercase tracking-[0.35em] font-semibold mb-2" style={{ color: MUTE }}>Longevity risk · Existing</div>
              <div style={{ ...serif, color: NAVY }} className="text-[14px] font-semibold mb-2">The pattern to watch</div>
              <p className="text-[11px] leading-relaxed" style={{ color: "#334155" }}>
                {data.aiPatternExisting ? (
                  data.aiPatternExisting
                ) : ex.moneyNeverRunsOut
                  ? <>Under current settings, the balance sustains withdrawals through age 100 with capital remaining. Continued monitoring is recommended as fee drag and market cycles will still influence long-term capacity.</>
                  : <>Capital depletes at <b style={{ color: NAVY }}>age {ex.ageMoneyLasts}</b>, exposing {clientName} to longevity risk should life expectancy exceed projections.</>}
              </p>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.35em] font-semibold mb-2" style={{ color: GOLD_DEEP }}>Longevity outlook · Recommended</div>
              <div style={{ ...serif, color: NAVY }} className="text-[14px] font-semibold mb-2">The compounding effect</div>
              <p className="text-[11px] leading-relaxed" style={{ color: "#334155" }}>
                {data.aiCompoundingRecommended ? (
                  data.aiCompoundingRecommended
                ) : cmp.moneyNeverRunsOut
                  ? <>The recommended portfolio maintains withdrawals through <b style={{ color: NAVY }}>age 100</b> with meaningful capital preserved, providing resilience against longevity risk.</>
                  : <>Capital sustains until <b style={{ color: NAVY }}>age {cmp.ageMoneyLasts}</b>, extending funded retirement by {Math.max(0, cmp.ageMoneyLasts - ex.ageMoneyLasts)} additional years compared to the existing arrangement.</>}
              </p>
            </div>
          </div>

          <RunningFooter page={6} total={TOTAL_PAGES} date={today} />
        </div>
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

        {/* Research & Adviser Notes, proper section */}
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
              <div style={{ display: "flex", justifyContent: "flex-end" }}><GoldLogo height={28} color={GOLD_SOFT} /></div>
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

        <RunningFooter page={7} total={TOTAL_PAGES} date={today} />
      </Page>
    </div>
  );
});
