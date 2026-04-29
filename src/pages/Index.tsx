import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/ClientForm";
import { CoverPage, WhoWeArePage, SnapshotPage, FundsPage, ProjectionPage, IncomePage } from "@/components/report/pages";
import { buildSummary, type ClientInputs } from "@/lib/calc";
import { DEFAULT_INPUTS, importFromFile } from "@/lib/xlsx-import";
import { toast } from "sonner";

export default function Index() {
  const [inputs, setInputs] = useState<ClientInputs>(DEFAULT_INPUTS);
  const summary = useMemo(() => buildSummary(inputs), [inputs]);
  const fileRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleUpload = async (file: File) => {
    try {
      const parsed = await importFromFile(file);
      setInputs(parsed);
      toast.success(`Loaded data for ${parsed.clientName}`);
    } catch (e) {
      console.error(e);
      toast.error("Could not parse that XLSX. Make sure it has a 'Client Data' sheet.");
    }
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const pages = Array.from(reportRef.current.querySelectorAll(".report-page")) as HTMLElement[];
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        const img = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }
      pdf.save(`Super_Health_Check_${inputs.clientName.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF exported");
    } catch (e) {
      console.error(e);
      toast.error("PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/40">
      {/* Top bar */}
      <header className="no-print sticky top-0 z-40 bg-navy text-navy-foreground shadow-elevated">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md bg-cyan text-cyan-foreground text-[10px] font-bold tracking-wide">
              Advisor Link
            </span>
            <span className="text-xs font-semibold opacity-70">Super Performance Report Builder</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }}
            />
            <Button variant="outline" className="bg-transparent text-navy-foreground border-white/20 hover:bg-white/10" onClick={() => fileRef.current?.click()}>
              Upload XLSX
            </Button>
            <Button onClick={exportPDF} disabled={exporting} className="bg-cyan text-cyan-foreground hover:bg-cyan/90">
              {exporting ? "Exporting…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <aside className="no-print lg:sticky lg:top-20 lg:self-start">
          <ClientForm value={inputs} onChange={setInputs} />
          <p className="mt-3 text-[11px] text-muted-foreground">
            Tip: edits update the report instantly. Use <strong>Upload XLSX</strong> to load a saved
            Client Data sheet, then download the PDF when you're happy.
          </p>
        </aside>
        <section ref={reportRef} className="space-y-0">
          <CoverPage s={summary} />
          <WhoWeArePage />
          <SnapshotPage s={summary} />
          <FundsPage s={summary} />
          <ProjectionPage s={summary} />
          <IncomePage s={summary} />
          
        </section>
      </main>
    </div>
  );
}
