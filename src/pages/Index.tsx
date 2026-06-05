import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/ClientForm";
import { CoverPage, WhoWeArePage, SnapshotPage, FundsPage, ProjectionPage, IncomePage, ImprovementSummaryPage, WhatsNextPage } from "@/components/report/pages";
import { buildSummary } from "@/lib/calc";
import { importFromFile } from "@/lib/xlsx-import";
import { useAuth } from "@/hooks/useAuth";
import { useClientInputs } from "@/hooks/useClientInputs";
import { supabase } from "@/integrations/supabase/client";
import { Maximize2, FileText, Save, X } from "lucide-react";
import { toast } from "sonner";
import { CRMLayout } from "@/components/CRMLayout";
import { moveDealToReportGenerated } from "@/lib/pipeline-auto";
import { saveClientReportSnapshot } from "@/lib/report-persistence";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

import type { ClientInputs } from "@/lib/calc";

function dealExtraFieldsFromInputs(inputs: ClientInputs): Record<string, unknown> {
  const fundNames = [inputs.fundName?.trim(), ...((inputs.additionalFunds ?? []).map(f => f.fundName?.trim()).filter(Boolean) as string[])]
    .filter((s): s is string => !!s);
  const totalBalance = (inputs.superBalance || 0) +
    (inputs.additionalFunds ?? []).reduce((s, f) => s + (f.superBalance || 0), 0);
  return {
    super_fund_name: fundNames.join(", ") || null,
    super_balance: totalBalance > 0 ? totalBalance : null,
    age: inputs.age ? String(inputs.age) : null,
  };
}

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { inputs, setInputs, lookup, editingReportId, setEditingReportId } = useClientInputs();
  const summary = useMemo(() => buildSummary(inputs), [inputs]);
  const fileRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);

  const saveReport = async () => {
    if (!user) {
      toast.error("Please sign in before saving reports");
      return;
    }
    setSaving(true);
    try {
      const clientEmail = (inputs.clientEmail ?? "").trim() || null;
      const savedId = await saveClientReportSnapshot({
        userId: user.id,
        reportId: editingReportId,
        inputs,
        summary,
        research: { text: lookup?.text ?? "", result: lookup?.result ?? null },
        source: "Report Generator",
      });
      if (savedId) setEditingReportId(savedId);
      await supabase.from("activity_log").insert({
        user_id: user.id,
        email: user.email,
        event_type: editingReportId ? "report_updated" : "report_saved",
        details: { client: inputs.clientName.trim() || "Unnamed client", client_email: clientEmail, report_id: savedId },
      });
      await moveDealToReportGenerated({
        clientName: inputs.clientName,
        clientEmail: clientEmail,
        clientPhone: inputs.clientPhone,
        extraFields: dealExtraFieldsFromInputs(inputs),
      });
      toast.success(editingReportId ? "Report updated" : "Client report saved", {
        description: editingReportId
          ? "Your edits have been saved to the client's existing report."
          : "This client is now in your Client Reports list.",
      });
    } catch (e) {
      console.error(e);
      toast.error("Could not save report", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  const exitEditing = () => {
    setEditingReportId(null);
    toast.info("Stopped editing existing report");
  };

  // We store generated PDF artifacts here so the dialog callbacks can use them
  const pendingExport = useRef<{
    pdf: any;
    pdfBlob: Blob;
    ghlBlob: Blob;
    canvases: HTMLCanvasElement[];
    fileName: string;
    safeClient: string;
    pdfPath: string | null;
  } | null>(null);

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
    // Force light mode for the PDF render regardless of the user's current theme
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const prevColorScheme = root.style.colorScheme;
    if (wasDark) {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
      // Allow the browser to recompute styles before snapshotting
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
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
        pdf.addImage(img, "PNG", 0, 0, 210, 297, undefined, "SLOW");
      }

      (pdf as unknown as { setDisplayMode: (zoom: string | number, layout?: string, pmode?: string) => void })
        .setDisplayMode(1, "continuous", "UseNone");
      const safeClient = (inputs.clientName.trim() || "Unnamed client").replace(/[/\\?%*:|"<>]/g, "-");
      const fileName = `${safeClient} Performance Report.pdf`;
      // Always download the PDF immediately
      pdf.save(fileName);

      if (user) {
        const pdfBlob: Blob = pdf.output("blob");
        let ghlBlob: Blob = pdfBlob;

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

        // Upload to storage
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

        // Store pending data and show the dialog
        pendingExport.current = { pdf, pdfBlob, ghlBlob, canvases, fileName, safeClient, pdfPath };
        setShowWorkflowDialog(true);
      } else {
        toast.success("PDF exported");
      }
    } catch (e) {
      console.error(e);
      toast.error("PDF export failed");
    } finally {
      if (wasDark) {
        root.classList.add("dark");
        root.style.colorScheme = prevColorScheme || "dark";
      }
      setExporting(false);
    }
  };

  /** Just save to client reports list — no GHL automation */
  const handleAddToClientList = async () => {
    setShowWorkflowDialog(false);
    if (!user || !pendingExport.current) return;
    const { pdfPath } = pendingExport.current;
    const clientEmail = (inputs.clientEmail ?? "").trim() || null;
    const savedId = await saveClientReportSnapshot({
      userId: user.id,
      reportId: editingReportId,
      inputs,
      summary,
      research: { text: lookup?.text ?? "", result: lookup?.result ?? null },
      pdfPath,
      source: "Report Generator",
    });
    if (savedId) setEditingReportId(savedId);
    await supabase.from("activity_log").insert({
      user_id: user.id, email: user.email, event_type: editingReportId ? "report_updated" : "report_generated",
      details: { client: inputs.clientName, client_email: clientEmail, pdf_path: pdfPath, workflow: false, report_id: savedId },
    });

    pendingExport.current = null;
    await moveDealToReportGenerated({
      clientName: inputs.clientName,
      clientEmail: clientEmail,
      clientPhone: inputs.clientPhone,
      extraFields: dealExtraFieldsFromInputs(inputs),
    });
    toast.success(editingReportId ? "Client report updated" : "Client added to reports list");
  };

  /** Full workflow: save to client list + push to GHL */
  const handleStartWorkflow = async () => {
    setShowWorkflowDialog(false);
    if (!user || !pendingExport.current) return;
    const { ghlBlob, fileName, pdfPath } = pendingExport.current;
    const clientEmail = (inputs.clientEmail ?? "").trim() || null;
    // Log + create/update report row
    const savedId = await saveClientReportSnapshot({
      userId: user.id,
      reportId: editingReportId,
      inputs,
      summary,
      research: lookup?.result ?? null,
      pdfPath,
      source: "Report Generator",
    });
    if (savedId) setEditingReportId(savedId);
    await supabase.from("activity_log").insert({
      user_id: user.id, email: user.email, event_type: editingReportId ? "report_updated" : "report_generated",
      details: { client: inputs.clientName, client_email: clientEmail, pdf_path: pdfPath, workflow: true, report_id: savedId },
    });

    // Push to Go High Level
    if (clientEmail) {
      try {
        const buf = await ghlBlob.arrayBuffer();
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

    pendingExport.current = null;
    await moveDealToReportGenerated({
      clientName: inputs.clientName,
      clientEmail: clientEmail,
      clientPhone: inputs.clientPhone,
      extraFields: dealExtraFieldsFromInputs(inputs),
    });
    toast.success("Workflow started & PDF exported");
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

  const clientDisplayName = inputs.clientName.trim() || "this client";

  return (
    <CRMLayout>
      <div className="min-h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
        <div className="no-print px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 justify-between bg-background/80 dark:bg-background/60 backdrop-blur-xl border-b border-border/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-cyan" />
            </div>
            <span className="text-sm font-semibold text-foreground font-heading truncate">Report Generator</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <input
              ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }}
            />
            <Button variant="outline" size="sm" className="h-9 px-2.5 sm:px-3 hover:bg-muted/50" onClick={() => fileRef.current?.click()}>
              <span className="hidden sm:inline">Upload XLSX</span>
              <span className="sm:hidden">Upload</span>
            </Button>
            {editingReportId && (
              <>
                <Button
                  size="sm"
                  onClick={saveReport}
                  disabled={saving}
                  className="h-9 px-2.5 sm:px-3 bg-emerald-600 text-white hover:bg-emerald-700 border-0 shadow-md"
                >
                  <Save className="w-4 h-4 sm:mr-1.5" />
                   <span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={exitEditing}
                  title="Stop editing existing report"
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
            {!editingReportId && (
              <Button
                size="sm"
                onClick={saveReport}
                disabled={saving}
                className="h-9 px-2.5 sm:px-3 bg-emerald-600 text-white hover:bg-emerald-700 border-0 shadow-md"
              >
                <Save className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
                <span className="sm:hidden">Save</span>
              </Button>
            )}
            <Button size="sm" onClick={exportPDF} disabled={exporting} className="h-9 px-2.5 sm:px-3 gradient-accent text-white border-0 shadow-md shadow-cyan/20 hover:shadow-cyan/30 transition-all">
              {exporting ? "Exporting…" : (
                <>
                  <span className="hidden sm:inline">Download PDF</span>
                  <span className="sm:hidden">PDF</span>
                </>
              )}
            </Button>
            <Button variant="outline" size="icon" className="hidden sm:inline-flex h-9 w-9 hover:bg-muted/50" onClick={openFullScreen} title="Full screen">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="px-3 sm:px-6 py-4 grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-[420px_1fr] lg:h-[calc(100vh-3.5rem-52px)] lg:grid-rows-1 lg:overflow-hidden">
          <aside className="no-print min-h-0 lg:overflow-y-auto lg:pr-2 pb-2 lg:pb-6">
            <ClientForm value={inputs} onChange={setInputs} />
            <p className="mt-3 text-[11px] text-muted-foreground">
              Tip: edits update the report instantly. Click <strong>Save</strong> to add or update the client report, and use <strong>Download PDF</strong> only when you need a copy.
            </p>
          </aside>
          <section ref={reportRef} className="report-preview min-h-0 space-y-0 lg:overflow-y-auto pb-6">
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

      {/* Workflow choice dialog */}
      <AlertDialog open={showWorkflowDialog} onOpenChange={setShowWorkflowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start workflow for {clientDisplayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to start the full workflow (upload to Go High Level) or just add this client to your reports list?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => { setShowWorkflowDialog(false); pendingExport.current = null; }}>
              Cancel
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleAddToClientList}>
              Add to Client List
            </Button>
            <Button onClick={handleStartWorkflow} className="bg-cyan text-cyan-foreground hover:bg-cyan/90">
              Yes, Start Workflow
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CRMLayout>
  );
}
