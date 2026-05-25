import { useRef, useState } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Save, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PdfFormEditor, type PdfFormEditorHandle } from "@/components/factfind/PdfFormEditor";

const PDF_URL = "/fact-find.pdf";

export default function FactFind() {
  const editorRef = useRef<PdfFormEditorHandle>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const buildFilename = () => {
    const base = clientName.trim() || "client";
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const ts = new Date().toISOString().slice(0, 10);
    return `fact-find-${slug}-${ts}.pdf`;
  };

  const handleDownload = async () => {
    if (!editorRef.current) return;
    setDownloading(true);
    try {
      const bytes = await editorRef.current.getFilledPdfBytes();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename();
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveToClient = async () => {
    if (!clientName.trim() || !clientEmail.trim()) {
      toast.error("Please enter the client's name and email so we can file this PDF.");
      return;
    }
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const bytes = await editorRef.current.getFilledPdfBytes();
      const filename = buildFilename();
      const path = `${clientEmail.trim().toLowerCase()}/fact-find/${Date.now()}-${filename}`;

      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .upload(path, new Blob([bytes as BlobPart], { type: "application/pdf" }), {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("client_documents").insert({
        client_name: clientName.trim(),
        client_email: clientEmail.trim().toLowerCase(),
        client_phone: clientPhone.trim() || null,
        document_type: "fact_find",
        file_name: filename,
        file_path: path,
        mime_type: "application/pdf",
        file_size: bytes.byteLength,
        status: "received",
        consent_given: true,
        notes: "Fact Find completed in advisor portal",
      });
      if (insErr) throw insErr;

      toast.success(`Fact Find saved to ${clientName}'s documents`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save Fact Find");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fact Find</h1>
            <p className="text-sm text-muted-foreground">
              Fill out the Pure Private Wealth Fact Find directly in the PDF below, then save it to the client's documents.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Client name</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="John Smith" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Client email</Label>
            <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Client phone (optional)</Label>
            <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+61 …" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={handleDownload} disabled={downloading} className="gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>
          <Button onClick={handleSaveToClient} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save to client documents
          </Button>
        </div>

        <PdfFormEditor ref={editorRef} src={PDF_URL} />

        <div className="flex flex-wrap gap-2 justify-end pb-12">
          <Button variant="outline" onClick={handleDownload} disabled={downloading} className="gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>
          <Button onClick={handleSaveToClient} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save to client documents
          </Button>
        </div>
      </div>
    </CRMLayout>
  );
}
