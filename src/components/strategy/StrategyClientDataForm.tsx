import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type StrategyPaperData,
  type StrategyScenario,
  type StrategyInsurance,
  firmModelDefaults,
  ageFromDob,
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
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
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
          <Input type="text" inputMode="decimal" value={scenario.superBalance || ""} onChange={(e) => onChange({ ...scenario, superBalance: numOr(e.target.value) })} />
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
          <Input type="text" inputMode="decimal" value={scenario.numInvestmentOptions || ""} onChange={(e) => onChange({ ...scenario, numInvestmentOptions: numOr(e.target.value) })} />
        </Field>
        <Field label="Admin fee (%)">
          <Input type="text" inputMode="decimal" value={(scenario.adminFeePct * 100).toFixed(2)} onChange={(e) => onChange({ ...scenario, adminFeePct: pctOr(e.target.value) })} />
        </Field>
        <Field label="Admin fee flat ($)">
          <Input type="text" inputMode="decimal" value={scenario.adminFeeFlat || ""} onChange={(e) => onChange({ ...scenario, adminFeeFlat: numOr(e.target.value) })} />
        </Field>
        {showAdviserFee && (
          <Field label="Existing adviser fee ($/yr)">
            <Input type="text" inputMode="decimal" value={scenario.adviserFee || ""} onChange={(e) => onChange({ ...scenario, adviserFee: numOr(e.target.value) })} />
          </Field>
        )}
        <Field label="5-yr avg return (%)">
          <Input type="text" inputMode="decimal" value={(scenario.fiveYearReturn * 100).toFixed(2)} onChange={(e) => onChange({ ...scenario, fiveYearReturn: pctOr(e.target.value) })} />
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
          <Input type="text" inputMode="decimal" value={ins.lifeCover || ""} onChange={(e) => onChange({ ...ins, lifeCover: numOr(e.target.value) })} />
        </Field>
        <Field label="TPD cover ($)">
          <Input type="text" inputMode="decimal" value={ins.tpdCover || ""} onChange={(e) => onChange({ ...ins, tpdCover: numOr(e.target.value) })} />
        </Field>
        <Field label="Income protection ($/month)">
          <Input type="text" inputMode="decimal" value={ins.ipMonthly || ""} onChange={(e) => onChange({ ...ins, ipMonthly: numOr(e.target.value) })} />
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
          <Input type="text" inputMode="decimal" value={ins.premiumAnnual || ""} onChange={(e) => onChange({ ...ins, premiumAnnual: numOr(e.target.value) })} />
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
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Client name">
            <Input value={value.clientName} onChange={(e) => patch({ clientName: e.target.value })} placeholder="John Smith" />
          </Field>
          <Field label={`Date of birth${computedAge ? ` · Age ${computedAge}` : ""}`}>
            <Input type="date" value={value.clientDob} onChange={(e) => patch({ clientDob: e.target.value })} />
          </Field>
          <Field label={`Retirement age${computedAge ? ` · ${yearsToRet} yrs away` : ""}`}>
            <Input type="text" inputMode="numeric" value={value.retirementAge || ""} onChange={(e) => patch({ retirementAge: numOr(e.target.value) })} />
          </Field>
          <Field label="Annual income ($)">
            <Input type="text" inputMode="decimal" value={value.annualIncome || ""} onChange={(e) => patch({ annualIncome: numOr(e.target.value) })} />
          </Field>
          <Field label="Personal contribution ($)">
            <Input type="text" inputMode="decimal" value={value.personalContributionAmount || ""} onChange={(e) => patch({ personalContributionAmount: numOr(e.target.value) })} />
          </Field>
          <Field label="Contribution frequency">
            <Select value={value.personalContributionFrequency} onValueChange={(v) => patch({ personalContributionFrequency: v as IncomeFrequency })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FREQ.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Desired retirement income ($)">
            <Input type="text" inputMode="decimal" value={value.desiredIncomeAmount || ""} onChange={(e) => patch({ desiredIncomeAmount: numOr(e.target.value) })} />
          </Field>
          <Field label="Income frequency">
            <Select value={value.desiredIncomeFrequency} onValueChange={(v) => patch({ desiredIncomeFrequency: v as IncomeFrequency })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FREQ.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Retirement goal balance ($)">
            <Input type="text" inputMode="decimal" value={value.goalBalance || ""} onChange={(e) => patch({ goalBalance: numOr(e.target.value) })} />
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
        <CardContent className="grid grid-cols-3 gap-3">
          <Field label="Advice / implementation fee ($)">
            <Input type="text" inputMode="decimal" value={value.fees.adviceFeeFlat || ""} onChange={(e) => patch({ fees: { ...value.fees, adviceFeeFlat: numOr(e.target.value) } })} />
          </Field>
          <Field label="Annual advice fee (%)">
            <Input type="text" inputMode="decimal" value={(value.fees.annualAdvicePct * 100).toFixed(2)} onChange={(e) => patch({ fees: { ...value.fees, annualAdvicePct: pctOr(e.target.value) } })} />
          </Field>
          <Field label="Annual fee cap ($)">
            <Input type="text" inputMode="decimal" value={value.fees.annualFeeCap || ""} onChange={(e) => patch({ fees: { ...value.fees, annualFeeCap: numOr(e.target.value) } })} />
          </Field>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Research Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={4} placeholder="e.g. Due to medical history, retaining existing insurance is the recommended option."
            value={value.researchNotes} onChange={(e) => patch({ researchNotes: e.target.value })} />
        </CardContent>
      </Card>
    </div>
  );
}
