import { useState, useEffect } from "react";
import { ArrowLeft, Upload, ArrowRight, Search, User, UserPlus, FileText, CheckCircle2, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ESignPdfEditor, type ESignField } from "./ESignPdfEditor";

interface ReportRow {
  id: string;
  client_name: string;
  email: string | null;
  inputs: Record<string, any> | null;
}

type Step = "upload" | "select-client" | "fill-details" | "edit-pdf" | "confirm-send";

export function ESignNewRequest({ onBack, initialFile, initialFileName }: {
  onBack: () => void;
  initialFile?: File | null;
  initialFileName?: string;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(initialFile ? "select-client" : "upload");
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [editedFile, setEditedFile] = useState<File | null>(null);
  const [esignFields, setEsignFields] = useState<ESignField[]>([]);
  const [fileName, setFileName] = useState(initialFileName || "");

  // Client selection
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  // Client details (editable)
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDob, setClientDob] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  // Confirm send
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [sending, setSending] = useState(false);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select("id, client_name, email, inputs")
      .order("created_at", { ascending: false });
    if (data) setReports(data as ReportRow[]);
  };

  const filteredReports = reports.filter((r) =>
    r.client_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.email && r.email.toLowerCase().includes(search.toLowerCase()))
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      setEditedFile(null);
      setEsignFields([]);
      setFileName(f.name);
    } else {
      toast.error("Please upload a PDF file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      setEditedFile(null);
      setEsignFields([]);
      setFileName(f.name);
    } else {
      toast.error("Please upload a PDF file");
    }
  };

  const handleSelectClient = (report: ReportRow) => {
    setSelectedReport(report);
    setIsGuest(false);
    const inputs = report.inputs || {};
    setClientName(report.client_name || "");
    setClientEmail(report.email || (inputs as any).email || "");
    setClientPhone((inputs as any).clientPhone || (inputs as any).phone || (inputs as any).mobile || "");
    setClientAddress((inputs as any).address || "");
    setClientDob((inputs as any).dob || (inputs as any).date_of_birth || "");
    setStep("fill-details");
  };

  const handleGuestSelect = () => {
    setSelectedReport(null);
    setIsGuest(true);
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientDob("");
    setClientAddress("");
    setStep("fill-details");
  };

  const handleProceedToSend = () => {
    if (!clientName.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (!clientEmail.trim()) {
      toast.error("Client email is required");
      return;
    }
    setConfirmEmail(clientEmail);
    setShowEmailConfirm(true);
  };

  const handleSendDocument = async () => {
    const fileToUpload = editedFile || file;
    if (!fileToUpload || !user) return;
    setSending(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${fileToUpload.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("esign-documents")
        .upload(filePath, fileToUpload);
      if (uploadErr) throw uploadErr;

      const { data: doc, error: docErr } = await supabase
        .from("esign_documents")
        .insert({
          host_user_id: user.id,
          document_name: fileName,
          original_pdf_path: filePath,
          status: "sent",
          client_name: clientName,
          client_email: confirmEmail,
          client_phone: clientPhone,
          client_address: clientAddress,
          client_data: {
            name: clientName,
            email: confirmEmail,
            phone: clientPhone,
            address: clientAddress,
            dob: clientDob,
            signing_fields: esignFields,
          },
          report_id: selectedReport?.id || null,
          sent_at: new Date().toISOString(),
        } as any)
        .select("id, signing_token")
        .single();

      if (docErr) throw docErr;

      const signingUrl = `${window.location.origin}/esign/sign?token=${doc.signing_token}`;
      
      await supabase.functions.invoke("send-esign-email", {
        body: {
          to: confirmEmail,
          clientName,
          signingUrl,
          documentName: fileName,
        },
      });

      toast.success("Document sent for e-signature!");
      setShowEmailConfirm(false);
      onBack();
    } catch (err: any) {
      toast.error(err.message || "Failed to send document");
    } finally {
      setSending(false);
    }
  };

  const stepOrder: Step[] = ["upload", "select-client", "fill-details", "edit-pdf"];
  const stepLabels: Record<Step, string> = {
    "upload": "Upload",
    "select-client": "Client",
    "fill-details": "Details",
    "edit-pdf": "Prepare",
    "confirm-send": "Send",
  };

  const currentStepIndex = stepOrder.indexOf(step);

  return (
    <div className={`${step === "edit-pdf" ? "max-w-7xl" : "max-w-3xl"} mx-auto py-8 px-4`}>
      {/* Back button */}
      <button
        onClick={onBack}
        className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Back to E-Sign Centre
      </button>

      {/* Modern Step Indicator */}
      <div className="flex items-center gap-0 mb-10">
        {stepOrder.map((s, i) => {
          const isActive = step === s;
          const isCompleted = currentStepIndex > i;
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2.5">
                <div
                  className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isActive
                      ? "bg-cyan text-white shadow-lg shadow-cyan/30 scale-110"
                      : isCompleted
                      ? "bg-cyan/15 text-cyan"
                      : "bg-muted/60 text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-sm font-medium hidden sm:inline transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {stepLabels[s]}
                </span>
              </div>
              {i < stepOrder.length - 1 && (
                <div className="flex-1 mx-3">
                  <div className={`h-0.5 rounded-full transition-colors duration-300 ${
                    isCompleted ? "bg-cyan/40" : "bg-border"
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Upload Document</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload the PDF document that needs to be signed
            </p>
          </div>

          <label
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`group relative flex flex-col items-center justify-center gap-5 p-14 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
              isDragging
                ? "border-cyan bg-cyan/10 scale-[1.01]"
                : file
                ? "border-cyan/40 bg-cyan/5"
                : "border-border hover:border-cyan/40 hover:bg-cyan/5"
            }`}
          >
            {file ? (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan/10 ring-1 ring-cyan/20">
                  <FileText className="w-8 h-8 text-cyan" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground text-lg">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">Click or drag to replace</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 group-hover:bg-cyan/10 transition-colors">
                  <CloudUpload className="w-8 h-8 text-muted-foreground group-hover:text-cyan transition-colors" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground text-lg">
                    Drop your PDF here or <span className="text-cyan">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">Only PDF files accepted • Max 20MB</p>
                </div>
              </>
            )}
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
          </label>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setStep("select-client")}
              disabled={!file}
              className="gap-2 h-11 px-6 rounded-xl bg-cyan hover:bg-cyan/90 text-white shadow-lg shadow-cyan/20 disabled:shadow-none transition-all"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Select Client */}
      {step === "select-client" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Select Client</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a client from your reports or enter details manually
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>

          <button
            onClick={handleGuestSelect}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-border hover:border-cyan/40 hover:bg-cyan/5 transition-all group"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/10 group-hover:bg-cyan/15 transition-colors">
              <UserPlus className="w-5 h-5 text-cyan" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Guest / Manual Entry</p>
              <p className="text-xs text-muted-foreground">Enter client details manually</p>
            </div>
          </button>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredReports.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelectClient(r)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-cyan/40 hover:bg-cyan/5 hover:shadow-sm transition-all text-left group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 group-hover:bg-cyan/10 transition-colors">
                  <User className="w-4.5 h-4.5 text-muted-foreground group-hover:text-cyan transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email || "No email on file"}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
            {filteredReports.length === 0 && (
              <div className="text-center py-10">
                <User className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No clients found</p>
              </div>
            )}
          </div>

          <div className="flex justify-start pt-2">
            <Button variant="outline" onClick={() => setStep("upload")} className="rounded-xl h-11">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Fill Details */}
      {step === "fill-details" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {isGuest ? "Enter Client Details" : "Confirm Client Details"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isGuest
                ? "Fill in the client information below"
                : "Review and edit the pre-filled details — these will auto-fill the PDF"}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/50 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-cyan" /> Primary Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Full Name *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="John Smith" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email *</Label>
                <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="john@example.com" type="email" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone Number</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="0400 000 000" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="123 Main St, Sydney NSW" className="rounded-xl h-11" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-muted-foreground" /> Second Signatory
              <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-1">Optional</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input value={clientName} disabled className="bg-muted/50 rounded-xl h-11" />
                <p className="text-[10px] text-muted-foreground">Auto-filled from above</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                <Input value={clientDob} onChange={(e) => setClientDob(e.target.value)} placeholder="DD/MM/YYYY" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input value={clientAddress} disabled className="bg-muted/50 rounded-xl h-11" />
                <p className="text-[10px] text-muted-foreground">Auto-filled from above</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep("select-client")} className="rounded-xl h-11">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={() => {
              if (!clientName.trim()) { toast.error("Client name is required"); return; }
              if (!clientEmail.trim()) { toast.error("Client email is required"); return; }
              setStep("edit-pdf");
            }} className="gap-2 h-11 px-6 rounded-xl bg-cyan hover:bg-cyan/90 text-white shadow-lg shadow-cyan/20 transition-all">
              Prepare Document <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Edit PDF */}
      {step === "edit-pdf" && file && (
        <ESignPdfEditor
          file={file}
          clientName={clientName}
          clientEmail={clientEmail}
          clientPhone={clientPhone}
          clientAddress={clientAddress}
          clientDob={clientDob}
          onBack={() => setStep("fill-details")}
          onContinue={(edited, fields) => {
            setEditedFile(edited);
            setEsignFields(fields);
            handleProceedToSend();
          }}
        />
      )}

      {/* Email Confirmation Dialog */}
      <Dialog open={showEmailConfirm} onOpenChange={setShowEmailConfirm}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Email Address</DialogTitle>
            <DialogDescription>
              Verify the recipient email before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs text-muted-foreground">Recipient Email</Label>
            <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className="rounded-xl h-11" />
            <p className="text-xs text-muted-foreground">
              Sending <span className="font-semibold text-foreground">{fileName}</span> to <span className="font-semibold text-foreground">{clientName}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailConfirm(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSendDocument} disabled={sending} className="rounded-xl bg-cyan hover:bg-cyan/90 text-white">
              {sending ? "Sending..." : "Send Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
