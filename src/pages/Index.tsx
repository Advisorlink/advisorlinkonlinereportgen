import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/ClientForm";
import { CoverPage, WhoWeArePage, SnapshotPage, FundsPage, ProjectionPage, IncomePage, ImprovementSummaryPage, WhatsNextPage } from "@/components/report/pages";
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
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

      // A4 size in CSS pixels at 96dpi: 210mm = 793.7px, 297mm = 1122.5px
      const A4_W_PX = 794;
      const A4_H_PX = 1123;
      const SCALE = 2; // 2x is sharp on screen + zoom, much faster than 3x

      // Render all pages in parallel for speed
      const canvases = await Promise.all(
        pages.map((page) =>
          html2canvas(page, {
            scale: SCALE,
            backgroundColor: "#ffffff",
            useCORS: true,
            imageTimeout: 0,
            logging: false,
            width: A4_W_PX,
            height: A4_H_PX,
            windowWidth: A4_W_PX,
            windowHeight: A4_H_PX,
          })
        )
      );

      for (let i = 0; i < canvases.length; i++) {
        const img = canvases[i].toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage();
        // Exact A4 fit — same aspect as capture, so no stretching
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
    <div className="h-screen overflow-hidden bg-secondary/40">
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

      <main className="max-w-7xl mx-auto px-6 py-6 grid h-[calc(100vh-64px)] grid-cols-1 grid-rows-[minmax(280px,42vh)_1fr] gap-6 overflow-hidden lg:grid-cols-[420px_1fr] lg:grid-rows-1">
        <aside className="no-print min-h-0 overflow-y-auto pr-2 pb-6">
          <ClientForm value={inputs} onChange={setInputs} />
          <p className="mt-3 text-[11px] text-muted-foreground">
            Tip: edits update the report instantly. Use <strong>Upload XLSX</strong> to load a saved
            Client Data sheet, then download the PDF when you're happy.
          </p>
        </aside>
        <section ref={reportRef} className="min-h-0 space-y-0 overflow-y-auto pb-6">
          <CoverPage s={summary} />
          <WhoWeArePage />
          <SnapshotPage s={summary} />
          <FundsPage s={summary} />
          <ProjectionPage s={summary} />
          <IncomePage s={summary} />
          <ImprovementSummaryPage s={summary} />
          <WhatsNextPage s={summary} />
          
        </section>
      </main>
    </div>
  );
}
