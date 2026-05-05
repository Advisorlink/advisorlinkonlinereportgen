import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/ClientForm";
import { CoverPage, WhoWeArePage, SnapshotPage, FundsPage, ProjectionPage, IncomePage, ImprovementSummaryPage, WhatsNextPage } from "@/components/report/pages";
import { buildSummary } from "@/lib/calc";
import { importFromFile } from "@/lib/xlsx-import";
import { useAuth } from "@/hooks/useAuth";
import { useClientInputs } from "@/hooks/useClientInputs";
import { supabase } from "@/integrations/supabase/client";
import { Maximize2, Presentation } from "lucide-react";
import { toast } from "sonner";
import { CRMLayout } from "@/components/CRMLayout";

export default function Index() {
  const { user } = useAuth();
  const { inputs, setInputs } = useClientInputs();
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
      const safeClient = (inputs.clientName.trim() || "Unnamed client").replace(/[/\\?%*:|"<>]/g, "-");
      const fileName = `${safeClient} Performance Report.pdf`;
      pdf.save(fileName);

      if (user) {
        const clientEmail = (inputs.clientEmail ?? "").trim() || null;
        const pdfBlob: Blob = pdf.output("blob");
        let ghlBlob: Blob = pdfBlob;

        // GHL rejects uploads over ~5MB. Keep the user's downloaded/stored PDF
        // lossless, but send GHL a compressed copy if the original is too large.
        if (pdfBlob.size > 4.8 * 1024 * 1024) {
          for (const quality of [0.72, 0.58, 0.45, 0.34]) {
            const crmPdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
            for (let i = 0; i < canvases.length; i++) {
              if (i > 0) crmPdf.addPage();
              crmPdf.addImage(canvases[i].toDataURL("image/jpeg", quality), "JPEG", 0, 0, 210, 297, undefined, "FAST");
            }
            const candidate: Blob = crmPdf.output("blob");
            ghlBlob = candidate;
            if (candidate.size <= 4.8 * 1024 * 1024) break;
          }
        }

        // 1) Upload PDF to client's storage folder
        let pdfPath: string | null = null;
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const path = `${user.id}/${safeClient}/${ts} - ${fileName}`;
        const { error: upErr } = await supabase.storage
          .from("client-reports")
          .upload(path, pdfBlob, { contentType: "application/pdf", upsert: false });
        if (upErr) {
          console.error("Storage upload failed:", upErr);
          toast.error("Saved locally, but cloud storage failed");
        } else {
          pdfPath = path;
        }

        // 2) Log + insert report row
        await Promise.all([
          supabase.from("activity_log").insert({
            user_id: user.id, email: user.email, event_type: "report_generated",
            details: { client: inputs.clientName, client_email: clientEmail, pdf_path: pdfPath },
          }),
          supabase.from("reports").insert({
            user_id: user.id,
            email: clientEmail,
            client_name: inputs.clientName.trim() || "Unnamed client",
            inputs: JSON.parse(JSON.stringify(inputs)),
            summary: JSON.parse(JSON.stringify(summary)),
            pdf_path: pdfPath,
          } as never),
        ]);

        // 3) Push to Go High Level if we have an email
        if (clientEmail) {
          try {
            const buf = await ghlBlob.arrayBuffer();
            // base64 encode in chunks to avoid stack overflow
            const bytes = new Uint8Array(buf);
            let binary = "";
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
            }
            const pdfBase64 = btoa(binary);
            const { data: ghl, error: ghlErr } = await supabase.functions.invoke("ghl-upload-report", {
              body: { email: clientEmail, fileName, pdfBase64 },
            });
            if (ghlErr) throw ghlErr;
            if (ghl?.skipped) {
              toast.warning("Go High Level upload skipped", {
                description: ghl.message || (ghl.reason === "file_too_large"
                  ? "The CRM copy is still over Go High Level's file limit."
                  : ghl.reason === "no_contact"
                    ? `No Go High Level contact found for ${clientEmail}.`
                    : "Go High Level could not attach the PDF to this contact."),
              });
            } else if (ghl?.success) {
              toast.success("Uploaded to Go High Level contact");
            }
          } catch (e) {
            console.error("GHL upload failed:", e);
            toast.error("Go High Level upload failed", {
              description: e instanceof Error ? e.message : "Unknown error",
            });
          }
        }
      }
      toast.success("PDF exported");
    } catch (e) {
      console.error(e);
      toast.error("PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  const openFullScreen = () => {
    const el = reportRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.().catch(() => toast.error("Full screen not available"));
    }
  };

  return (
    <CRMLayout>
      <div className="h-[calc(100vh-48px)] overflow-hidden">
        <div className="no-print px-4 py-2 flex items-center justify-between bg-white border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy">Report Generator</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Upload XLSX
            </Button>
            <Button size="sm" onClick={exportPDF} disabled={exporting} className="bg-cyan text-cyan-foreground hover:bg-cyan/90">
              {exporting ? "Exporting…" : "Download PDF"}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={openFullScreen} title="Full screen">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="px-6 py-4 grid h-[calc(100vh-48px-52px)] grid-cols-1 grid-rows-[minmax(280px,42vh)_1fr] gap-6 overflow-hidden lg:grid-cols-[420px_1fr] lg:grid-rows-1">
          <aside className="no-print min-h-0 overflow-y-auto pr-2 pb-6">
            <ClientForm value={inputs} onChange={setInputs} />
            <p className="mt-3 text-[11px] text-muted-foreground">
              Tip: edits update the report instantly. Use <strong>Upload XLSX</strong> to load a saved
              Client Data sheet, then download the PDF when you're happy.
            </p>
          </aside>
          <section ref={reportRef} className="min-h-0 space-y-0 overflow-y-auto pb-6">
            <CoverPage s={summary} />
            <WhoWeArePage s={summary} />
            <SnapshotPage s={summary} />
            <ProjectionPage s={summary} />
            <FundsPage s={summary} />
            <IncomePage s={summary} />
            <ImprovementSummaryPage s={summary} />
            <WhatsNextPage s={summary} />
          </section>
        </div>
      </div>
    </CRMLayout>
  );
}
