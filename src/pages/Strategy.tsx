import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Save, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StrategyClientDataForm } from "@/components/strategy/StrategyClientDataForm";
import { StrategyPaperRender } from "@/components/strategy/StrategyPaperRender";
import { DEFAULT_STRATEGY, firmModelDefaults, type StrategyPaperData } from "@/lib/strategy-calc";
import logoAsset from "@/assets/finance-direct-logo-v2.png.asset.json";
const LOGO_URL = logoAsset.url;
const LOGO_ASPECT = 2.94;

const LOCAL_KEY = "strategy-paper:draft:v1";

const SAMPLE_STRATEGY: StrategyPaperData = {
  ...DEFAULT_STRATEGY,
  clientName: "Sarah Thompson",
  clientDob: "1980-06-15",
  retirementAge: 65,
  annualIncome: 145000,
  personalContributionAmount: 5000,
  personalContributionFrequency: "Annually",
  desiredIncomeAmount: 75000,
  desiredIncomeFrequency: "Annually",
  goalBalance: 1200000,
  existing: {
    fundName: "AustralianSuper, Balanced",
    superBalance: 285000,
    modelLabel: "Balanced (Default)",
    riskProfile: "Balanced",
    numInvestmentOptions: 1,
    adminFeePct: 0.0025,
    adminFeeFlat: 117,
    adviserFee: 0,
    fiveYearReturn: 0.0712,
  },
  comparison: {
    ...firmModelDefaults("Growth"),
    fundName: "HUB24, Firm Growth Model",
    superBalance: 285000,
  },
  existingInsurance: {
    provider: "AustralianSuper Group",
    lifeCover: 250000,
    tpdCover: 250000,
    ipMonthly: 6000,
    premiumAnnual: 1450,
    waitingPeriod: "60 days",
    benefitPeriod: "2 years",
    structure: "Stepped",
    type: "Indemnity",
  },
  comparisonInsurance: {
    provider: "TAL Accelerated Protection",
    lifeCover: 750000,
    tpdCover: 750000,
    ipMonthly: 9000,
    premiumAnnual: 2180,
    waitingPeriod: "90 days",
    benefitPeriod: "To Age 65",
    structure: "Level",
    type: "Agreed Value",
  },
  fees: {
    adviceFeeFlat: 3300,
    annualAdvicePct: 0.0165,
    annualFeeCap: 5000,
  },
  researchNotes:
    "Recommendation based on firm growth model portfolio research (Nov 2025). The client's existing balanced default option carries a higher admin fee load and lower 5-yr average return than the firm's HUB24 growth model. Insurance uplifted to reflect mortgage obligations and dependants, moving from Indemnity to Agreed Value IP with To Age 65 benefit period materially improves protection quality.",
};



export default function Strategy() {
  const { user } = useAuth();
  const [data, setData] = useState<StrategyPaperData>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return { ...DEFAULT_STRATEGY, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_STRATEGY;
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [paperId, setPaperId] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data]);

  const save = async () => {
    if (!user) { toast.error("Sign in to save"); return; }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        client_name: data.clientName,
        client_dob: data.clientDob || null,
        retirement_age: data.retirementAge,
        annual_income: data.annualIncome,
        personal_contribution_amount: data.personalContributionAmount,
        personal_contribution_frequency: data.personalContributionFrequency,
        desired_income_amount: data.desiredIncomeAmount,
        desired_income_frequency: data.desiredIncomeFrequency,
        goal_balance: data.goalBalance,
        existing_scenario: JSON.parse(JSON.stringify(data.existing)),
        comparison_scenario: JSON.parse(JSON.stringify(data.comparison)),
        existing_insurance: JSON.parse(JSON.stringify(data.existingInsurance)),
        comparison_insurance: JSON.parse(JSON.stringify(data.comparisonInsurance)),
        fees: JSON.parse(JSON.stringify(data.fees)),
        research_notes: data.researchNotes,
      };
      if (paperId) {
        const { error } = await supabase.from("strategy_papers").update(payload).eq("id", paperId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("strategy_papers").insert(payload).select("id").single();
        if (error) throw error;
        setPaperId(inserted.id);
      }
      toast.success("Strategy paper saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = async () => {
    if (!paperRef.current) return;
    setExporting(true);
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) { root.classList.remove("dark"); root.style.colorScheme = "light"; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const pages = Array.from(paperRef.current.querySelectorAll(".strategy-page")) as HTMLElement[];
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2.5, backgroundColor: "#ffffff", useCORS: true, logging: false });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "SLOW");
      }
      const safe = (data.clientName.trim() || "Client").replace(/[/\\?%*:|"<>]/g, "-");
      pdf.save(`${safe} Strategy Paper.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      if (wasDark) { root.classList.add("dark"); root.style.colorScheme = ""; }
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-[1800px] mx-auto p-4 md:p-6">
        {/* Brand header */}
        <div className="mb-4 flex items-center justify-between rounded-lg border bg-card px-5 py-3 shadow-sm">
          <div className="flex items-center gap-4">
            <div
              aria-label="Finance Direct"
              style={{
                height: 36,
                width: 36 * LOGO_ASPECT,
                backgroundColor: "#E8B840",
                WebkitMaskImage: `url(${LOGO_URL})`,
                maskImage: `url(${LOGO_URL})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskPosition: "left center",
                maskPosition: "left center",
              }}
            />
            <div className="hidden md:block pl-4 border-l">
              <div className="text-sm font-medium">Strategy Paper Generator</div>
              <div className="text-[11px] text-muted-foreground">Private wealth advisory document</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setData(SAMPLE_STRATEGY); toast.success("Sample data loaded"); }}>
              <Sparkles className="w-4 h-4 mr-2" />
              Auto-fill
            </Button>
            <Button variant="outline" size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
            <Button size="sm" onClick={downloadPDF} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download PDF
            </Button>
          </div>
        </div>

        {/* Split layout: client data on the left, live paper preview on the right */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(420px, 42%) 1fr" }}>
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
            <div className="px-5 py-3 border-b bg-muted/30">
              <div className="text-sm font-semibold">Client Data</div>
              <div className="text-[11px] text-muted-foreground">Edits update the paper on the right in real time.</div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <StrategyClientDataForm value={data} onChange={setData} />
            </div>
          </div>

          <div className="rounded-lg border bg-card shadow-sm overflow-hidden flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Strategy Paper</div>
                <div className="text-[11px] text-muted-foreground">Live preview · A4 pages</div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 report-preview bg-muted/10">
              <StrategyPaperRender ref={paperRef} data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
