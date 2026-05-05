import { useState } from "react";
import type { ClientInputs, IncomeFrequency, FundEntry } from "@/lib/calc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ExternalLink, FileText, Plus, Trash2 } from "lucide-react";
import { useClientInputs } from "@/hooks/useClientInputs";

function prettyDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function faviconFor(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  } catch {
    return "";
  }
}
function pageLabel(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    if (!last) return "Home";
    return decodeURIComponent(last)
      .replace(/\.(pdf|html?|aspx?)$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
      .slice(0, 60);
  } catch {
    return url;
  }
}

export function ClientForm({ value, onChange }: { value: ClientInputs; onChange: (v: ClientInputs) => void }) {
  const set = <K extends keyof ClientInputs>(k: K, v: ClientInputs[K]) => onChange({ ...value, [k]: v });
  const [collapsed, setCollapsed] = useState(false);
  const { lookup, setLookup, lookupLoading, runLookup } = useClientInputs();
  const lookupText = lookup.text;
  const setLookupText = (t: string) => setLookup(prev => ({ ...prev, text: t }));
  const lastResult = lookup.result;
  const loading = lookupLoading;

  const applyLookupResult = (r: Record<string, unknown>) => {
    const next: ClientInputs = { ...value };
    const numeric = (k: keyof ClientInputs, v: unknown) => {
      if (typeof v === "number" && Number.isFinite(v)) (next[k] as number) = v;
    };
    const text = (k: keyof ClientInputs, v: unknown) => {
      if (typeof v === "string" && v.trim()) (next[k] as string) = v.trim();
    };

    text("clientName", r.clientName);
    text("clientEmail", r.clientEmail);
    text("clientPhone", r.clientPhone);
    text("fundName", r.fundName);
    text("modelLabel", r.modelLabel);
    numeric("age", r.age);
    numeric("retirementAge", r.retirementAge);
    numeric("annualIncome", r.annualIncome);
    numeric("superBalance", r.superBalance);
    numeric("goalBalance", r.goalBalance);
    numeric("desiredIncomeAmount", r.desiredIncomeAmount);
    if (r.desiredIncomeFrequency === "Weekly" || r.desiredIncomeFrequency === "Monthly" || r.desiredIncomeFrequency === "Annually") {
      next.desiredIncomeFrequency = r.desiredIncomeFrequency;
    }
    numeric("adminFeeFlat", r.adminFeeFlat);
    numeric("adminFeePct", r.adminFeePct);
    numeric("grossReturn", r.grossReturn);
    numeric("growthAssetsPct", r.growthAssetsPct);
    text("investmentRiskProfile", r.investmentRiskProfile);

    // Fallback: pull an email straight out of the pasted lookup text if the
    // result didn't include one.
    if (!next.clientEmail || !next.clientEmail.trim()) {
      const match = lookupText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (match) next.clientEmail = match[0];
    }

    onChange(next);
  };

  const handleSearch = () => runLookup(lookupText, applyLookupResult);

  const updateFund = (idx: number, key: keyof FundEntry, val: string | number) => {
    const funds = [...(value.additionalFunds ?? [])];
    funds[idx] = { ...funds[idx], [key]: val };
    onChange({ ...value, additionalFunds: funds });
  };

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
          <Group title="Fund Lookup">
            <div className="col-span-2 space-y-2">
              <Label className="text-[11px] text-muted-foreground">
                Describe the client's super (fund, option, age, balance, income…)
              </Label>
              <div className="space-y-2">
                <Textarea
                  className="min-h-40 resize-y leading-relaxed"
                  placeholder="e.g. AustralianSuper Balanced, age 35, $80k balance, $95k salary"
                  value={lookupText}
                  onChange={e => setLookupText(e.target.value)}
                  onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loading) {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  disabled={loading}
                />
                <Button onClick={handleSearch} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span className="ml-2">{loading ? "Searching…" : "START SEARCH"}</span>
                </Button>
                {lookupText.trim() && (
                  <Button variant="outline" onClick={() => setLookupText("")} disabled={loading} className="w-full">
                    Clear Text
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                The search feature in this portal is only used to search the funds website. Always manually search the performance figures and growth assets.
              </p>
              {lastResult && (
                <div className="mt-3 rounded-lg border border-border bg-gradient-to-br from-card to-muted/30 p-3 shadow-sm space-y-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Verified sources</span>
                  </div>
                  {Array.isArray(lastResult.sourceUrls) && (lastResult.sourceUrls as string[]).length > 0 ? (
                    <ul className="space-y-1.5">
                      {(lastResult.sourceUrls as string[]).map((u, i) => (
                        <li key={i}>
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1.5 text-[11px] hover:border-primary hover:bg-primary/5 transition-colors"
                          >
                            <img
                              src={faviconFor(u)}
                              alt=""
                              className="w-4 h-4 rounded-sm shrink-0"
                              loading="lazy"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block font-medium text-foreground truncate">{pageLabel(u)}</span>
                              <span className="block text-[10px] text-muted-foreground truncate">{prettyDomain(u)}</span>
                            </span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No source URL was returned.</p>
                  )}
                  {typeof lastResult.sourceNotes === "string" && lastResult.sourceNotes.trim() && (
                    <p className="text-[10px] text-muted-foreground whitespace-pre-line pt-2 border-t border-border/60">
                      <span className="font-semibold">Notes: </span>{lastResult.sourceNotes}
                    </p>
                  )}
                  {typeof lastResult.returnEvidenceText === "string" && lastResult.returnEvidenceText.trim() && (
                    <p className="text-[10px] italic text-muted-foreground pt-2 border-t border-border/60">
                      <span className="not-italic font-semibold">Evidence: </span>“{lastResult.returnEvidenceText}”
                    </p>
                  )}
                </div>
              )}
            </div>
          </Group>
          <Group title="Personal">
            <Field label="Client name"><Input value={value.clientName} onChange={e => set("clientName", e.target.value)} /></Field>
           <Field label="Client's email"><Input type="email" placeholder="client@example.com" value={value.clientEmail ?? ""} onChange={e => set("clientEmail", e.target.value)} /></Field>
           <Field label="Phone number"><Input type="tel" placeholder="0400 000 000" value={value.clientPhone ?? ""} onChange={e => set("clientPhone", e.target.value)} /></Field>
            <Field label="Age"><NumInput v={value.age} on={n => set("age", n)} /></Field>
            <Field label="Retirement age"><NumInput v={value.retirementAge} on={n => set("retirementAge", n)} /></Field>
            <Field label="Annual income"><NumInput v={value.annualIncome} on={n => set("annualIncome", n)} /></Field>
            <Field label="Target balance"><NumInput v={value.goalBalance} on={n => set("goalBalance", n)} /></Field>
          </Group>
          <Group title="Personal contributions">
            <Field label="Amount">
              <NumInput v={value.personalContributionAmount ?? 0} on={n => set("personalContributionAmount", n)} />
            </Field>
            <Field label="Type">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={value.personalContributionType ?? "dollar"}
                onChange={e => set("personalContributionType", e.target.value as "dollar" | "percent")}
              >
                <option value="dollar">$ Amount</option>
                <option value="percent">% of Income</option>
              </select>
            </Field>
            <Field label="Frequency">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={value.personalContributionFrequency ?? "Annually"}
                onChange={e => set("personalContributionFrequency", e.target.value as IncomeFrequency)}
              >
                <option>Weekly</option><option>Monthly</option><option>Annually</option>
              </select>
            </Field>
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
          <Group title="Existing super (Fund 1)">
            <Field label="Fund name"><Input value={value.fundName} onChange={e => set("fundName", e.target.value)} /></Field>
            <Field label="Investment option"><Input value={value.modelLabel} onChange={e => set("modelLabel", e.target.value)} /></Field>
            <Field label="Super balance"><NumInput v={value.superBalance} on={n => set("superBalance", n)} /></Field>
            <Field label="Growth assets %"><PctInput v={value.growthAssetsPct} on={n => set("growthAssetsPct", n)} /></Field>
            <Field label="5-year net return %"><PctInput v={value.grossReturn} on={n => set("grossReturn", n)} /></Field>
            <Field label="Admin fee - flat $"><NumInput v={value.adminFeeFlat} on={n => set("adminFeeFlat", n)} /></Field>
            <Field label="Admin fee - %"><PctInput v={value.adminFeePct} on={n => set("adminFeePct", n)} /></Field>
            <Field label="Investment risk profile"><Input value={value.investmentRiskProfile || ""} onChange={e => set("investmentRiskProfile", e.target.value)} /></Field>
          </Group>
          {/* Additional funds */}
          {(value.additionalFunds ?? []).map((fund, idx) => (
            <Group key={idx} title={`Fund ${idx + 2}`}>
              <div className="col-span-2 flex justify-end -mt-1 -mb-1">
                <Button
                  variant="ghost" size="sm"
                  className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 h-7 text-[11px]"
                  onClick={() => {
                    const next = [...(value.additionalFunds ?? [])];
                    next.splice(idx, 1);
                    onChange({ ...value, additionalFunds: next });
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Remove
                </Button>
              </div>
              <Field label="Fund name"><Input value={fund.fundName} onChange={e => updateFund(idx, "fundName", e.target.value)} /></Field>
              <Field label="Investment option"><Input value={fund.modelLabel} onChange={e => updateFund(idx, "modelLabel", e.target.value)} /></Field>
              <Field label="Super balance"><NumInput v={fund.superBalance} on={n => updateFund(idx, "superBalance", n)} /></Field>
              <Field label="Growth assets %"><PctInput v={fund.growthAssetsPct} on={n => updateFund(idx, "growthAssetsPct", n)} /></Field>
              <Field label="5-year net return %"><PctInput v={fund.grossReturn} on={n => updateFund(idx, "grossReturn", n)} /></Field>
              <Field label="Admin fee - flat $"><NumInput v={fund.adminFeeFlat} on={n => updateFund(idx, "adminFeeFlat", n)} /></Field>
              <Field label="Admin fee - %"><PctInput v={fund.adminFeePct} on={n => updateFund(idx, "adminFeePct", n)} /></Field>
              <Field label="Investment risk profile"><Input value={fund.investmentRiskProfile || ""} onChange={e => updateFund(idx, "investmentRiskProfile", e.target.value)} /></Field>
            </Group>
          ))}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              const blank: FundEntry = {
                fundName: "", modelLabel: "", superBalance: 0,
                growthAssetsPct: 0.7, grossReturn: 0, adminFeeFlat: 0,
                adminFeePct: 0, investmentRiskProfile: "",
              };
              onChange({ ...value, additionalFunds: [...(value.additionalFunds ?? []), blank] });
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add another fund
          </Button>
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
