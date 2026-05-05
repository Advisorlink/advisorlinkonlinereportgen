import { useState, useEffect, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, FileEdit, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";

interface FieldEntry {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "signature" | "other";
  value: string;
  label: string;
}

interface Props {
  file: File;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  onBack: () => void;
  onContinue: (editedFile: File) => void;
}

export function ESignPdfEditor({ file, clientName, clientEmail, clientPhone, clientAddress, onBack, onContinue }: Props) {
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<FieldEntry[]>([]);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAndAnalyzePdf();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const loadAndAnalyzePdf = async () => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const form = pdfDoc.getForm();
      const pdfFields = form.getFields();

      const entries: FieldEntry[] = [];
      const clientData: Record<string, string> = {
        name: clientName,
        full_name: clientName,
        fullname: clientName,
        client_name: clientName,
        clientname: clientName,
        email: clientEmail,
        client_email: clientEmail,
        phone: clientPhone,
        mobile: clientPhone,
        telephone: clientPhone,
        client_phone: clientPhone,
        address: clientAddress,
        client_address: clientAddress,
        street: clientAddress,
      };

      for (const field of pdfFields) {
        const name = field.getName();
        const typeName = field.constructor.name;
        let type: FieldEntry["type"] = "other";
        let value = "";

        if (typeName === "PDFTextField") {
          type = "text";
          try {
            const tf = form.getTextField(name);
            value = tf.getText() || "";
          } catch { /* empty */ }
        } else if (typeName === "PDFCheckBox") {
          type = "checkbox";
        } else if (typeName === "PDFDropdown") {
          type = "dropdown";
        } else if (typeName === "PDFSignature") {
          type = "signature";
        }

        // Try to auto-fill based on field name
        if (type === "text" && !value) {
          const lower = name.toLowerCase().replace(/[\s_-]+/g, "_");
          for (const [key, val] of Object.entries(clientData)) {
            if (lower.includes(key) && val) {
              value = val;
              break;
            }
          }
        }

        const label = name
          .replace(/[_-]/g, " ")
          .replace(/([A-Z])/g, " $1")
          .replace(/\s+/g, " ")
          .trim();

        entries.push({ name, type, value, label: label || name });
      }

      setFields(entries);

      // Fill the fields and generate preview
      for (const entry of entries) {
        if (entry.type === "text" && entry.value) {
          try {
            const tf = form.getTextField(entry.name);
            tf.setText(entry.value);
          } catch { /* empty */ }
        }
      }

      const filledBytes = await pdfDoc.save();
      setPdfBytes(filledBytes);
      const blob = new Blob([filledBytes], { type: "application/pdf" });
      setPreviewUrl(URL.createObjectURL(blob));

      setLoading(false);
    } catch (err) {
      console.error("PDF analysis error:", err);
      // No form fields found — just show the PDF as-is
      const arrayBuffer = await file.arrayBuffer();
      setPdfBytes(new Uint8Array(arrayBuffer));
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      setPreviewUrl(URL.createObjectURL(blob));
      setFields([]);
      setLoading(false);
    }
  };

  const updateField = (index: number, value: string) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)));
  };

  const applyFieldsAndPreview = async () => {
    setSaving(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const form = pdfDoc.getForm();

      for (const entry of fields) {
        if (entry.type === "text") {
          try {
            const tf = form.getTextField(entry.name);
            tf.setText(entry.value || "");
          } catch { /* skip */ }
        }
      }

      const filledBytes = await pdfDoc.save();
      setPdfBytes(filledBytes);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const blob = new Blob([filledBytes], { type: "application/pdf" });
      setPreviewUrl(URL.createObjectURL(blob));

      toast.success("Preview updated!");
    } catch (err: any) {
      toast.error("Failed to update preview");
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      // Apply all fields one final time
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const form = pdfDoc.getForm();

      for (const entry of fields) {
        if (entry.type === "text") {
          try {
            const tf = form.getTextField(entry.name);
            tf.setText(entry.value || "");
          } catch { /* skip */ }
        }
      }

      const filledBytes = await pdfDoc.save();
      const editedFile = new File([filledBytes], file.name, { type: "application/pdf" });
      onContinue(editedFile);
    } catch (err) {
      toast.error("Failed to prepare document");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-cyan" />
        <p className="text-sm text-muted-foreground">Analyzing PDF form fields...</p>
      </div>
    );
  }

  const textFields = fields.filter((f) => f.type === "text");
  const signatureFields = fields.filter((f) => f.type === "signature");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileEdit className="w-5 h-5 text-cyan" />
        <div>
          <h2 className="text-xl font-bold">Review & Edit Document</h2>
          <p className="text-sm text-muted-foreground">
            {textFields.length > 0
              ? `Found ${textFields.length} fillable field${textFields.length !== 1 ? "s" : ""}. Edit below then preview.`
              : "No fillable form fields detected. You can still preview and send the document."}
            {signatureFields.length > 0 && ` • ${signatureFields.length} signature field${signatureFields.length !== 1 ? "s" : ""} detected.`}
          </p>
        </div>
      </div>

      {/* Field Editor */}
      {textFields.length > 0 && (
        <div className="border border-border rounded-xl p-5 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Form Fields</h3>
            <Button size="sm" variant="outline" onClick={applyFieldsAndPreview} disabled={saving} className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              {saving ? "Updating..." : "Update Preview"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {textFields.map((field, idx) => {
              const originalIdx = fields.indexOf(field);
              return (
                <div key={field.name} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  <Input
                    value={field.value}
                    onChange={(e) => updateField(originalIdx, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    className="h-9 text-sm"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PDF Preview */}
      {previewUrl && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Document Preview</span>
          </div>
          <iframe src={previewUrl} className="w-full h-[500px]" title="PDF Preview" />
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleContinue} disabled={saving} className="gap-2">
          {saving ? "Preparing..." : "Continue to Send"} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
