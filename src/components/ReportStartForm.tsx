import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientInputs } from "@/hooks/useClientInputs";
import { DEFAULT_INPUTS } from "@/lib/xlsx-import";
import { buildSummary, type ClientInputs, type IncomeFrequency, type InvestmentOption } from "@/lib/calc";
import { toast } from "sonner";
import { celebrate } from "@/lib/celebration";
import { useAuth } from "@/hooks/useAuth";
import { saveClientReportSnapshot } from "@/lib/report-persistence";
import {
  Sparkles, DollarSign, Landmark, Target, TrendingUp, Cake, PiggyBank,
  Plus, Trash2, Wand2, ArrowRight,
} from "lucide-react";

export interface ReportStartPrefill {
  clientName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientEmail?: string;
  clientPhone?: string;
  age?: string | number | null;
  superFundName?: string | null;
  superBalance?: string | number | null;
  state?: string | null;
  hadReviewBefore?: string | null;
  notes?: string | null;
  leadSource?: string | null;
}

type OptionRow = { name: string; allocationPct: string };

const num = (v: string | number | null | undefined, fb = 0) => {
  if (v == null || v === "") return fb;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fb;
};

export function ReportStartForm({ prefill }: { prefill: ReportStartPrefill }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setInputs, setLookup, setEditingReportId } = useClientInputs();

  const splitName = (full?: string) => {
    const t = (full || "").trim();
    if (!t) return { first: "", last: "" };
    const parts = t.split(/\s+/);
    return { first: parts[0], last: parts.slice(1).join(" ") };
  };
  const _init = splitName(prefill.clientName);
  const [firstName, setFirstName] = useState(prefill.clientFirstName ?? _init.first);
  const [lastName, setLastName] = useState(prefill.clientLastName ?? _init.last);

  const [annualIncome, setAnnualIncome] = useState("");
  const [superFundName, setSuperFundName] = useState(prefill.superFundName ?? "");
  const [superBalance, setSuperBalance] = useState(
    prefill.superBalance != null ? String(prefill.superBalance) : ""
  );
  const [age, setAge] = useState(prefill.age != null ? String(prefill.age) : "");
  const [retirementAge, setRetirementAge] = useState("67");

  const [makesContrib, setMakesContrib] = useState<"yes" | "no">("no");
  const [contribAmount, setContribAmount] = useState("");
  const [contribFrequency, setContribFrequency] = useState<IncomeFrequency>("Monthly");
  const [contribType, setContribType] = useState<"dollar" | "percent">("dollar");

  const [primaryOption, setPrimaryOption] = useState("Growth (Default)");
  const [options, setOptions] = useState<OptionRow[]>([]);

  const [goalBalance, setGoalBalance] = useState("");
  const [desiredIncomeAmount, setDesiredIncomeAmount] = useState("");
  const [desiredIncomeFrequency, setDesiredIncomeFrequency] = useState<IncomeFrequency>("Weekly");

  const [submitting, setSubmitting] = useState(false);

  // Re-sync local fields when prefill changes (e.g. switching contacts)
  useEffect(() => {
    if (prefill.age != null && prefill.age !== "") setAge(String(prefill.age));
    if (prefill.superFundName) setSuperFundName(prefill.superFundName);
    if (prefill.superBalance != null && prefill.superBalance !== "") setSuperBalance(String(prefill.superBalance));
    const s = splitName(prefill.clientName);
    const nextFirst = prefill.clientFirstName ?? s.first;
    const nextLast = prefill.clientLastName ?? s.last;
    if (nextFirst) setFirstName(nextFirst);
    if (nextLast) setLastName(nextLast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill.clientName, prefill.clientFirstName, prefill.clientLastName, prefill.superFundName, prefill.superBalance, prefill.age]);

  // Keep the fund-lookup search box in sync with the form so the user can
  // just hit Search without retyping. Include all context the lookup might use:
  // super fund + investment option, age, super balance, state, income, etc.
  useEffect(() => {
    const parts: string[] = [];
    if (superFundName.trim()) parts.push(`Super fund: ${superFundName.trim()}`);
    if (primaryOption.trim()) parts.push(`Investment option: ${primaryOption.trim()}`);
    if (age.trim()) parts.push(`Age: ${age.trim()}`);
    if (superBalance.trim()) parts.push(`Super balance: $${superBalance.trim()}`);
    if (prefill.state) parts.push(`State: ${prefill.state}`);
    if (annualIncome.trim()) parts.push(`Annual income: $${annualIncome.trim()}`);
    const composedName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || prefill.clientName || "";
    if (composedName) parts.push(`Client: ${composedName}`);
    const extraOpts = options
      .filter((o) => o.name.trim())
      .map((o) => `${o.name.trim()}${o.allocationPct ? ` (${o.allocationPct}%)` : ""}`);
    if (extraOpts.length) parts.push(`Additional options: ${extraOpts.join(", ")}`);
    const text = parts.join(" | ");
    if (!text) return;
    setLookup((prev) => (prev.text === text ? prev : { ...prev, text }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superFundName, primaryOption, age, superBalance, annualIncome, options, prefill.state, prefill.clientName, firstName, lastName]);

  const handleSimulate = () => {
    setAge("42");
    setRetirementAge("67");
    setAnnualIncome("95,000");
    setSuperFundName(superFundName || "AustralianSuper");
    setSuperBalance(superBalance || "145,000");
    setPrimaryOption("Balanced");
    setOptions([
      { name: "High Growth", allocationPct: "30" },
      { name: "Indexed Shares", allocationPct: "20" },
    ]);
    setMakesContrib("yes");
    setContribAmount("250");
    setContribType("dollar");
    setContribFrequency("Monthly");
    setGoalBalance("750,000");
    setDesiredIncomeAmount("1,200");
    setDesiredIncomeFrequency("Weekly");
    toast.success("Sample data loaded — review then Generate Report");
  };

  const addOption = () =>
    setOptions((p) => [...p, { name: "", allocationPct: "" }]);
  const updateOption = (i: number, patch: Partial<OptionRow>) =>
    setOptions((p) => p.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const removeOption = (i: number) =>
    setOptions((p) => p.filter((_, idx) => idx !== i));

  const handleSubmit = () => {
    if (!age || !annualIncome || !superFundName) {
      toast.error("Add at least age, income and super fund to continue.");
      return;
    }
    setSubmitting(true);

    const investmentOptions: InvestmentOption[] = options
      .filter((o) => o.name.trim())
      .map((o) => ({
        name: o.name.trim(),
        allocationPct: Math.max(0, Math.min(1, num(o.allocationPct) / 100)),
        growthAssetsPct: 0.7,
        fiveYearReturn: 0.08,
      }));

    const allocSum = investmentOptions.reduce((s, o) => s + o.allocationPct, 0);
    const primaryAllocationPct = Math.max(0, 1 - allocSum);

    const next: ClientInputs = {
      ...DEFAULT_INPUTS,
      clientName: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || prefill.clientName || DEFAULT_INPUTS.clientName,
      clientEmail: prefill.clientEmail || "",
      clientPhone: prefill.clientPhone || "",
      age: num(age, DEFAULT_INPUTS.age),
      retirementAge: num(retirementAge, DEFAULT_INPUTS.retirementAge),
      annualIncome: num(annualIncome),
      fundName: superFundName.trim(),
      superBalance: num(superBalance),
      modelLabel: primaryOption || "Growth (Default)",
      goalBalance: num(goalBalance, DEFAULT_INPUTS.goalBalance),
      desiredIncomeAmount: num(desiredIncomeAmount, DEFAULT_INPUTS.desiredIncomeAmount),
      desiredIncomeFrequency,
      personalContributionAmount: makesContrib === "yes" ? num(contribAmount) : 0,
      personalContributionFrequency: contribFrequency,
      personalContributionType: contribType,
      investmentOptions: investmentOptions.length ? investmentOptions : undefined,
      primaryAllocationPct: investmentOptions.length ? primaryAllocationPct : undefined,
    };

    setInputs(next);
    celebrate();
    toast.success("🎉 Report inputs loaded — looking up fund details…");
    setTimeout(() => navigate("/"), 850);
  };

  return (
    <div className="rounded-2xl border border-cyan/30 bg-gradient-to-br from-cyan/5 via-background to-background overflow-hidden">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(215,60%,18%)] px-5 py-4">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Generate Super Report</h3>
              <p className="text-[11px] text-white/60">Quick details to kick off the analysis</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSimulate}
            className="h-8 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white text-xs"
          >
            <Wand2 className="w-3 h-3" />
            Simulate
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Name */}
        <Section icon={<Cake className="w-3.5 h-3.5" />} title="Client name">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            </Field>
            <Field label="Last name">
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
            </Field>
          </div>
        </Section>

        {/* 8 survey questions in order */}
        <Section icon={<Sparkles className="w-3.5 h-3.5" />} title="Survey questions">
          <Field label="1. Which super fund are you currently with?" icon={<Landmark className="w-3 h-3" />}>
            <Input value={superFundName} onChange={(e) => setSuperFundName(e.target.value)} placeholder="AustralianSuper, Hostplus…" />
          </Field>
          <Field label="2. What's your rough gross annual income?" icon={<DollarSign className="w-3 h-3" />}>
            <Input value={annualIncome} onChange={(e) => setAnnualIncome(e.target.value)} placeholder="85,000" inputMode="numeric" />
          </Field>
          <Field label="3. How much have you roughly got in super at the moment?" icon={<PiggyBank className="w-3 h-3" />}>
            <Input value={superBalance} onChange={(e) => setSuperBalance(e.target.value)} placeholder="120,000" inputMode="numeric" />
          </Field>
          <Field label="4. How much super would you like to have at retirement?" icon={<Target className="w-3 h-3" />}>
            <Input value={goalBalance} onChange={(e) => setGoalBalance(e.target.value)} placeholder="700,000" inputMode="numeric" />
          </Field>
          <Field label="5. Are you just in the default option, mixed or unsure?">
            <Input value={primaryOption} onChange={(e) => setPrimaryOption(e.target.value)} placeholder="Default / Mixed / Unsure" />
          </Field>
          <Field label="6. What's your age?">
            <Input value={age} onChange={(e) => setAge(e.target.value)} placeholder="42" inputMode="numeric" />
          </Field>
          <Field label="7. What age would you like to retire?">
            <Input value={retirementAge} onChange={(e) => setRetirementAge(e.target.value)} placeholder="67" inputMode="numeric" />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="8. How much would you like as a rough income?" icon={<TrendingUp className="w-3 h-3" />}>
                <Input value={desiredIncomeAmount} onChange={(e) => setDesiredIncomeAmount(e.target.value)} placeholder="1,000" inputMode="numeric" />
              </Field>
            </div>
            <Field label="Per">
              <Select value={desiredIncomeFrequency} onValueChange={(v) => setDesiredIncomeFrequency(v as IncomeFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Week</SelectItem>
                  <SelectItem value="Monthly">Month</SelectItem>
                  <SelectItem value="Annually">Year</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Extra investment options (optional) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Additional investment options
              </Label>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={addOption}>
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {options.length === 0 && (
              <p className="text-[11px] text-muted-foreground/60 italic">
                Optional — split balance across multiple options
              </p>
            )}
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-end bg-muted/30 rounded-lg p-2">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">Option name</Label>
                  <Input value={opt.name} onChange={(e) => updateOption(i, { name: e.target.value })} placeholder="High Growth" className="h-8 text-xs" />
                </div>
                <div className="w-20">
                  <Label className="text-[10px] text-muted-foreground">Alloc %</Label>
                  <Input value={opt.allocationPct} onChange={(e) => updateOption(i, { allocationPct: e.target.value })} placeholder="50" className="h-8 text-xs" inputMode="numeric" />
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeOption(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </Section>

        {/* Personal contributions */}
        <Section icon={<PiggyBank className="w-3.5 h-3.5" />} title="Personal contributions">
          <Field label="Are they making personal contributions?">
            <Select value={makesContrib} onValueChange={(v) => setMakesContrib(v as "yes" | "no")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {makesContrib === "yes" && (
            <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Field label="Amount">
                <Input value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} placeholder="200" inputMode="numeric" />
              </Field>
              <Field label="Type">
                <Select value={contribType} onValueChange={(v) => setContribType(v as "dollar" | "percent")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dollar">$</SelectItem>
                    <SelectItem value="percent">% income</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Frequency">
                <Select value={contribFrequency} onValueChange={(v) => setContribFrequency(v as IncomeFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </Section>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-12 gradient-accent text-white border-0 shadow-lg shadow-cyan/20 hover:shadow-cyan/40 transition-all group"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Generate Report
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-foreground/70">
        <span className="text-cyan">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}
