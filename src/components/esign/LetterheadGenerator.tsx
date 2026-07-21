import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Eraser, PenTool, Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "letterhead-generator:v2";
const LOGO_URL = "/logo-email-black.svg";

type FirmDetails = {
  name: string;
  legal: string;
  abn: string;
  acn?: string;
  address: string;
  phone: string;
  email: string;
  website: string;
};

type LetterState = {
  firm: FirmDetails;
  date: string;
  recipient: string; // multi-line address block
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  signerName: string;
  signerTitle: string;
  signatureData: string | null;
};

const DEFAULT_FIRM: FirmDetails = {
  name: "Advisorlink",
  legal: "Advisorlink Pty Ltd",
  abn: "99 671 139 923",
  acn: "",
  address: "2/21 Upton Street, Bundall QLD 4217",
  phone: "(07) 5241 1244",
  email: "admin@advisorlinkonline.com.au",
  website: "advisorlinkonline.com.au",
};

const DEFAULT_STATE: LetterState = {
  firm: DEFAULT_FIRM,
  date: new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
  recipient: "Recipient Name\nCompany / Organisation\nStreet Address\nSuburb STATE 0000",
  subject: "Subject of this letter",
  greeting: "Dear Recipient,",
  body:
    "Type the body of your letter here. Everything you enter in this field will appear in the letterhead preview to the right, ready to download as a PDF.\n\nYou can add multiple paragraphs, adjust the recipient details, subject line and signature block using the fields on the left.\n\nKind regards,",
  closing: "",
  signerName: "Your Name",
  signerTitle: "Your Title",
  signatureData: null,
};

