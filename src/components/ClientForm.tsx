import { useState } from "react";
import type { ClientInputs, IncomeFrequency, FundEntry } from "@/lib/calc";
import { createEmptyFund } from "@/lib/calc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ExternalLink, FileText, Plus, Trash2 } from "lucide-react";
import { useClientInputs } from "@/hooks/useClientInputs";

function prettyDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
function faviconFor(url: string): string {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return ""; }
}
function pageLabel(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    if (!last) return "Home";
    return decodeURIComponent(last).replace(/\.(pdf|html?|aspx?)$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()).slice(0, 60);
  } catch { return url; }
}

export function ClientForm({ value, onChange }: { value: ClientInputs; onChange: (v: ClientInputs) => void }) {
  const set = <K extends keyof ClientInputs>(k: K, v: ClientInputs[K]) => onChange({ ...value, [k]: v });
  const [collapsed, setCollapsed] = useState(false);
  const { lookup, setLookup, lookupLoading, runLookup } = useClientInputs();
  const lookupText = lookup.text;
  const setLookupText = (t: string) => setLookup(prev => ({ ...prev, text: t }));
  const lastResult = lookup.result;
  const loading = lookupLoading;

  // Fund entries management
  const funds: FundEntry[] = value.funds && value.funds.length > 0
    ? value.funds
    : [{
        id: "primary",
        fundName: value.fundName,
        modelLabel: value.modelLabel,
        superBalance: value.superBalance,
        growthAssetsPct: value.growthAssetsPct,
        adminFeeFlat: value.adminFeeFlat,
        adminFeePct: value.adminFeePct,
        grossReturn: value.grossReturn,
        investmentRiskProfile: value.investmentRiskProfile,
      }];

  const setFunds = (newFunds: FundEntry[]) => {
    // Sync primary fields from first fund for backward compat
    const first = newFunds[0] || createEmptyFund();
    onChange({
      ...value,
      funds: newFunds,
      fundName: first.fundName,
      modelLabel: first.modelLabel,
      superBalance: first.superBalance,
      growthAssetsPct: first.growthAssetsPct,
      adminFeeFlat: first.adminFeeFlat,
      adminFeePct: first.adminFeePct,
      grossReturn: first.grossReturn,
      investmentRiskProfile: first.investmentRiskProfile,
    });
  };

  const updateFund = (idx: number, patch: Partial<FundEntry>) => {
    const next = [...funds];
    next[idx] = { ...next[idx], ...patch };
    setFunds(next);
  };

  const addFund = () => setFunds([...funds, createEmptyFund()]);
  const removeFund = (idx: number) => {
    if (funds.length <= 1) return;
    setFunds(funds.filter((_, i) => i !== idx));
  };

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
    numeric("age", r.age);
    numeric("retirementAge", r.retirementAge);
    numeric("annualIncome", r.annualIncome);
    numeric("goalBalance", r.goalBalance);
    numeric("desiredIncomeAmount", r.desiredIncomeAmount);
    if (r.desiredIncomeFrequency === "Weekly" || r.desiredIncomeFrequency === "Monthly" || r.desiredIncomeFrequency === "Annually") {
      next.desiredIncomeFrequency = r.desiredIncomeFrequency;
    }

    // Apply fund data to first fund entry
    const currentFunds = [...(next.funds && next.funds.length > 0 ? next.funds : funds)];
    const f = { ...currentFunds[0] };
    if (typeof r.fundName === "string" && r.fundName.trim()) f.fundName = r.fundName.trim();
    if (typeof r.modelLabel === "string" && r.modelLabel.trim()) f.modelLabel = r.modelLabel.trim();
    if (typeof r.superBalance === "number" && Number.isFinite(r.superBalance)) f.superBalance = r.superBalance;
    if (typeof r.growthAssetsPct === "number" && Number.isFinite(r.growthAssetsPct)) f.growthAssetsPct = r.growthAssetsPct;
    if (typeof r.adminFeeFlat === "number" && Number.isFinite(r.adminFeeFlat)) f.adminFeeFlat = r.adminFeeFlat;
    if (typeof r.adminFeePct === "number" && Number.isFinite(r.adminFeePct)) f.adminFeePct = r.adminFeePct;
    if (typeof r.grossReturn === "number" && Number.isFinite(r.grossReturn)) f.grossReturn = r.grossReturn;
    if (typeof r.investmentRiskProfile === "string") f.investmentRiskProfile = r.investmentRiskProfile.trim();
    if (Array.isArray(r.sourceUrls)) f.sourceUrls = r.sourceUrls as string[];
    if (typeof r.sourceNotes === "string") f.sourceNotes = r.sourceNotes;
    if (typeof r.returnEvidenceText === "string") f.returnEvidenceText = r.returnEvidenceText;
    currentFunds[0] = f;
    next.funds = currentFunds;

    // Sync primary fields
    next.fundName = f.fundName;
    next.modelLabel = f.modelLabel;
    next.superBalance = f.superBalance;
    next.growthAssetsPct = f.growthAssetsPct;
    next.adminFeeFlat = f.adminFeeFlat;
    next.adminFeePct = f.adminFeePct;
    next.grossReturn = f.grossReturn;
    next.investmentRiskProfile = f.investmentRiskProfile;

    // Fallback email from pasted text
    if (!next.clientEmail || !next.clientEmail.trim()) {
      const match = lookupText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (match) next.clientEmail = match[0];
    }

    onChange(next);
  };

  const handleSearch = () => runLookup(lookupText, applyLookupResult);

  // Compute weighted average return for display
  const totalBal = funds.reduce((s, f) => s + f.superBalance, 0);
  const weightedReturn = totalBal > 0 ? funds.reduce((s, f) => s + f.superBalance * f.grossReturn, 0) / totalBal : 0;

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
                <SourcesCard result={lastResult} />
              )}
            </div>
          </Group>
          <Group title="Personal">
            <Field label="Client name"><Input value={value.clientName} onChange={e => set("clientName", e.target.value)} /></Field>
            <Field label="Client's email"><Input type="email" placeholder="client@example.com" value={value.clientEmail ?? ""} onChange={e => set("clientEmail", e.target.value)} /></Field>
            <Field label="Age"><NumInput v={value.age} on={n => set("age", n)} /></Field>
            <Field label="Retirement age"><NumInput v={value.retirementAge} on={n => set("retirementAge", n)} /></Field>
            <Field label="Annual income"><NumInput v={value.annualIncome} on={n => set("annualIncome", n)} /></Field>
            <Field label="Target balance"><NumInput v={value.goalBalance} on={n => set("goalBalance", n)} /></Field>
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

          {/* Multi-fund section */}
          {funds.map((fund, idx) => (
            <div key={fund.id} className="relative">
              <Group title={funds.length > 1 ? `Fund ${idx + 1}` : "Existing super"}>
                <Field label="Fund name">
                  <Input value={fund.fundName} onChange={e => updateFund(idx, { fundName: e.target.value })} />
                </Field>
                <Field label="Investment option">
                  <Input value={fund.modelLabel} onChange={e => updateFund(idx, { modelLabel: e.target.value })} />
                </Field>
                <Field label="Super balance">
                  <NumInput v={fund.superBalance} on={n => updateFund(idx, { superBalance: n })} />
                </Field>
                <Field label="Growth assets %">
                  <PctInput v={fund.growthAssetsPct} on={n => updateFund(idx, { growthAssetsPct: n })} />
                </Field>
                <Field label="5-year net return %">
                  <PctInput v={fund.grossReturn} on={n => updateFund(idx, { grossReturn: n })} />
                </Field>
                <Field label="Admin fee - flat $">
                  <NumInput v={fund.adminFeeFlat} on={n => updateFund(idx, { adminFeeFlat: n })} />
                </Field>
                <Field label="Admin fee - %">
                  <PctInput v={fund.adminFeePct} on={n => updateFund(idx, { adminFeePct: n })} />
                </Field>
                <Field label="Investment risk profile">
                  <Input value={fund.investmentRiskProfile || ""} onChange={e => updateFund(idx, { investmentRiskProfile: e.target.value })} />
                </Field>
              </Group>
              {funds.length > 1 && (
                <button
                  onClick={() => removeFund(idx)}
                  className="absolute top-0 right-0 p-1 text-destructive hover:text-destructive/80 transition-colors"
                  title="Remove this fund"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {/* Per-fund source info */}
              {fund.sourceUrls && fund.sourceUrls.length > 0 && (
                <SourcesCard result={{
                  sourceUrls: fund.sourceUrls,
                  sourceNotes: fund.sourceNotes,
                  returnEvidenceText: fund.returnEvidenceText,
                }} />
              )}
            </div>
          ))}

          <Button variant="outline" onClick={addFund} className="w-full gap-2">
            <Plus className="w-4 h-4" /> Add another fund
          </Button>

          {/* Weighted average summary */}
          {funds.length > 1 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Combined Summary</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">Total balance</div>
                <div className="font-semibold text-right tabular-nums">
                  ${totalBal.toLocaleString("en-AU", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-muted-foreground">Weighted avg 5yr return</div>
                <div className="font-semibold text-right tabular-nums">{(weightedReturn * 100).toFixed(2)}%</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SourcesCard({ result }: { result: Record<string, unknown> }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-gradient-to-br from-card to-muted/30 p-3 shadow-sm space-y-2.5">
      <div className="flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Verified sources</span>
      </div>
      {Array.isArray(result.sourceUrls) && (result.sourceUrls as string[]).length > 0 ? (
        <ul className="space-y-1.5">
          {(result.sourceUrls as string[]).map((u, i) => (
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
      {typeof result.sourceNotes === "string" && (result.sourceNotes as string).trim() && (
        <p className="text-[10px] text-muted-foreground whitespace-pre-line pt-2 border-t border-border/60">
          <span className="font-semibold">Notes: </span>{result.sourceNotes as string}
        </p>
      )}
      {typeof result.returnEvidenceText === "string" && (result.returnEvidenceText as string).trim() && (
        <p className="text-[10px] italic text-muted-foreground pt-2 border-t border-border/60">
          <span className="not-italic font-semibold">Evidence: </span>"{result.returnEvidenceText as string}"
        </p>
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
