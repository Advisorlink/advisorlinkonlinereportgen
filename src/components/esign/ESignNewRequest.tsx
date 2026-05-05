import { useState, useEffect } from "react";
import { ArrowLeft, Upload, ArrowRight, Search, User, UserPlus } from "lucide-react";
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

export function ESignNewRequest({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [editedFile, setEditedFile] = useState<File | null>(null);
  const [esignFields, setEsignFields] = useState<ESignField[]>([]);
  const [fileName, setFileName] = useState("");

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

  return (
    <div className={`${step === "edit-pdf" ? "max-w-7xl" : "max-w-3xl"} mx-auto py-6 px-4`}>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to E-Sign Docs
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {stepOrder.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step === s ? "bg-cyan text-white" : 
              (stepOrder.indexOf(step) > i ? "bg-cyan/20 text-cyan" : "bg-muted text-muted-foreground")
            }`}>
              {i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:inline ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
              {stepLabels[s]}
            </span>
            {i < stepOrder.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Upload Document</h2>
          <p className="text-sm text-muted-foreground">Upload the PDF document that needs to be signed</p>

          <label className="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:border-cyan/40 hover:bg-cyan/5 transition-all">
            <Upload className="w-12 h-12 text-muted-foreground" />
            {file ? (
              <div className="text-center">
                <p className="font-semibold text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground mt-1">Click to change file</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-semibold text-foreground">Click to upload PDF</p>
                <p className="text-xs text-muted-foreground mt-1">Only PDF files accepted</p>
              </div>
            )}
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
          </label>

          <div className="flex justify-end">
            <Button onClick={() => setStep("select-client")} disabled={!file} className="gap-2">
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Select Client */}
      {step === "select-client" && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Select Client</h2>
          <p className="text-sm text-muted-foreground">Choose a client from your reports or enter details as a guest</p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <button
            onClick={handleGuestSelect}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-border hover:border-cyan/40 hover:bg-cyan/5 transition-all"
          >
            <UserPlus className="w-5 h-5 text-cyan" />
            <div className="text-left">
              <p className="font-semibold text-foreground">Guest / Manual Entry</p>
              <p className="text-xs text-muted-foreground">Enter client details manually</p>
            </div>
          </button>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredReports.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelectClient(r)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-cyan/40 hover:bg-cyan/5 transition-all text-left"
              >
                <User className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email || "No email"}</p>
                </div>
              </button>
            ))}
            {filteredReports.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No clients found</p>
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
          </div>
        </div>
      )}

      {/* Step 3: Fill Details */}
      {step === "fill-details" && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">
            {isGuest ? "Enter Client Details" : "Confirm Client Details"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isGuest ? "Fill in the client information" : "Review and edit the pre-filled details. These will be used to auto-fill the PDF."}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="john@example.com" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="0400 000 000" />
            </div>
            <div className="space-y-2">
              <Label>Address *</Label>
              <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="123 Main St, Sydney NSW" />
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl border border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground mb-3">Second Signatory (if applicable)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={clientName} disabled className="bg-muted/50" />
                <p className="text-xs text-muted-foreground">Auto-filled from above</p>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input value={clientDob} onChange={(e) => setClientDob(e.target.value)} placeholder="DD/MM/YYYY" />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={clientAddress} disabled className="bg-muted/50" />
                <p className="text-xs text-muted-foreground">Auto-filled from above</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("select-client")}>Back</Button>
            <Button onClick={() => {
              if (!clientName.trim()) { toast.error("Client name is required"); return; }
              if (!clientEmail.trim()) { toast.error("Client email is required"); return; }
              setStep("edit-pdf");
            }} className="gap-2">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Email Address</DialogTitle>
            <DialogDescription>
              Is this the correct email to send the document to?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Recipient Email</Label>
            <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Sending <span className="font-semibold">{fileName}</span> to <span className="font-semibold">{clientName}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailConfirm(false)}>Cancel</Button>
            <Button onClick={handleSendDocument} disabled={sending}>
              {sending ? "Sending..." : "Send Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