export function LetterheadGenerator({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<LetterState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_STATE;
  });
  const [showFirm, setShowFirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const update = <K extends keyof LetterState>(k: K, v: LetterState[K]) =>
    setState(s => ({ ...s, [k]: v }));
  const updateFirm = <K extends keyof FirmDetails>(k: K, v: FirmDetails[K]) =>
    setState(s => ({ ...s, firm: { ...s.firm, [k]: v } }));

  // ── Signature canvas ─────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#0f172a";
      if (state.signatureData) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = state.signatureData;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const evt = "touches" in e ? e.touches[0] : e;
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = getPos(e);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current!;
    update("signatureData", canvas.toDataURL("image/png"));
  };
  const clearSig = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    update("signatureData", null);
  };

  // ── PDF export ───────────────────────────────────────────
  const downloadPDF = async () => {
    if (!paperRef.current) return;
    setExporting(true);
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(paperRef.current, {
        scale: 2.5,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "SLOW");
      const safe = (state.subject.trim() || "Letter").replace(/[/\\?%*:|"<>]/g, "-").slice(0, 60);
      pdf.save(`${safe}.pdf`);
      toast.success("Letter downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      if (wasDark) { root.classList.add("dark"); root.style.colorScheme = ""; }
      setExporting(false);
    }
  };

  return (
    <div className="max-w-[1800px] mx-auto py-6 px-4">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </Button>
          <div className="hidden sm:block h-6 w-px bg-border" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Letterhead Generator</h1>
            <p className="text-xs text-muted-foreground">Type your letter, then download it as a signed PDF.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFirm(v => !v)}>
            <Settings2 className="h-4 w-4 mr-1.5" /> Company details
          </Button>
          <Button size="sm" onClick={downloadPDF} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr] gap-6">
        {/* Editor */}
        <div className="space-y-4">
          {showFirm && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Company details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Trading name</Label>
                  <Input value={state.firm.name} onChange={e => updateFirm("name", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Legal entity</Label>
                  <Input value={state.firm.legal} onChange={e => updateFirm("legal", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">ABN</Label>
                  <Input value={state.firm.abn} onChange={e => updateFirm("abn", e.target.value)} placeholder="00 000 000 000" />
                </div>
                <div>
                  <Label className="text-xs">ACN (optional)</Label>
                  <Input value={state.firm.acn || ""} onChange={e => updateFirm("acn", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Address</Label>
                  <Input value={state.firm.address} onChange={e => updateFirm("address", e.target.value)} placeholder="Suite 1, 123 Example St, Sydney NSW 2000" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={state.firm.phone} onChange={e => updateFirm("phone", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input value={state.firm.email} onChange={e => updateFirm("email", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Website</Label>
                  <Input value={state.firm.website} onChange={e => updateFirm("website", e.target.value)} />
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Letter contents</h3>
            <div>
              <Label className="text-xs">Date</Label>
              <Input value={state.date} onChange={e => update("date", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Recipient block</Label>
              <Textarea rows={4} value={state.recipient} onChange={e => update("recipient", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={state.subject} onChange={e => update("subject", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Greeting</Label>
              <Input value={state.greeting} onChange={e => update("greeting", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Body</Label>
              <Textarea rows={12} value={state.body} onChange={e => update("body", e.target.value)} />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Signature block</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Signer name</Label>
                <Input value={state.signerName} onChange={e => update("signerName", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={state.signerTitle} onChange={e => update("signerTitle", e.target.value)} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <PenTool className="h-3.5 w-3.5" /> Draw signature
                </Label>
                <button onClick={clearSig} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <Eraser className="h-3 w-3" /> Clear
                </button>
              </div>
              <div className="rounded-md border-2 border-dashed bg-muted/30" style={{ aspectRatio: "3 / 1" }}>
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Leave blank to download an unsigned letter.</p>
            </div>
          </Card>
        </div>

        {/* Preview */}
        <div className="flex justify-center">
          <div
            ref={paperRef}
            className="bg-white text-slate-900 shadow-2xl relative"
            style={{
              width: "210mm",
              minHeight: "297mm",
              padding: "22mm 22mm 28mm",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "11pt",
              lineHeight: 1.55,
              boxSizing: "border-box",
            }}
          >
            {/* Header */}
            <div className="flex items-end justify-between pb-3" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <img
                src={LOGO_URL}
                alt={state.firm.name}
                style={{ height: "13mm", width: "auto", objectFit: "contain", display: "block" }}
                crossOrigin="anonymous"
              />
              <div className="text-right" style={{ color: "#475569", fontSize: "8.5pt", lineHeight: 1.5 }}>
                {state.firm.address && <div>{state.firm.address}</div>}
                <div>
                  {[state.firm.phone, state.firm.email].filter(Boolean).join("  ·  ")}
                </div>
              </div>
            </div>
            <div style={{ height: "2px", background: "#0f172a", marginTop: "1.5mm", width: "100%" }} />


            {/* Date */}
            <div className="mt-8 text-[10.5pt]">{state.date}</div>

            {/* Recipient */}
            <div className="mt-6 whitespace-pre-line text-[10.5pt]">{state.recipient}</div>

            {/* Subject */}
            {state.subject && (
              <div className="mt-6 font-semibold text-[11pt]" style={{ color: "#0f172a" }}>
                {state.subject}
              </div>
            )}

            {/* Greeting */}
            <div className="mt-5">{state.greeting}</div>

            {/* Body */}
            <div className="mt-3 whitespace-pre-line" style={{ textAlign: "justify" }}>
              {state.body}
            </div>

            {/* Signature */}
            <div className="mt-10">
              {state.signatureData ? (
                <img src={state.signatureData} alt="Signature" style={{ height: "18mm", width: "auto", display: "block" }} />
              ) : (
                <div style={{ height: "18mm" }} />
              )}
              <div className="mt-1 border-t border-slate-400 pt-1" style={{ width: "70mm" }}>
                <div className="font-semibold text-[10.5pt]">{state.signerName}</div>
                {state.signerTitle && <div className="text-[9.5pt]" style={{ color: "#475569" }}>{state.signerTitle}</div>}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                position: "absolute",
                left: "22mm",
                right: "22mm",
                bottom: "12mm",
                borderTop: "1px solid #cbd5e1",
                paddingTop: "3mm",
                fontSize: "8pt",
                color: "#64748b",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: "#0f172a" }}>
                {state.firm.legal}
                {state.firm.abn ? ` · ABN ${state.firm.abn.replace(/^ABN\s*/i, "")}` : ""}
                {state.firm.acn ? ` · ACN ${state.firm.acn.replace(/^ACN\s*/i, "")}` : ""}
              </div>
              <div>
                {[state.firm.address, state.firm.phone, state.firm.email, state.firm.website].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
