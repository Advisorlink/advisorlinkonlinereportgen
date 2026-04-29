import { useState } from "react";
import type { ClientInputs, IncomeFrequency } from "@/lib/calc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClientForm({ value, onChange }: { value: ClientInputs; onChange: (v: ClientInputs) => void }) {
  const set = <K extends keyof ClientInputs>(k: K, v: ClientInputs[K]) => onChange({ ...value, [k]: v });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card">
      <button
        className="flex w-full items-center justify-between text-left mb-3"
        onClick={() => setCollapsed(c => !c)}
      >
        <h3 className="text-lg font-bold text-navy">Client inputs</h3>
        <span className="text-xs text-muted-foreground">{collapsed ? "Show ▾" : "Hide ▴"}</span>
      </button>
      {!collapsed && (
        <div className="space-y-5">
          <Group title="Personal">
            <Field label="Client name"><Input value={value.clientName} onChange={e => set("clientName", e.target.value)} /></Field>
            <Field label="Age"><NumInput v={value.age} on={n => set("age", n)} /></Field>
            <Field label="Retirement age"><NumInput v={value.retirementAge} on={n => set("retirementAge", n)} /></Field>
            <Field label="Annual income"><NumInput v={value.annualIncome} on={n => set("annualIncome", n)} /></Field>
            <Field label="Goal balance"><NumInput v={value.goalBalance} on={n => set("goalBalance", n)} /></Field>
          </Group>
          <Group title="Desired retirement income">
            <Field label="Amount"><NumInput v={value.desiredIncomeAmount} on={n => set("desiredIncomeAmount", n)} /></Field>
            <Field label="Frequency">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={value.desiredIncomeFrequency}
                onChange={e => set("desiredIncomeFrequency", e.target.value as IncomeFrequency)}
              >
                <option>Weekly</option><option>Monthly</option><option>Annually</option>
              </select>
            </Field>
          </Group>
          <Group title="Existing super">
            <Field label="Fund name"><Input value={value.fundName} onChange={e => set("fundName", e.target.value)} /></Field>
            <Field label="Investment option"><Input value={value.modelLabel} onChange={e => set("modelLabel", e.target.value)} /></Field>
            <Field label="Super balance"><NumInput v={value.superBalance} on={n => set("superBalance", n)} /></Field>
            <Field label="Growth assets %"><PctInput v={value.growthAssetsPct} on={n => set("growthAssetsPct", n)} /></Field>
            <Field label="Gross return %"><PctInput v={value.grossReturn} on={n => set("grossReturn", n)} /></Field>
            <Field label="Admin fee — flat $"><NumInput v={value.adminFeeFlat} on={n => set("adminFeeFlat", n)} /></Field>
            <Field label="Admin fee — %"><PctInput v={value.adminFeePct} on={n => set("adminFeePct", n)} /></Field>
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function NumInput({ v, on }: { v: number; on: (n: number) => void }) {
  return <Input type="number" value={Number.isFinite(v) ? v : 0} onChange={e => on(parseFloat(e.target.value) || 0)} />;
}
function PctInput({ v, on }: { v: number; on: (n: number) => void }) {
  return (
    <div className="relative">
      <Input
        type="number" step="0.1"
        value={Number.isFinite(v) ? +(v * 100).toFixed(2) : 0}
        onChange={e => on((parseFloat(e.target.value) || 0) / 100)}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
    </div>
  );
}
