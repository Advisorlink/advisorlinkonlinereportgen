import { cn } from "@/lib/utils";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import logoAsset from "@/assets/settled-and-sound-logo-white.png.asset.json";
const logoUrl = logoAsset.url;

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("report-page", className)}>{children}</div>;
}

export function PageHeader({ pageLabel = "SUPERANNUATION REPORT", flush = false }: { pageLabel?: string; flush?: boolean }) {
  return (
    <header
      className={cn(
        "relative -mx-14 -mt-[16mm] px-14 pt-6 pb-6 text-navy-foreground overflow-hidden",
        flush ? "mb-0" : "mb-6"
      )}
      style={{
        background:
          "linear-gradient(160deg, hsl(215 65% 14%) 0%, hsl(215 60% 18%) 45%, hsl(210 55% 24%) 100%)",
      }}
    >
      <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-cyan/15 blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 rounded-full bg-[hsl(225_85%_60%)]/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-center justify-between gap-4">
        <img
          src={logoUrl}
          alt="Settled & Sound"
          className="h-8 w-auto"
        />
      </div>
    </header>
  );
}

export function PageFooter() {
  return (
    <footer className="mt-auto pt-8 text-center text-[10px] text-muted-foreground">
      Settled &amp; Sound · Superannuation education and financial adviser referrals
    </footer>
  );
}

export function KpiCard({
  label, value, sub, accent = false,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white border border-border px-4 py-3 shadow-card">
      <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className={cn("mt-1 text-2xl tabular-nums", accent ? "text-cyan font-bold" : "text-navy font-extrabold")}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      <div className={cn("mt-2 h-[3px] w-10 rounded-full", accent ? "bg-cyan" : "bg-navy")} />
    </div>
  );
}

