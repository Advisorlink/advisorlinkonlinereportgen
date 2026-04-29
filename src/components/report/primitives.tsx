import { cn } from "@/lib/utils";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("report-page", className)}>{children}</div>;
}

export function PageHeader({ pageLabel = "SUPER HEALTH CHECK" }: { pageLabel?: string }) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-md bg-navy text-navy-foreground text-[10px] font-bold tracking-wide">
          Advisor Link
        </span>
        <span className="text-[10px] font-bold text-online tracking-wider">● ONLINE</span>
      </div>
      <span className="px-3 py-1 rounded-md border border-navy/15 bg-white text-navy text-[10px] font-bold tracking-wider">
        {pageLabel}
      </span>
    </header>
  );
}

export function PageFooter() {
  return (
    <footer className="mt-auto pt-8 text-center text-[10px] text-muted-foreground">
      Advisor Link Online · Superannuation education and financial adviser referrals
    </footer>
  );
}

export function KpiCard({
  label, value, sub, accent = false,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white border border-border px-4 py-3 shadow-card">
      <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className={cn("mt-1 text-2xl font-extrabold tabular-nums", accent ? "text-cyan" : "text-navy")}>
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
      <div className="text-sm font-bold text-navy tabular-nums">{displayValue}</div>
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
        <div className="absolute inset-x-0 bottom-1 text-center text-sm font-bold text-navy">
          {label}
        </div>
      )}
    </div>
  );
}
