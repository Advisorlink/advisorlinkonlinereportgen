import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Save, Loader2, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StrategyClientDataForm } from "@/components/strategy/StrategyClientDataForm";
import { StrategyPaperRender } from "@/components/strategy/StrategyPaperRender";
import { DEFAULT_STRATEGY, type StrategyPaperData } from "@/lib/strategy-calc";

const LOCAL_KEY = "strategy-paper:draft:v1";

export default function Strategy() {
  const { user } = useAuth();
  const [data, setData] = useState<StrategyPaperData>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return { ...DEFAULT_STRATEGY, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_STRATEGY;
  });
  const [tab, setTab] = useState("client");
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
        existing_scenario: data.existing as unknown as Record<string, unknown>,
        comparison_scenario: data.comparison as unknown as Record<string, unknown>,
        existing_insurance: data.existingInsurance as unknown as Record<string, unknown>,
        comparison_insurance: data.comparisonInsurance as unknown as Record<string, unknown>,
        fees: data.fees as unknown as Record<string, unknown>,
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
      <div className="max-w-[1400px] mx-auto p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Strategy Paper</h1>
            <p className="text-sm text-muted-foreground">Financial advice strategy document · uses the same calc engine as the Super Health Check.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
            <Button onClick={downloadPDF} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download PDF
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="client"><Users className="w-4 h-4 mr-2" />Client Data</TabsTrigger>
            <TabsTrigger value="paper"><FileText className="w-4 h-4 mr-2" />Strategy Paper</TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="mt-4">
            <StrategyClientDataForm value={data} onChange={setData} />
          </TabsContent>

          <TabsContent value="paper" className="mt-4">
            <div className="overflow-auto">
              <StrategyPaperRender ref={paperRef} data={data} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