export function SectionCard({
  title, icon, children, className,
}: { title?: string; icon?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl bg-white border border-border p-5 shadow-card", className)}>
      {title && (
        <h3 className="flex items-center gap-2 text-base font-bold text-navy mb-3">
          {icon && <span className="text-cyan">{icon}</span>}
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

export function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <div>
      <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan to-[hsl(195_95%_60%)] transition-all"
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      {label && <div className="mt-1 text-xs font-semibold text-navy text-right">{label}</div>}
    </div>
  );
}

// Compact comparison bar (Existing vs Comparison)
export function ComparisonBar({
  label, value, max, displayValue, color = "cyan",
}: { label: string; value: number; max: number; displayValue: string; color?: "navy" | "cyan" }) {
  const pct = max > 0 ? Math.max(0.04, value / max) : 0;
  const fill = color === "navy" ? "bg-navy" : "bg-cyan";
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="h-6 rounded-md bg-secondary overflow-hidden">
        <div className={cn("h-full rounded-md", fill)} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="text-sm text-navy tabular-nums font-semibold">{displayValue}</div>
    </div>
  );
}

// Semi-circle gauge for income sustainability
export function Gauge({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = 70;
  const circ = Math.PI * r; // semicircle
  const offset = circ * (1 - pct);
  return (
    <div className="relative" style={{ width: 180, height: 110 }}>
      <svg viewBox="0 0 180 110" width="180" height="110">
        <path
          d="M 20 100 A 70 70 0 0 1 160 100"
          stroke="hsl(var(--secondary))" strokeWidth="14" fill="none" strokeLinecap="round"
        />
        <path
          d="M 20 100 A 70 70 0 0 1 160 100"
          stroke="hsl(var(--cyan))" strokeWidth="14" fill="none" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
        />
      </svg>
      {label && (
        <div className="absolute inset-x-0 bottom-1 text-center text-sm font-semibold text-navy">
          {label}
        </div>
      )}
    </div>
  );
}

// ---- Charts ----
const fmtAxisMoney = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
};

export function AccumulationChart({
  data, retirementAge, goalBalance,
}: {
  data: { age: number; existing: number; comparison: number }[];
  retirementAge: number;
  goalBalance: number;
}) {
  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="exFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(215 60% 12%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(215 60% 12%)" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="cmpFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(195 95% 50%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(195 95% 50%)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(215 20% 92%)" vertical={false} />
          <XAxis dataKey="age" tick={{ fill: "hsl(215 16% 45%)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "hsl(215 20% 88%)" }} />
          <YAxis tickFormatter={fmtAxisMoney} tick={{ fill: "hsl(215 16% 45%)", fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(v: number) => fmtAxisMoney(v)}
            labelFormatter={(l) => `Age ${l}`}
            contentStyle={{ background: "white", border: "1px solid hsl(215 20% 88%)", borderRadius: 8, fontSize: 11 }}
          />
          <ReferenceLine y={goalBalance} stroke="hsl(45 90% 50%)" strokeDasharray="4 4" label={{ value: "Goal", fill: "hsl(45 70% 35%)", fontSize: 10, position: "right" }} />
          <ReferenceLine x={retirementAge} stroke="hsl(215 16% 65%)" strokeDasharray="2 4" />
          <Area type="monotone" dataKey="existing" stroke="hsl(215 60% 12%)" strokeWidth={2} fill="url(#exFill)" name="Current" />
          <Area type="monotone" dataKey="comparison" stroke="hsl(195 95% 50%)" strokeWidth={2} fill="url(#cmpFill)" name="Comparison" />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WithdrawalChart({
  existing, comparison,
}: {
  existing: { age: number; balance: number }[];
  comparison: { age: number; balance: number }[];
}) {
  // Merge both series by age
  const ages = new Set<number>();
  existing.forEach(r => ages.add(r.age));
  comparison.forEach(r => ages.add(r.age));
  const sorted = Array.from(ages).sort((a, b) => a - b);
  const exMap = new Map(existing.map(r => [r.age, r.balance]));
  const cmpMap = new Map(comparison.map(r => [r.age, r.balance]));
  const data = sorted.map(age => ({
    age,
    existing: exMap.get(age) ?? null,
    comparison: cmpMap.get(age) ?? null,
  }));
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="hsl(215 20% 92%)" vertical={false} />
          <XAxis dataKey="age" tick={{ fill: "hsl(215 16% 45%)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "hsl(215 20% 88%)" }} />
          <YAxis tickFormatter={fmtAxisMoney} tick={{ fill: "hsl(215 16% 45%)", fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(v: number) => fmtAxisMoney(v)}
            labelFormatter={(l) => `Age ${l}`}
            contentStyle={{ background: "white", border: "1px solid hsl(215 20% 88%)", borderRadius: 8, fontSize: 11 }}
          />
          <Line type="monotone" dataKey="existing" stroke="hsl(215 60% 12%)" strokeWidth={2.2} dot={false} name="Current drawdown" />
          <Line type="monotone" dataKey="comparison" stroke="hsl(195 95% 50%)" strokeWidth={2.2} dot={false} name="Comparison drawdown" />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FeeRow({
  label, current, comparison, format = (n: number) => `$${Math.round(n).toLocaleString()}`,
  highlight = false,
}: {
  label: string; current: number; comparison: number;
  format?: (n: number) => string;
  highlight?: boolean;
}) {
  const diff = current - comparison;
  return (
    <div className={cn("grid grid-cols-[1.2fr_1fr_1fr_1fr] items-center gap-3 py-2 border-b border-border last:border-0",
      highlight && "font-bold text-navy")}>
      <div className="text-xs">{label}</div>
      <div className="text-xs tabular-nums text-right">{format(current)}</div>
      <div className="text-xs tabular-nums text-right">{format(comparison)}</div>
      <div className={cn("text-xs tabular-nums text-right font-semibold",
        diff > 0 ? "text-destructive" : diff < 0 ? "text-online" : "text-muted-foreground")}>
        {diff === 0 ? "-" : (diff > 0 ? "+" : "") + format(Math.abs(diff)).replace(/^-/, "")}
      </div>
    </div>
  );
}

export function FeeTableHeader() {
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-3 pb-2 border-b-2 border-navy text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      <div>Fee</div>
      <div className="text-right">Current</div>
      <div className="text-right">Comparison</div>
      <div className="text-right">Difference</div>
    </div>
  );
}

export function StatPill({ label, value, tone = "navy" }: { label: string; value: string; tone?: "navy" | "cyan" | "gold" }) {
  const map = { navy: "bg-navy text-navy-foreground", cyan: "bg-cyan text-cyan-foreground", gold: "bg-[hsl(45_90%_50%)] text-navy" };
  return (
    <div className="flex items-center gap-2">
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase", map[tone])}>{label}</span>
      <span className="text-sm font-semibold text-navy tabular-nums">{value}</span>
    </div>
  );
}

export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4 text-[10px] leading-relaxed text-muted-foreground shadow-card">
      <div className="font-bold text-navy uppercase tracking-wider text-[10px] mb-1.5">Important · General advice only</div>
      {children}
    </div>
  );
}
