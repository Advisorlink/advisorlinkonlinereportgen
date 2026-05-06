import { useEffect, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  FileEdit,
  Grip,
  Loader2,
  MousePointer2,
  PenTool,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export interface ESignField {
  id: string;
  kind: "text" | "signature";
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: string;
  required: boolean;
  source?: "manual" | "acroform";
  acroName?: string;
}

interface PdfPageMeta {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
}

interface Props {
  file: File;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  clientDob: string;
  onBack: () => void;
  onContinue: (editedFile: File, fields: ESignField[]) => void;
}

type Tool = "select" | "text" | "signature";
type DragState =
  | { type: "move"; fieldId: string; offsetX: number; offsetY: number }
  | { type: "resize"; fieldId: string; startX: number; startY: number; startWidth: number; startHeight: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function ESignPdfEditor({
  file,
  clientName,
  clientEmail,
  clientPhone,
  clientAddress,
  clientDob,
  onBack,
  onContinue,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [pages, setPages] = useState<PdfPageMeta[]>([]);
  const [fields, setFields] = useState<ESignField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const pdfDocRef = useRef<any>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});

  const todayFormatted = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });

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
    residential_address: clientAddress,
    street: clientAddress,
    dob: clientDob,
    date_of_birth: clientDob,
    dateofbirth: clientDob,
    birth_date: clientDob,
    birthdate: clientDob,
    date: todayFormatted,
    today: todayFormatted,
    signed_date: todayFormatted,
    current_date: todayFormatted,
  };

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = (pdfjsLib as any).getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        const pageMetas: PdfPageMeta[] = [];
        const detectedFields: ESignField[] = [];

        for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
          const page = await pdf.getPage(pageIndex + 1);
          const viewport = page.getViewport({ scale: 1.35 });
          pageMetas.push({
            pageNumber: pageIndex + 1,
            width: viewport.width,
            height: viewport.height,
            scale: 1.35,
          });

          const annotations = await page.getAnnotations();
          annotations
            .filter((annotation: any) => annotation.subtype === "Widget")
            .forEach((annotation: any, annotationIndex: number) => {
              const isText = annotation.fieldType === "Tx";
              const isSignature = annotation.fieldType === "Sig";
              if (!isText && !isSignature) return;

              const rect = viewport.convertToViewportRectangle(annotation.rect);
              const left = Math.min(rect[0], rect[2]);
              const top = Math.min(rect[1], rect[3]);
              const width = Math.abs(rect[2] - rect[0]);
              const height = Math.abs(rect[3] - rect[1]);
              const label = formatLabel(annotation.fieldName || (isSignature ? "Signature" : "Text"));

              const fieldName = annotation.fieldName || "";
              const prefill = isText
                ? (annotation.fieldValue && annotation.fieldValue.trim() ? annotation.fieldValue : suggestedValue(fieldName || label, clientData))
                : "";

              detectedFields.push({
                id: `acro-${pageIndex}-${annotationIndex}-${Date.now()}`,
                kind: isSignature ? "signature" : "text",
                pageIndex,
                x: clamp(left / viewport.width, 0, 0.96),
                y: clamp(top / viewport.height, 0, 0.96),
                width: clamp(width / viewport.width, 0.06, 0.8),
                height: clamp(height / viewport.height, 0.025, 0.2),
                label,
                value: prefill,
                required: true,
                source: "acroform",
                acroName: fieldName,
              });
            });

          // --- Auto-detect signature areas via text content scanning ---
          const textContent = await page.getTextContent();
          const items = textContent.items as any[];
          items.forEach((item: any) => {
            const str = (item.str || "").toLowerCase().trim();
            const isSignatureLabel = /\bsign(ature|ed)?\b/.test(str) || str === "sign here" || str === "client signature" || str === "signature of applicant" || str === "authorised signature";
            if (isSignatureLabel && item.transform) {
              const tx = item.transform[4]; // x position
              const ty = item.transform[5]; // y position (PDF coords, bottom-up)
              // Convert to viewport coords
              const vx = tx * (viewport.width / (viewport.width / 1.35)) * 1.35;
              const vy = viewport.height - (ty * 1.35) + 5; // flip y, offset below label
              const nx = clamp(vx / viewport.width, 0, 0.65);
              const ny = clamp(vy / viewport.height, 0, 0.88);
              // Avoid duplicates near the same position
              const isDuplicate = detectedFields.some(
                (f) => f.kind === "signature" && f.pageIndex === pageIndex && Math.abs(f.x - nx) < 0.1 && Math.abs(f.y - ny) < 0.08
              );
              if (!isDuplicate) {
                detectedFields.push(createSignatureField(pageIndex, nx, ny, `Signature ${detectedFields.filter(f => f.kind === "signature").length + 1}`));
              }
            }
          });
        }

        // Fallback: if no signature fields found at all, add defaults on last page
        const signatureCount = detectedFields.filter((field) => field.kind === "signature").length;
        if (pageMetas.length > 0 && signatureCount === 0) {
          const lastPage = pageMetas.length - 1;
          detectedFields.push(createSignatureField(lastPage, 0.1, 0.78, "Signature 1"));
          detectedFields.push(createSignatureField(lastPage, 0.1, 0.88, "Signature 2"));
        }

        setPages(pageMetas);
        setFields(detectedFields);
      } catch (error) {
        console.error("PDF editor load error:", error);
        toast.error("Could not open this PDF for editing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy?.();
    };
  }, [file]);

  useEffect(() => {
    if (!pages.length || !pdfDocRef.current) return;

    let cancelled = false;
    const renderPages = async () => {
      for (const meta of pages) {
        const canvas = canvasRefs.current[meta.pageNumber];
        if (!canvas || cancelled) continue;

        const page = await pdfDocRef.current.getPage(meta.pageNumber);
        const viewport = page.getViewport({ scale: meta.scale });
        const context = canvas.getContext("2d");
        if (!context) continue;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
      }
    };

    requestAnimationFrame(renderPages);
    return () => {
      cancelled = true;
    };
  }, [pages]);

  const selectedField = fields.find((field) => field.id === selectedFieldId) || null;
  const signatureFields = fields.filter((field) => field.kind === "signature");
  const textFields = fields.filter((field) => field.kind === "text");

  const addField = (pageIndex: number, x: number, y: number) => {
    if (tool === "select") return;

    const field: ESignField =
      tool === "signature"
        ? createSignatureField(pageIndex, x, y, `Signature ${signatureFields.length + 1}`)
        : {
            id: `field-${Date.now()}`,
            kind: "text",
            pageIndex,
            x: clamp(x, 0, 0.72),
            y: clamp(y, 0, 0.94),
            width: 0.28,
            height: 0.04,
            label: `Text ${textFields.length + 1}`,
            value: "",
            required: false,
            source: "manual",
          };

    setFields((prev) => [...prev, field]);
    setSelectedFieldId(field.id);
    setTool("select");
  };

  const updateField = (id: string, patch: Partial<ESignField>) => {
    setFields((prev) => prev.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((field) => field.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const getPointerPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (tool === "select") return;
    const rect = event.currentTarget.getBoundingClientRect();
    addField(pageIndex, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    event.preventDefault();
    const pointer = getPointerPosition(event);
    const field = fields.find((item) => item.id === dragState.fieldId);
    if (!field) return;

    if (dragState.type === "move") {
      updateField(field.id, {
        x: clamp(pointer.x - dragState.offsetX, 0, 1 - field.width),
        y: clamp(pointer.y - dragState.offsetY, 0, 1 - field.height),
      });
    } else {
      updateField(field.id, {
        width: clamp(dragState.startWidth + pointer.x - dragState.startX, 0.08, 1 - field.x),
        height: clamp(dragState.startHeight + pointer.y - dragState.startY, 0.03, 1 - field.y),
      });
    }
  };

  const startMove = (event: React.PointerEvent<HTMLDivElement>, field: ESignField) => {
    event.preventDefault();
    event.stopPropagation();
    const pageElement = event.currentTarget.parentElement as HTMLDivElement | null;
    if (!pageElement) return;
    const rect = pageElement.getBoundingClientRect();
    setSelectedFieldId(field.id);
    setDragState({
      type: "move",
      fieldId: field.id,
      offsetX: (event.clientX - rect.left) / rect.width - field.x,
      offsetY: (event.clientY - rect.top) / rect.height - field.y,
    });
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>, field: ESignField) => {
    event.preventDefault();
    event.stopPropagation();
    const pageElement = event.currentTarget.closest("[data-pdf-page]") as HTMLDivElement | null;
    if (!pageElement) return;
    const rect = pageElement.getBoundingClientRect();
    setSelectedFieldId(field.id);
    setDragState({
      type: "resize",
      fieldId: field.id,
      startX: (event.clientX - rect.left) / rect.width,
      startY: (event.clientY - rect.top) / rect.height,
      startWidth: field.width,
      startHeight: field.height,
    });
  };

  const preparePdf = async () => {
    if (!signatureFields.length) {
      toast.error("Add at least one signature box before sending");
      return;
    }

    setSaving(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const form = pdfDoc.getForm();

      for (const field of fields) {
        if (field.kind === "text" && field.acroName) {
          try {
            form.getTextField(field.acroName).setText(field.value || "");
          } catch {
            // Manual drawing below covers non-AcroForm fields.
          }
        }
      }

      try {
        form.flatten();
      } catch {
        // Some PDFs do not have a standard form tree.
      }

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pdfPages = pdfDoc.getPages();

      for (const field of fields) {
        const page = pdfPages[field.pageIndex];
        if (!page) continue;

        const { x, y, width, height } = toPdfRect(page, field);

        if (field.kind === "text" && field.source !== "acroform") {
          page.drawRectangle({
            x,
            y,
            width,
            height,
            borderWidth: 0.7,
            borderColor: rgb(0.03, 0.41, 0.56),
            color: rgb(0.96, 0.99, 1),
            opacity: 0.92,
          });
          if (field.value) {
            page.drawText(field.value, {
              x: x + 5,
              y: y + Math.max(4, height / 2 - 5),
              size: clamp(height * 0.42, 7, 12),
              font,
              color: rgb(0.05, 0.09, 0.16),
              maxWidth: width - 10,
            });
          }
        }

        if (field.kind === "signature") {
          page.drawRectangle({
            x,
            y,
            width,
            height,
            borderWidth: 1.4,
            borderColor: rgb(0.02, 0.58, 0.78),
            color: rgb(0.94, 0.99, 1),
            opacity: 0.65,
          });
          page.drawText("Sign here", {
            x: x + 8,
            y: y + height / 2 - 5,
            size: clamp(height * 0.2, 8, 12),
            font: boldFont,
            color: rgb(0.02, 0.41, 0.57),
            maxWidth: width - 16,
          });
        }
      }

      const preparedBytes = await pdfDoc.save();
      const preparedFile = new File([preparedBytes as BlobPart], file.name, { type: "application/pdf" });
      onContinue(preparedFile, fields);
    } catch (error) {
      console.error("Prepare PDF error:", error);
      toast.error("Failed to prepare this PDF");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-cyan" />
        <p className="text-sm text-muted-foreground">Opening PDF editor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <FileEdit className="w-5 h-5 text-cyan" />
          <div>
            <h2 className="text-xl font-bold">Prepare Document</h2>
            <p className="text-sm text-muted-foreground">
              Place text and signature boxes exactly where they should appear before sending.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolButton active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Select" />
          <ToolButton active={tool === "text"} onClick={() => setTool("text")} icon={Type} label="Text" />
          <ToolButton active={tool === "signature"} onClick={() => setTool("signature")} icon={PenTool} label="Signature" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex min-w-max flex-col items-center gap-5">
            {pages.map((page, pageIndex) => (
              <div
                key={page.pageNumber}
                data-pdf-page
                className="relative overflow-hidden rounded-sm bg-card shadow-elevated"
                style={{ width: page.width, height: page.height }}
                onClick={(event) => handlePageClick(event, pageIndex)}
                onPointerMove={handlePointerMove}
                onPointerUp={() => setDragState(null)}
                onPointerCancel={() => setDragState(null)}
              >
                <canvas
                  ref={(node) => {
                    canvasRefs.current[page.pageNumber] = node;
                  }}
                  className="absolute inset-0 h-full w-full"
                />

                {fields
                  .filter((field) => field.pageIndex === pageIndex)
                  .map((field) => (
                    <div
                      key={field.id}
                      className={`absolute flex cursor-move items-center border-2 px-2 text-xs font-semibold shadow-sm transition-colors ${
                        selectedFieldId === field.id
                          ? "border-cyan bg-cyan/15 text-foreground"
                          : field.kind === "signature"
                            ? "border-cyan/80 bg-cyan/10 text-cyan"
                            : "border-primary/70 bg-background/80 text-foreground"
                      }`}
                      style={{
                        left: `${field.x * 100}%`,
                        top: `${field.y * 100}%`,
                        width: `${field.width * 100}%`,
                        height: `${field.height * 100}%`,
                      }}
                      onPointerDown={(event) => startMove(event, field)}
                    >
                      <span className="min-w-0 truncate">
                        {field.kind === "signature" ? "Sign here" : field.value || field.label}
                      </span>
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full border border-destructive/50 bg-destructive text-white shadow-sm hover:bg-destructive/90 z-10"
                        onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); removeField(field.id); }}
                        aria-label={`Delete ${field.label}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="absolute -bottom-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
                        onPointerDown={(event) => startResize(event, field)}
                        aria-label="Resize field"
                      >
                        <Grip className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fields</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {textFields.length} text • {signatureFields.length} signature
            </p>
          </div>

          {selectedField ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-semibold text-foreground">
                  {selectedField.kind === "signature" ? "Signature box" : "Text box"}
                </p>
                <p className="text-xs text-muted-foreground">Page {selectedField.pageIndex + 1}</p>
              </div>

              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={selectedField.label}
                  onChange={(event) => updateField(selectedField.id, { label: event.target.value })}
                />
              </div>

              {selectedField.kind === "text" && (
                <div className="space-y-2">
                  <Label>Text value</Label>
                  <Input
                    value={selectedField.value}
                    onChange={(event) => updateField(selectedField.id, { value: event.target.value })}
                    placeholder="Enter text to place on the PDF"
                  />
                </div>
              )}

              <Button variant="outline" className="w-full gap-2" onClick={() => removeField(selectedField.id)}>
                <Trash2 className="h-4 w-4" /> Remove field
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Select a field on the PDF, or choose Text/Signature then click the PDF to place a new box.
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            {fields.map((field) => (
              <div
                key={field.id}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedFieldId === field.id
                    ? "border-cyan bg-cyan/10 text-foreground"
                    : "border-border hover:bg-muted/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedFieldId(field.id)}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  {field.kind === "signature" ? <PenTool className="h-4 w-4 text-cyan" /> : <Type className="h-4 w-4 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{field.label}</span>
                  <span className="text-xs text-muted-foreground">P{field.pageIndex + 1}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={`Delete ${field.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={preparePdf} disabled={saving} className="gap-2">
          {saving ? "Preparing..." : "Continue to Send"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MousePointer2;
  label: string;
}) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onClick} className="gap-2">
      <Icon className="h-4 w-4" /> {label}
    </Button>
  );
}

function createSignatureField(pageIndex: number, x: number, y: number, label: string): ESignField {
  return {
    id: `signature-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: "signature",
    pageIndex,
    x: clamp(x, 0, 0.7),
    y: clamp(y, 0, 0.9),
    width: 0.32,
    height: 0.07,
    label,
    value: "",
    required: true,
    source: "manual",
  };
}

function formatLabel(name: string) {
  return name
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim() || "Field";
}

function suggestedValue(name: string, clientData: Record<string, string>) {
  const raw = name.toLowerCase().trim();
  const normalized = raw.replace(/[\s_-]+/g, "_");

  // Check for date-of-birth first (must come before generic date check)
  if (/(birth|dob)/i.test(raw)) {
    return clientData.dob || "";
  }

  // Date-like field names — broad match for any field containing "date"
  if (/date/i.test(raw)) {
    return clientData.date || "";
  }

  // Exact key match
  for (const [key, value] of Object.entries(clientData)) {
    if (normalized === key && value) return value;
  }
  // Partial match
  for (const [key, value] of Object.entries(clientData)) {
    if (normalized.includes(key) && value) return value;
  }

  // Keyword fallback for common labels
  if (/\b(name|full.?name|client.?name)\b/i.test(raw)) return clientData.name || "";
  if (/\b(email|e.?mail)\b/i.test(raw)) return clientData.email || "";
  if (/\b(phone|mobile|tel)\b/i.test(raw)) return clientData.phone || "";
  if (/\b(address|street|residential)\b/i.test(raw)) return clientData.address || "";

  return "";
}

function toPdfRect(page: any, field: ESignField) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const width = field.width * pageWidth;
  const height = field.height * pageHeight;
  return {
    x: field.x * pageWidth,
    y: pageHeight - field.y * pageHeight - height,
    width,
    height,
  };
}
