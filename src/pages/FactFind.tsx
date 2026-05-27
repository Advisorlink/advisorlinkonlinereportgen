import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CRMLayout } from "@/components/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Save, FileText, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PdfFormEditor, type PdfFormEditorHandle } from "@/components/factfind/PdfFormEditor";
import { useClientInputs } from "@/hooks/useClientInputs";

const BLANK_PDF_URL = "/fact-find.pdf";

type EditingDoc = {
  id: string;
  file_path: string;
  file_name: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
};

export default function FactFind() {
  const editorRef = useRef<PdfFormEditorHandle>(null);
  const { inputs } = useClientInputs();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  // Stable key for auto-persisting in-progress form work so navigation away
  // doesn't wipe the user's answers.
  const draftKey = editId ? `factfind:${editId}` : "factfind:new";
  const headerDraftKey = `${draftKey}:header`;

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EditingDoc | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string>(BLANK_PDF_URL);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [headerHydrated, setHeaderHydrated] = useState(false);

  // Restore saved client header (name/email/phone) on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(headerDraftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.clientName) setClientName(d.clientName);
        if (d.clientEmail) setClientEmail(d.clientEmail);
        if (d.clientPhone) setClientPhone(d.clientPhone);
      }
    } catch {}
    setHeaderHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerDraftKey]);

  // Persist header as it changes.
  useEffect(() => {
    if (!headerHydrated) return;
    try {
      localStorage.setItem(
        headerDraftKey,
        JSON.stringify({ clientName, clientEmail, clientPhone }),
      );
    } catch {}
  }, [headerHydrated, headerDraftKey, clientName, clientEmail, clientPhone]);

  // Prefill from client inputs (e.g. set during presentation / report flow)
  // when not editing an existing saved PDF and no draft was restored.
  useEffect(() => {
    if (editId) return;
    if (!clientName && inputs.clientName && inputs.clientName !== "New Client") {
      setClientName(inputs.clientName);
    }
    if (!clientEmail && inputs.clientEmail) setClientEmail(inputs.clientEmail);
    if (!clientPhone && inputs.clientPhone) setClientPhone(inputs.clientPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.clientName, inputs.clientEmail, inputs.clientPhone, editId]);

  // Load existing document for editing.
  useEffect(() => {
    let cancelled = false;
    if (!editId) {
      setEditingDoc(null);
      setPdfSrc(BLANK_PDF_URL);
      return;
    }
    (async () => {
      setLoadingEdit(true);
      try {
        const { data, error } = await supabase
          .from("client_documents")
          .select("id,file_path,file_name,client_name,client_email,client_phone")
          .eq("id", editId)
          .single();
        if (error) throw error;
        const { data: signed, error: sErr } = await supabase.storage
          .from("client-documents")
          .createSignedUrl(data.file_path, 60 * 30);
        if (sErr || !signed?.signedUrl) throw sErr || new Error("Cannot load file");
        if (cancelled) return;
        setEditingDoc(data as EditingDoc);
        setClientName(data.client_name || "");
        setClientEmail(data.client_email || "");
        setClientPhone(data.client_phone || "");
        setPdfSrc(signed.signedUrl);
      } catch (e: any) {
        toast.error(e?.message || "Couldn't open this document for editing");
        setSearchParams({}, { replace: true });
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId, setSearchParams]);

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
      a.download = editingDoc?.file_name || buildFilename();
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
      const filename = editingDoc?.file_name || buildFilename();
      const path = `${clientEmail.trim().toLowerCase()}/fact-find/${Date.now()}-${filename}`;

      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .upload(path, new Blob([bytes as BlobPart], { type: "application/pdf" }), {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) throw upErr;

      if (editingDoc) {
        // Update existing record to point to new version
        const { error: updErr } = await supabase
          .from("client_documents")
          .update({
            file_path: path,
            file_name: filename,
            file_size: bytes.byteLength,
            client_name: clientName.trim(),
            client_email: clientEmail.trim().toLowerCase(),
            client_phone: clientPhone.trim() || null,
            notes: "Fact Find updated in advisor portal",
          })
          .eq("id", editingDoc.id);
        if (updErr) throw updErr;
        // Best-effort: remove old storage object
        await supabase.storage.from("client-documents").remove([editingDoc.file_path]);
        // Refresh signed URL for further editing
        const { data: signed } = await supabase.storage
          .from("client-documents")
          .createSignedUrl(path, 60 * 30);
        if (signed?.signedUrl) {
          setEditingDoc({ ...editingDoc, file_path: path, file_name: filename });
          setPdfSrc(signed.signedUrl);
        }
        toast.success(`Updated ${clientName}'s Fact Find`);
      } else {
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
      }
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
          {editingDoc ? <Pencil className="w-6 h-6 text-primary" /> : <FileText className="w-6 h-6 text-primary" />}
          <div>
            <h1 className="text-2xl font-bold">{editingDoc ? "Edit Fact Find" : "Fact Find"}</h1>
            <p className="text-sm text-muted-foreground">
              {editingDoc
                ? `Editing ${editingDoc.file_name} — changes will replace the saved version in ${editingDoc.client_name}'s documents.`
                : "Fill out the Pure Private Wealth Fact Find directly in the PDF below, then save it to the client's documents."}
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
          <Button variant="outline" onClick={handleDownload} disabled={downloading || loadingEdit} className="gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>
          <Button onClick={handleSaveToClient} disabled={saving || loadingEdit} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editingDoc ? "Save changes" : "Save to client documents"}
          </Button>
        </div>

        {loadingEdit ? (
          <div className="text-center py-12 text-muted-foreground">Loading saved Fact Find…</div>
        ) : (
          <PdfFormEditor ref={editorRef} src={pdfSrc} />
        )}

        <div className="flex flex-wrap gap-2 justify-end pb-12">
          <Button variant="outline" onClick={handleDownload} disabled={downloading || loadingEdit} className="gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>
          <Button onClick={handleSaveToClient} disabled={saving || loadingEdit} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editingDoc ? "Save changes" : "Save to client documents"}
          </Button>
        </div>
      </div>
    </CRMLayout>
  );
}
