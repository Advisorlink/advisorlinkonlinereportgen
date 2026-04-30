import { useState } from "react";
import type { ClientInputs, IncomeFrequency } from "@/lib/calc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ExternalLink, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientInputs } from "@/hooks/useClientInputs";
import { toast } from "sonner";

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
  const { lookup, setLookup } = useClientInputs();
  const lookupText = lookup.text;
  const setLookupText = (t: string) => setLookup(prev => ({ ...prev, text: t }));
  const lastResult = lookup.result;
  const setLastResult = (r: Record<string, unknown> | null) => setLookup(prev => ({ ...prev, result: r }));
  const [loading, setLoading] = useState(false);
  const [lookupCache, setLookupCache] = useState<Record<string, unknown> | null>(null);
  const [lookupCacheKey, setLookupCacheKey] = useState("");

  const applyLookupResult = (r: Record<string, unknown>) => {
    const next: ClientInputs = { ...value };
    const numeric = (k: keyof ClientInputs, v: unknown) => {
      if (typeof v === "number" && Number.isFinite(v)) (next[k] as number) = v;
    };
    const text = (k: keyof ClientInputs, v: unknown) => {
      if (typeof v === "string" && v.trim()) (next[k] as string) = v.trim();
    };

    text("clientName", r.clientName);
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
    onChange(next);
  };

  const runLookup = async () => {
    if (lookupText.trim().length < 3) {
      toast.error("Enter at least the fund name and investment option.");
      return;
    }
    const cacheKey = lookupText.trim().toLowerCase().replace(/\s+/g, " ");
    if (lookupCache && lookupCacheKey === cacheKey) {
      applyLookupResult(lookupCache);
      setLastResult(lookupCache);
      toast.success("Fund details applied", { description: "Used the same verified result as the previous fill." });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-fund", {
        body: { query: lookupText.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const r = data?.data ?? {};
      applyLookupResult(r);
      setLookupCache(r);
      setLookupCacheKey(cacheKey);
      setLastResult(r);
      toast.success("Fund details applied", {
        description: "Review the figures and source links below.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lookup failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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
                      runLookup();
                    }
                  }}
                  disabled={loading}
                />
                <Button onClick={runLookup} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span className="ml-2">{loading ? "Searching…" : "START SEARCH"}</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                AI searches the web for the latest fees & returns, then fills the fields below. Always review before sending.
              </p>
              {lastResult && (
                <div className="mt-2 rounded-md border border-border bg-muted/40 p-2 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sources</div>
                  {Array.isArray(lastResult.sourceUrls) && (lastResult.sourceUrls as string[]).length > 0 ? (
                    <ul className="space-y-1">
                      {(lastResult.sourceUrls as string[]).map((u, i) => (
                        <li key={i} className="text-[11px] break-all">
                          <a href={u} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                            {u}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No source URL was returned.</p>
                  )}
                  {typeof lastResult.sourceNotes === "string" && lastResult.sourceNotes.trim() && (
                    <p className="text-[10px] text-muted-foreground whitespace-pre-line pt-1 border-t border-border/60">
                      {lastResult.sourceNotes}
                    </p>
                  )}
                  {typeof lastResult.returnEvidenceText === "string" && lastResult.returnEvidenceText.trim() && (
                    <p className="text-[10px] italic text-muted-foreground pt-1 border-t border-border/60">
                      Return evidence: “{lastResult.returnEvidenceText}”
                    </p>
                  )}
                </div>
              )}
            </div>
          </Group>
          <Group title="Personal">
            <Field label="Client name"><Input value={value.clientName} onChange={e => set("clientName", e.target.value)} /></Field>
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
          <Group title="Existing super">
            <Field label="Fund name"><Input value={value.fundName} onChange={e => set("fundName", e.target.value)} /></Field>
            <Field label="Investment option"><Input value={value.modelLabel} onChange={e => set("modelLabel", e.target.value)} /></Field>
            <Field label="Super balance"><NumInput v={value.superBalance} on={n => set("superBalance", n)} /></Field>
            <Field label="Growth assets %"><PctInput v={value.growthAssetsPct} on={n => set("growthAssetsPct", n)} /></Field>
            <Field label="5-year net return %"><PctInput v={value.grossReturn} on={n => set("grossReturn", n)} /></Field>
            <Field label="Admin fee - flat $"><NumInput v={value.adminFeeFlat} on={n => set("adminFeeFlat", n)} /></Field>
            <Field label="Admin fee - %"><PctInput v={value.adminFeePct} on={n => set("adminFeePct", n)} /></Field>
            <Field label="Investment risk profile"><Input value={value.investmentRiskProfile || ""} onChange={e => set("investmentRiskProfile", e.target.value)} /></Field>
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
