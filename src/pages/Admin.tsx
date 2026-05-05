import { useEffect, useMemo, useRef, useState } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientInputs } from "@/hooks/useClientInputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, RefreshCw, Search, Eye, Download, Send, X, FileText, Calendar, Mail } from "lucide-react";
import { buildSummary, type ClientInputs } from "@/lib/calc";
import { buildReferralEmailHtml } from "@/lib/referral-email-template";
import { DEFAULT_INPUTS } from "@/lib/xlsx-import";
import {
  CoverPage, WhoWeArePage, SnapshotPage, FundsPage,
  ProjectionPage, IncomePage, ImprovementSummaryPage, WhatsNextPage,
} from "@/components/report/pages";

interface ReportRow {
  id: string;
  user_id: string;
  email: string | null;
  client_name: string;
  inputs: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  created_at: string;
  pdf_path: string | null;
}

export default function Admin() {
  const nav = useNavigate();
  const location = useLocation();
  const presentationState = location.state as { fromPresentation?: boolean; pausedSlide?: number } | null;
  const isFromPresentation = presentationState?.fromPresentation === true;

  const handleResumePresentation = () => {
    nav("/presentations", { state: { resumeSlide: presentationState?.pausedSlide ?? 0 } });
  };
  const { profile, loading } = useAuth();
  const { setInputs } = useClientInputs();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportSearch, setReportSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const pdfStageRef = useRef<HTMLDivElement>(null);
  const [pdfStageInputs, setPdfStageInputs] = useState<ClientInputs | null>(null);

  const resolveInputs = (r: ReportRow): ClientInputs => {
    const saved = (r.inputs && typeof r.inputs === "object" ? r.inputs : {}) as Partial<ClientInputs>;
    return { ...DEFAULT_INPUTS, ...saved, clientName: saved.clientName || r.client_name } as ClientInputs;
  };

  const viewReport = (r: ReportRow) => {
    setInputs(resolveInputs(r));
    toast.success(`Loaded ${r.client_name}`);
    nav("/");
  };

  useEffect(() => {
    if (!loading && !profile?.is_owner) {
      toast.error("Owner access required");
      nav("/", { replace: true });
    }
  }, [profile, loading, nav]);

  const refresh = async () => {
    setBusy(true);
    const { data: r } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setReports((r as ReportRow[]) || []);
    setBusy(false);
  };

  useEffect(() => {
    if (profile?.is_owner) refresh();
  }, [profile]);

  const deleteReport = async (id: string) => {
    if (!confirm("Delete this saved report?")) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Report deleted"); refresh(); }
  };

  const downloadReportPdf = async (r: ReportRow) => {
    if (r.pdf_path) {
      setPdfBusyId(r.id);
      try {
        const { data, error } = await supabase.storage
          .from("client-reports")
          .download(r.pdf_path);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${r.client_name.trim()} Performance Report.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("PDF downloaded");
        setPdfBusyId(null);
        return;
      } catch (e) {
        console.error("Stored PDF download failed, regenerating:", e);
      }
    }
    setPdfBusyId(r.id);
    setPdfStageInputs(resolveInputs(r));
    try {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const root = pdfStageRef.current;
      if (!root) throw new Error("Report not ready");
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const pages = Array.from(root.querySelectorAll(".report-page")) as HTMLElement[];
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      const canvases = await Promise.all(
        pages.map(p => html2canvas(p, {
          scale: 3, backgroundColor: "#ffffff", useCORS: true, imageTimeout: 0, logging: false,
          windowWidth: p.scrollWidth, windowHeight: p.scrollHeight,
        } as Parameters<typeof html2canvas>[1]))
      );
      for (let i = 0; i < canvases.length; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(canvases[i].toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "SLOW");
      }
      pdf.save(`${r.client_name.trim()} Performance Report.pdf`);
      toast.success("PDF exported");
    } catch (e) {
      console.error(e);
      toast.error("PDF export failed");
    } finally {
      setPdfBusyId(null);
      setPdfStageInputs(null);
    }
  };

  const [sendBusyId, setSendBusyId] = useState<string | null>(null);

  const [emailDialog, setEmailDialog] = useState<{
    open: boolean;
    report: ReportRow | null;
    to: string;
    subject: string;
    body: string;
    htmlBody?: string;
    isHtml?: boolean;
  }>({ open: false, report: null, to: "", subject: "", body: "" });

  const getFirstName = (fullName: string) => {
    const trimmed = (fullName ?? "").trim();
    if (!trimmed) return "there";
    return trimmed.split(/\s+/)[0];
  };

  const getTemplateBody = (templateKey: string, r: ReportRow) => {
    const firstName = getFirstName(r.client_name);
    const inputs = resolveInputs(r);
    const summary = buildSummary(inputs);
    const potentialExtra = summary.potentialUplift != null
      ? `$${Math.round(summary.potentialUplift).toLocaleString()}`
      : "(Potential Extra Amount)";
    const retirementAge = inputs.retirementAge ?? "(Target Retirement Age)";

    switch (templateKey) {
      case "follow-up":
        return `Hi ${firstName},\n\nHere is your performance report that you requested. I have tried reaching out a few times because I said I would personally give you a call if there were any concerns. As you can see, there is a potential extra of ${potentialExtra} in your super by the age of ${retirementAge}, so I'm sure you would agree that is a fair bit of money back in your pocket. Please let me know when you have a spare 5 minutes that I can at least let you know what your options are and run you through it properly so at least you know what's going on, and then you can do what you like with that information.\n\nWe are available Monday - Friday 9am - 7pm QLD time.\n\nPlease let me know a time that works for you and I'll work something out in between clients,\n\nOr call me on\n\n0485991688`;
      case "referral":
        return `Hi ${firstName},\n\nDo you know 5 people that would like a free performance report like you got? Give them a call and ask if they'd like us to send them one. If you can get 5, you'll get a $100 Gift Card!! It's that simple.\n\nYou just need to give us permission to say that you have referred them and that's it!! $100 is all yours!\n\nBUT WAIT THERE'S MORE HAHA\n\nIf any of your referrals choose to take on board the advice like you have, you receive a $100 GIFT CARD PER REFERRAL!!!\n\nWe are available Monday - Friday 9am - 7pm QLD time.\n\nOr call me on\n\n0485991688`;
      case "standard":
      default:
        return `Hi ${firstName},\n\nHere is your free performance report. Please note that this document is NOT to be taken as financial advice. It is just to help you understand if there are potential improvements you could be missing out on.`;
    }
  };

  const EMAIL_TEMPLATES = [
    { key: "standard", label: "Standard - Free Report" },
    { key: "follow-up", label: "Follow-Up - Call Request" },
    { key: "referral", label: "Referral - $100 Gift Card" },
  ];

  const [selectedTemplate, setSelectedTemplate] = useState("standard");

  const openEmailDialog = (r: ReportRow) => {
    const clientEmail = (r.email ?? "").trim();
    if (!clientEmail) {
      toast.error("No email address on file for this client");
      return;
    }
    setSelectedTemplate("standard");
    setEmailDialog({
      open: true,
      report: r,
      to: clientEmail,
      subject: "Super Performance Report",
      body: getTemplateBody("standard", r),
    });
  };

  const applyTemplate = (templateKey: string) => {
    if (!emailDialog.report) return;
    setSelectedTemplate(templateKey);
    const clientName = emailDialog.report.client_name;
    const isReferral = templateKey === "referral";
    setEmailDialog(prev => ({
      ...prev,
      body: getTemplateBody(templateKey, prev.report!),
      subject: isReferral ? "Get a $100 Gift Card - Referral Offer" : "Super Performance Report",
      htmlBody: isReferral ? buildReferralEmailHtml(clientName) : undefined,
      isHtml: isReferral,
    }));
  };

  const closeEmailDialog = () => setEmailDialog(prev => ({ ...prev, open: false, report: null }));

  const confirmSendEmail = async () => {
    const r = emailDialog.report;
    if (!r) return;
    closeEmailDialog();
    setSendBusyId(r.id);
    try {
      const shouldAttachPdf = !emailDialog.isHtml;
      let pdfBlob: Blob | null = null;
      if (shouldAttachPdf && r.pdf_path) {
        const { data, error } = await supabase.storage
          .from("client-reports")
          .download(r.pdf_path);
        if (!error && data) pdfBlob = data;
      }
      if (shouldAttachPdf && !pdfBlob) {
        setPdfStageInputs(resolveInputs(r));
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        const root = pdfStageRef.current;
        if (!root) throw new Error("Report not ready");
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);
        const pages = Array.from(root.querySelectorAll(".report-page")) as HTMLElement[];
        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
        const canvases = await Promise.all(
          pages.map(p => html2canvas(p, {
            scale: 3, backgroundColor: "#ffffff", useCORS: true, imageTimeout: 0, logging: false,
            windowWidth: p.scrollWidth, windowHeight: p.scrollHeight,
          } as Parameters<typeof html2canvas>[1]))
        );
        for (let i = 0; i < canvases.length; i++) {
          if (i > 0) pdf.addPage();
          pdf.addImage(canvases[i].toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "SLOW");
        }
        pdfBlob = pdf.output("blob");
        setPdfStageInputs(null);
      }

      let pdfBase64: string | undefined;
      let fileName: string | undefined;
      if (shouldAttachPdf && pdfBlob) {
        const buf = await pdfBlob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        pdfBase64 = btoa(binary);
        fileName = `${(r.client_name.trim() || "Client")} Performance Report.pdf`;
      }

      const { data, error } = await supabase.functions.invoke("send-report-email", {
        body: {
          recipientEmail: emailDialog.to,
          clientName: r.client_name.trim(),
          pdfBase64,
          fileName,
          customBody: emailDialog.isHtml ? emailDialog.htmlBody : emailDialog.body,
          isHtml: emailDialog.isHtml ?? false,
          customSubject: emailDialog.subject,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(shouldAttachPdf ? `Email sent to ${emailDialog.to} with PDF attached` : `Gift card email sent to ${emailDialog.to}`);
    } catch (e) {
      console.error("Send email failed:", e);
      toast.error("Failed to send email", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSendBusyId(null);
    }
  };

  const filteredReports = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(r =>
      r.client_name.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q),
    );
  }, [reports, reportSearch]);

  if (loading || !profile?.is_owner) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Verifying…</div>;
  }

  return (
    <CRMLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan to-[hsl(215_60%_12%)] flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-heading text-navy tracking-tight">Client Reports</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isFromPresentation && (
              <Button
                size="sm"
                onClick={handleResumePresentation}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 animate-pulse"
              >
                <Presentation className="w-4 h-4" />
                Resume Presentation
              </Button>
            )}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={reportSearch}
                onChange={e => setReportSearch(e.target.value)}
                placeholder="Search clients…"
                className="pl-9 bg-white border-border/60 shadow-sm"
              />
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={refresh}
              disabled={busy}
              className="shrink-0 h-10 w-10 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-elevated border border-border/40 p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">
              {reportSearch ? "No reports match your search" : "No reports generated yet"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {reportSearch ? "Try a different search term" : "Reports will appear here once created"}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredReports.map((r, i) => (
              <div
                key={r.id}
                className="group bg-white rounded-2xl border border-border/40 shadow-sm hover:shadow-elevated transition-all duration-300 hover:border-cyan/30 overflow-hidden"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
                  {/* Client Avatar & Name */}
                  <div className="flex items-center gap-3.5 sm:w-56 shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-navy to-navy/80 flex items-center justify-center text-white font-bold text-base shadow-md shrink-0">
                      {r.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy text-sm leading-tight truncate">
                        {r.client_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3 text-muted-foreground/60" />
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Client Email */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {r.email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs truncate">{r.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3.5 text-xs font-medium border-border/60 hover:bg-secondary/80 shadow-sm"
                      onClick={() => viewReport(r)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 px-3.5 text-xs font-medium bg-navy text-white hover:bg-navy/90 shadow-sm"
                      onClick={() => downloadReportPdf(r)}
                      disabled={pdfBusyId === r.id}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      {pdfBusyId === r.id ? "Exporting…" : "PDF"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 px-3.5 text-xs font-medium bg-cyan text-white hover:bg-cyan/90 shadow-sm"
                      onClick={() => openEmailDialog(r)}
                      disabled={sendBusyId === r.id}
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      {sendBusyId === r.id ? "Sending…" : "Send"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteReport(r.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Email compose dialog ---- */}
      {emailDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-1.5rem)] overflow-y-auto p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-heading text-navy">Compose Email</h3>
              <button onClick={closeEmailDialog} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Template</label>
                <select
                  value={selectedTemplate}
                  onChange={e => applyTemplate(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {EMAIL_TEMPLATES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">To</label>
                <Input
                  value={emailDialog.to}
                  onChange={e => setEmailDialog(prev => ({ ...prev, to: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Subject</label>
                <Input
                  value={emailDialog.subject}
                  onChange={e => setEmailDialog(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              {emailDialog.isHtml ? (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Preview (Designed Template)</label>
                  <div className="rounded-lg border border-input overflow-hidden h-[58vh] max-h-[520px] min-h-[280px]">
                    <iframe
                      srcDoc={emailDialog.htmlBody}
                      title="Email preview"
                      className="w-full border-0"
                      style={{ height: "100%" }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Designed HTML email preview. The gift-card template sends without the PDF attached.</p>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Message</label>
                  <Textarea
                    value={emailDialog.body}
                    onChange={e => setEmailDialog(prev => ({ ...prev, body: e.target.value }))}
                    rows={10}
                    className="resize-y"
                  />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground italic">
                {emailDialog.isHtml ? "No PDF will be attached" : "PDF report will be attached automatically"} &bull; Your Gmail signature will be appended
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={closeEmailDialog}>Cancel</Button>
              <Button size="sm" onClick={confirmSendEmail} className="bg-cyan text-white hover:bg-cyan/90">
                <Send className="w-3.5 h-3.5 mr-1" /> Send Email
              </Button>
            </div>
          </div>
        </div>
      )}

      {pdfStageInputs && (() => {
        const summary = buildSummary(pdfStageInputs);
        return (
          <div
            aria-hidden
            style={{ position: "fixed", left: -100000, top: 0, width: 794, pointerEvents: "none" }}
          >
            <div ref={pdfStageRef} className="bg-white">
              <CoverPage s={summary} />
              <WhoWeArePage s={summary} />
              <SnapshotPage s={summary} />
              <ProjectionPage s={summary} />
              <FundsPage s={summary} />
              <IncomePage s={summary} />
              <ImprovementSummaryPage s={summary} />
              <WhatsNextPage s={summary} />
            </div>
          </div>
        );
      })()}
    </CRMLayout>
  );
}