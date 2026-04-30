import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/ClientForm";
import { CoverPage, WhoWeArePage, SnapshotPage, FundsPage, ProjectionPage, IncomePage, ImprovementSummaryPage, WhatsNextPage } from "@/components/report/pages";
import { buildSummary, type ClientInputs } from "@/lib/calc";
import { DEFAULT_INPUTS, importFromFile } from "@/lib/xlsx-import";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function Index() {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
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
      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
      });

      // Render all pages to canvases in parallel — massive speed win vs sequential.
      // scale: 3 → ~450 DPI on A4 (210mm wide → ~2480px), giving razor-sharp,
      // near-vector text clarity. PNG (lossless) preserves crisp edges on text and
      // thin lines that JPEG would smear with compression artifacts. Combined with
      // parallel rendering + jsPDF's internal flate compression, the result is a
      // pixel-perfect PDF that still downloads quickly.
      const canvases = await Promise.all(
        pages.map((page) =>
          html2canvas(page, {
            scale: 3,
            backgroundColor: "#ffffff",
            useCORS: true,
            imageTimeout: 0,
            logging: false,
            letterRendering: true,
            windowWidth: page.scrollWidth,
            windowHeight: page.scrollHeight,
          } as Parameters<typeof html2canvas>[1])
        )
      );

      for (let i = 0; i < canvases.length; i++) {
        const img = canvases[i].toDataURL("image/png");
        if (i > 0) pdf.addPage();
        // "SLOW" enables jsPDF's better PNG compression — smaller file, same quality.
        pdf.addImage(img, "PNG", 0, 0, 210, 297, undefined, "SLOW");
      }
      // Set the default open view to "Actual Size" (100% zoom) when the PDF is opened.
      // /XYZ null null null preserves position; the magnification "null" combined with
      // PageMode keeps viewers from auto-fitting. We also set OpenAction to use a
      // zoom of 1 (100%) explicitly via the viewer preferences.
      const anyPdf = pdf as unknown as {
        internal: { write: (s: string) => void };
        _jsPDF?: unknown;
      };
      // jsPDF exposes setDisplayMode for this purpose
      (pdf as unknown as { setDisplayMode: (zoom: string | number, layout?: string, pmode?: string) => void })
        .setDisplayMode(1, "continuous", "UseNone");
      pdf.save(`${inputs.clientName.trim()} Performance Report.pdf`);
      if (user) {
        await supabase.from("activity_log").insert({
          user_id: user.id, email: user.email, event_type: "report_generated",
          details: { client: inputs.clientName },
        });
      }
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
            <Button variant="outline" size="icon" className="bg-transparent text-navy-foreground border-white/20 hover:bg-white/10" onClick={() => nav("/admin")} title="Admin">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="bg-transparent text-navy-foreground border-white/20 hover:bg-white/10" onClick={signOut} title="Sign out">
              <LogOut className="w-4 h-4" />
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
          <ProjectionPage s={summary} />
          <FundsPage s={summary} />
          <IncomePage s={summary} />
          <ImprovementSummaryPage s={summary} />
          <WhatsNextPage s={summary} />
          
        </section>
      </main>
    </div>
  );
}
