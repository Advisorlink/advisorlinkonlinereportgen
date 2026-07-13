import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import {
  runScenario,
  ageFromDob,
  firmModelDefaults,
  type StrategyPaperData,
  type StrategyScenario,
  type StrategyInsurance,
} from "@/lib/strategy-calc";
import type { RiskProfile, IncomeFrequency } from "@/lib/calc";

const RISK_PROFILES: RiskProfile[] = ["High Growth", "Growth", "Balanced", "Moderate", "Conservative"];
const FREQ: IncomeFrequency[] = ["Weekly", "Monthly", "Annually"];

interface Props {
  value: StrategyPaperData;
  onChange: (v: StrategyPaperData) => void;
}

// Small helpers to keep JSX tidy
const numOr = (v: string): number => {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const pctOr = (v: string): number => numOr(v) / 100;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <Label className="text-[11px] font-medium text-muted-foreground leading-tight mb-1.5 min-h-[28px] flex items-end">
        <span className="line-clamp-2">{label}</span>
      </Label>
      {children}
    </div>
  );
}

/**
 * Percentage input that lets the user freely clear/edit the field.
 * Keeps a local string draft so typing "" or "1." doesn't get overwritten
 * back to "0.00" (which is what the old controlled toFixed pattern did).
 */
function PctInput({ value, onChange }: { value: number; onChange: (pct: number) => void }) {
  const [draft, setDraft] = useState<string>(value ? (value * 100).toFixed(2) : "");
  useEffect(() => {
    // Sync external changes (e.g. autofill, reset) but only when they don't
    // match the current draft, so mid-typing doesn't get clobbered.
    const parsed = draft === "" ? 0 : Number(draft.replace(/,/g, "")) / 100;
    if (Math.abs(parsed - value) > 1e-9) {
      setDraft(value ? (value * 100).toFixed(2) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder="0.00"
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        onChange(pctOr(v));
      }}
    />
  );
}

/**
 * Number input that keeps a local string draft so clearing works naturally.
 */
function NumInput({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder?: string }) {
  const [draft, setDraft] = useState<string>(value ? String(value) : "");
  useEffect(() => {
    const parsed = draft === "" ? 0 : numOr(draft);
    if (parsed !== value) {
      setDraft(value ? String(value) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder={placeholder ?? "0"}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        onChange(numOr(v));
      }}
    />
  );
}

function ScenarioBlock({
  title,
  tint,
  scenario,
  onChange,
  showAdviserFee = true,
}: {
  title: string;
  tint: "existing" | "comparison";
  scenario: StrategyScenario;
  onChange: (s: StrategyScenario) => void;
  showAdviserFee?: boolean;
}) {
  const bg = tint === "existing" ? "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900" : "bg-indigo-100 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-900";
  return (
    <Card className={`border-2 ${bg}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Field label="Fund name">
          <Input value={scenario.fundName} onChange={(e) => onChange({ ...scenario, fundName: e.target.value })} />
        </Field>
        <Field label="Super balance ($)">
          <NumInput value={scenario.superBalance} onChange={(v) => onChange({ ...scenario, superBalance: v })} />
        </Field>
        <Field label="Model / option label">
          <Input value={scenario.modelLabel} onChange={(e) => onChange({ ...scenario, modelLabel: e.target.value })} />
        </Field>
        <Field label="Investment risk profile">
          <Select value={scenario.riskProfile} onValueChange={(v) => onChange({ ...scenario, riskProfile: v as RiskProfile })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RISK_PROFILES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="# investment options">
          <NumInput value={scenario.numInvestmentOptions} onChange={(v) => onChange({ ...scenario, numInvestmentOptions: v })} />
        </Field>
        <Field label="Admin fee (%)">
          <PctInput value={scenario.adminFeePct} onChange={(v) => onChange({ ...scenario, adminFeePct: v })} />
        </Field>
        <Field label="Admin fee flat ($)">
          <NumInput value={scenario.adminFeeFlat} onChange={(v) => onChange({ ...scenario, adminFeeFlat: v })} />
        </Field>
        {showAdviserFee && (
          <Field label="Existing adviser fee ($/yr)">
            <NumInput value={scenario.adviserFee} onChange={(v) => onChange({ ...scenario, adviserFee: v })} />
          </Field>
        )}
        <Field label="5-yr avg return (%)">
          <PctInput value={scenario.fiveYearReturn} onChange={(v) => onChange({ ...scenario, fiveYearReturn: v })} />
        </Field>
      </CardContent>
    </Card>
  );
}

function InsuranceBlock({
  title,
  tint,
  ins,
  onChange,
}: {
  title: string;
  tint: "existing" | "comparison";
  ins: StrategyInsurance;
  onChange: (i: StrategyInsurance) => void;
}) {
  const bg = tint === "existing" ? "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900" : "bg-indigo-100 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-900";
  return (
    <Card className={`border-2 ${bg}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Field label="Insurance provider">
          <Input value={ins.provider} onChange={(e) => onChange({ ...ins, provider: e.target.value })} />
        </Field>
        <Field label="Life cover ($)">
          <NumInput value={ins.lifeCover} onChange={(v) => onChange({ ...ins, lifeCover: v })} />
        </Field>
        <Field label="TPD cover ($)">
          <NumInput value={ins.tpdCover} onChange={(v) => onChange({ ...ins, tpdCover: v })} />
        </Field>
        <Field label="Income protection ($/month)">
          <NumInput value={ins.ipMonthly} onChange={(v) => onChange({ ...ins, ipMonthly: v })} />
        </Field>
        <Field label="Waiting period">
          <Select value={ins.waitingPeriod} onValueChange={(v) => onChange({ ...ins, waitingPeriod: v as StrategyInsurance["waitingPeriod"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30 days">30 days</SelectItem>
              <SelectItem value="60 days">60 days</SelectItem>
              <SelectItem value="90 days">90 days</SelectItem>
              <SelectItem value="No Income Protection">No Income Protection</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Benefit period">
          <Select value={ins.benefitPeriod} onValueChange={(v) => onChange({ ...ins, benefitPeriod: v as StrategyInsurance["benefitPeriod"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2 years">2 years</SelectItem>
              <SelectItem value="5 years">5 years</SelectItem>
              <SelectItem value="To Age 65">To Age 65</SelectItem>
              <SelectItem value="No Income Protection">No Income Protection</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Premium ($/yr)">
          <NumInput value={ins.premiumAnnual} onChange={(v) => onChange({ ...ins, premiumAnnual: v })} />
        </Field>
        <Field label="Premium structure">
          <Select value={ins.structure} onValueChange={(v) => onChange({ ...ins, structure: v as StrategyInsurance["structure"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Stepped">Stepped</SelectItem>
              <SelectItem value="Level">Level</SelectItem>
              <SelectItem value="No Insurance">No Insurance</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="IP type">
          <Select value={ins.type} onValueChange={(v) => onChange({ ...ins, type: v as StrategyInsurance["type"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Indemnity">Indemnity</SelectItem>
              <SelectItem value="Agreed Value">Agreed Value</SelectItem>
              <SelectItem value="No Income Protection">No Income Protection</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}

export function StrategyClientDataForm({ value, onChange }: Props) {
  const patch = (p: Partial<StrategyPaperData>) => onChange({ ...value, ...p });
  const computedAge = ageFromDob(value.clientDob);
  const yearsToRet = Math.max(0, value.retirementAge - computedAge);

  return (
    <div className="space-y-6">
      {/* Personal */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Personal</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="Client name">
            <Input value={value.clientName} onChange={(e) => patch({ clientName: e.target.value })} placeholder="John Smith" />
          </Field>
          <Field label={`Date of birth${computedAge ? ` · Age ${computedAge}` : ""}`}>
            <Input type="date" value={value.clientDob} onChange={(e) => patch({ clientDob: e.target.value })} />
          </Field>
          <Field label={`Retirement age${computedAge ? ` · ${yearsToRet} yrs away` : ""}`}>
            <NumInput value={value.retirementAge} onChange={(v) => patch({ retirementAge: v })} />
          </Field>
          <Field label="Annual income ($)">
            <NumInput value={value.annualIncome} onChange={(v) => patch({ annualIncome: v })} />
          </Field>
          <Field label="Personal contribution ($)">
            <NumInput value={value.personalContributionAmount} onChange={(v) => patch({ personalContributionAmount: v })} />
          </Field>
          <Field label="Contribution frequency">
            <Select value={value.personalContributionFrequency} onValueChange={(v) => patch({ personalContributionFrequency: v as IncomeFrequency })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FREQ.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Desired retirement income ($)">
            <NumInput value={value.desiredIncomeAmount} onChange={(v) => patch({ desiredIncomeAmount: v })} />
          </Field>
          <Field label="Income frequency">
            <Select value={value.desiredIncomeFrequency} onValueChange={(v) => patch({ desiredIncomeFrequency: v as IncomeFrequency })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FREQ.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Retirement goal balance ($)">
            <NumInput value={value.goalBalance} onChange={(v) => patch({ goalBalance: v })} />
          </Field>
        </CardContent>
      </Card>


      {/* Super scenarios */}
      <div className="grid md:grid-cols-2 gap-4">
        <ScenarioBlock
          title="Existing Scenario (Super)"
          tint="existing"
          scenario={value.existing}
          onChange={(s) => patch({ existing: s })}
        />
        <div className="space-y-2">
          <ScenarioBlock
            title="Comparison Scenario (Super)"
            tint="comparison"
            scenario={value.comparison}
            onChange={(s) => patch({ comparison: s })}
            showAdviserFee={false}
          />
          <button
            type="button"
            onClick={() => patch({ comparison: { ...firmModelDefaults(value.existing.riskProfile), superBalance: value.comparison.superBalance || value.existing.superBalance } })}
            className="text-xs text-indigo-600 hover:underline"
          >
            Reset to firm's {value.existing.riskProfile} model defaults (matches existing profile)
          </button>
        </div>
      </div>

      {/* Insurance */}
      <div className="grid md:grid-cols-2 gap-4">
        <InsuranceBlock title="Existing Insurance" tint="existing" ins={value.existingInsurance} onChange={(i) => patch({ existingInsurance: i })} />
        <InsuranceBlock title="Comparison Insurance" tint="comparison" ins={value.comparisonInsurance} onChange={(i) => patch({ comparisonInsurance: i })} />
      </div>

      {/* Fees */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Advice & Implementation Fees</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="Advice / implementation fee ($)">
            <NumInput value={value.fees.adviceFeeFlat} onChange={(v) => patch({ fees: { ...value.fees, adviceFeeFlat: v } })} />
          </Field>
          <Field label="Annual advice fee (%)">
            <PctInput value={value.fees.annualAdvicePct} onChange={(v) => patch({ fees: { ...value.fees, annualAdvicePct: v } })} />
          </Field>
          <Field label="Annual fee cap ($)">
            <NumInput value={value.fees.annualFeeCap} onChange={(v) => patch({ fees: { ...value.fees, annualFeeCap: v } })} />
          </Field>
        </CardContent>
      </Card>

      {/* AI-generated commentary */}
      <AINotesCard value={value} onChange={onChange} />
    </div>
  );
}

function AINotesCard({ value, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const patch = (p: Partial<StrategyPaperData>) => onChange({ ...value, ...p });

  const generate = async () => {
    if (!value.clientName || !value.clientDob) {
      toast.error("Add the client's name and date of birth first");
      return;
    }
    setBusy(true);
    try {
      const ex = runScenario(value, value.existing);
      const cmp = runScenario(value, value.comparison);
      const uplift = cmp.projectedBalance - ex.projectedBalance;
      const upliftPct = ex.projectedBalance > 0 ? (uplift / ex.projectedBalance) * 100 : 0;
      const incomeUplift = cmp.totalIncome - ex.totalIncome;
      const age = ageFromDob(value.clientDob);
      const yearsToRet = Math.max(0, value.retirementAge - age);

      const { data, error } = await supabase.functions.invoke("strategy-generate-notes", {
        body: {
          clientName: value.clientName,
          age,
          retirementAge: value.retirementAge,
          yearsToRet,
          annualIncome: value.annualIncome,
          desiredIncomeAmount: value.desiredIncomeAmount,
          desiredIncomeFrequency: value.desiredIncomeFrequency,
          goalBalance: value.goalBalance,
          existing: value.existing,
          comparison: value.comparison,
          existingInsurance: value.existingInsurance,
          comparisonInsurance: value.comparisonInsurance,
          ex: {
            projectedBalance: ex.projectedBalance,
            totalIncome: ex.totalIncome,
            ageMoneyLasts: ex.ageMoneyLasts,
            moneyNeverRunsOut: ex.moneyNeverRunsOut,
          },
          cmp: {
            projectedBalance: cmp.projectedBalance,
            totalIncome: cmp.totalIncome,
            ageMoneyLasts: cmp.ageMoneyLasts,
            moneyNeverRunsOut: cmp.moneyNeverRunsOut,
          },
          uplift,
          upliftPct,
          incomeUplift,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      patch({
        aiObservation: data.observation || "",
        aiKeyInsight: data.keyInsight || "",
        aiPatternExisting: data.patternExisting || "",
        aiCompoundingRecommended: data.compoundingRecommended || "",
        researchNotes: data.researchNotes || value.researchNotes,
      });
      toast.success("AI notes generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-2 border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600" />
          Notes
        </CardTitle>
        <Button size="sm" onClick={generate} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white">
          {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          {busy ? "Generating…" : "AI · Generate notes"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Click <b>AI · Generate notes</b> to write all five narrative fields below based on the client's actual numbers. Each field is editable, so you can refine anything before exporting.
        </p>
        <Field label="Observation (Return vs Fee panel)">
          <Textarea rows={3} value={value.aiObservation ?? ""} onChange={(e) => patch({ aiObservation: e.target.value })} placeholder="Short observation about the fund return and fee comparison." />
        </Field>
        <Field label="Key insight (Accumulation page)">
          <Textarea rows={3} value={value.aiKeyInsight ?? ""} onChange={(e) => patch({ aiKeyInsight: e.target.value })} placeholder="The single most important compounding insight for this client." />
        </Field>
        <Field label="Pattern to watch (Existing arrangement)">
          <Textarea rows={4} value={value.aiPatternExisting ?? ""} onChange={(e) => patch({ aiPatternExisting: e.target.value })} placeholder="Longevity risk and drawdown pressure under the existing setup." />
        </Field>
        <Field label="Compounding effect (Recommended arrangement)">
          <Textarea rows={4} value={value.aiCompoundingRecommended ?? ""} onChange={(e) => patch({ aiCompoundingRecommended: e.target.value })} placeholder="What the extra capital enables in retirement." />
        </Field>
        <Field label="Adviser research notes">
          <Textarea rows={5} value={value.researchNotes} onChange={(e) => patch({ researchNotes: e.target.value })}
            placeholder="Rationale behind the recommendation, including insurance restructure reasoning." />
        </Field>
      </CardContent>
    </Card>
  );
}

