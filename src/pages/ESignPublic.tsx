import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PDFDocument, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Loader2, AlertCircle, PenTool, ShieldCheck, Eraser } from "lucide-react";
import { toast } from "sonner";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

function InlinePdfViewer({ url }: { url: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      setLoading(true);
      wrap.innerHTML = "";
      try {
        const buf = await fetch(url).then((r) => r.arrayBuffer());
        if (cancelled) return;
        const pdf = await (pdfjsLib as any).getDocument({ data: new Uint8Array(buf) }).promise;
        const containerWidth = wrap.clientWidth || 600;
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / viewport.width;
          const scaled = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
          const canvas = document.createElement("canvas");
          canvas.width = scaled.width;
          canvas.height = scaled.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.marginBottom = i < pdf.numPages ? "8px" : "0";
          wrap.appendChild(canvas);
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport: scaled }).promise;
        }
      } catch (e) {
        console.error("PDF render error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    render();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div style={{ background: "#f1f5f9", padding: 12, maxHeight: "70vh", overflowY: "auto" }}>
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#0ea5e9" }} />
        </div>
      )}
      <div ref={wrapRef} />
    </div>
  );
}

interface ESignDoc {
  id: string;
  document_name: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  status: string;
  original_pdf_path: string | null;
  signing_token: string;
  client_data?: any;
}

interface SigningField {
  kind: "text" | "signature";
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

type PageState = "loading" | "ready" | "signing" | "submitted" | "already-signed" | "error";

const BRAND = {
  navy: "#0f172a",
  cyan: "#0ea5e9",
  cyanLight: "#e0f7ff",
  cyanDark: "#0284c7",
  gray50: "#f8fafc",
  gray100: "#f1f5f9",
  gray200: "#e2e8f0",
  gray400: "#94a3b8",
  gray500: "#64748b",
  gray700: "#334155",
  gray900: "#0f172a",
  white: "#ffffff",
  green: "#10b981",
};

export default function ESignPublic() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<PageState>("loading");
  const [doc, setDoc] = useState<ESignDoc | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) { setState("error"); return; }
    loadDocument();
  }, [token]);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const containerWidth = container.clientWidth;
      const desiredWidth = Math.min(containerWidth, 600);
      const ratio = desiredWidth / 600;
      canvas.width = desiredWidth;
      canvas.height = Math.round(200 * ratio);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [state]);

  const loadDocument = async () => {
    const { data, error } = await supabase
      .rpc("get_esign_doc_by_token", { _token: token! });

    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) { setState("error"); return; }
    const d = row as ESignDoc;
    setDoc(d);

    if (d.status === "signed" || d.status === "completed") {
      setState("already-signed");
      return;
    }

    if (d.original_pdf_path) {
      const { data: urlData, error: urlErr } = await supabase.functions.invoke(
        "esign-signed-url",
        { body: { token: token!, path: d.original_pdf_path } },
      );
      if (!urlErr && urlData?.signedUrl) setPdfUrl(urlData.signedUrl);
    }

    setState("ready");
  };


  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = BRAND.navy;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }, [isDrawing, getPos]);

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL("image/png"));
    }
  }, [isDrawing]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleSubmit = async () => {
    if (!doc || !signatureData || !token) return;
    setSubmitting(true);
    try {
      const signingFields: SigningField[] = (doc.client_data?.signing_fields || []).filter(
        (field: SigningField) => field.kind === "signature"
      );

      let signedPdfPath: string | null = null;
      if (doc.original_pdf_path && pdfUrl && signingFields.length > 0) {
        const pdfBytes = await fetch(pdfUrl).then((res) => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const signatureImage = await pdfDoc.embedPng(signatureData);
        const pages = pdfDoc.getPages();

        for (const field of signingFields) {
          const page = pages[field.pageIndex];
          if (!page) continue;
          const pageWidth = page.getWidth();
          const pageHeight = page.getHeight();
          const w = field.width * pageWidth;
          const h = field.height * pageHeight;
          const fx = field.x * pageWidth;
          const fy = pageHeight - field.y * pageHeight - h;

          // Cover the "Sign here" box border with a white rectangle
          page.drawRectangle({
            x: fx - 2,
            y: fy - 2,
            width: w + 4,
            height: h + 4,
            color: rgb(1, 1, 1),
            borderWidth: 0,
          });

          // Draw the actual signature
          page.drawImage(signatureImage, {
            x: fx + 6,
            y: fy + 4,
            width: w - 12,
            height: h - 8,
          });
        }

        const completedBytes = await pdfDoc.save();
        signedPdfPath = doc.original_pdf_path.replace(/\.pdf$/i, "_signed.pdf");
        const { error: uploadError } = await supabase.storage
          .from("esign-documents")
          .upload(signedPdfPath, new Blob([completedBytes as BlobPart], { type: "application/pdf" }), { upsert: true });
        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error("Failed to upload signed document");
        }
      }

      await supabase.from("esign_signatures").insert({
        document_id: doc.id,
        signer_name: doc.client_name || "Unknown",
        signer_email: doc.client_email,
        signature_data: signatureData,
        field_index: 1,
      });

      if (signingFields.length > 1) {
        await supabase.from("esign_signatures").insert({
          document_id: doc.id,
          signer_name: doc.client_name || "Unknown",
          signer_email: doc.client_email,
          signature_data: signatureData,
          field_index: 2,
        });
      }

      const { error: rpcError } = await supabase.rpc("complete_signing", {
        _token: token,
        _signed_pdf_path: signedPdfPath,
      });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        throw new Error("Failed to update document status");
      }

      try {
        await supabase.functions.invoke("send-esign-email", {
          body: {
            type: "signed-notification",
            documentId: doc.id,
            clientName: doc.client_name,
            documentName: doc.document_name,
          },
        });
      } catch {
        // Non-critical
      }

      setState("submitted");
    } catch (err: any) {
      console.error("Signing error:", err);
      toast.error(err.message || "Failed to submit signature. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Status screens ---
  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.gray50 }}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: BRAND.cyan }} />
          <p className="text-sm" style={{ color: BRAND.gray500 }}>Loading your document…</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.gray50 }}>
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#fef2f2" }}>
            <AlertCircle className="w-10 h-10" style={{ color: "#ef4444" }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: BRAND.navy, fontFamily: "Montserrat, sans-serif" }}>Invalid Link</h1>
          <p style={{ color: BRAND.gray500 }}>This signing link is invalid or has expired. Please contact your adviser for assistance.</p>
        </div>
      </div>
    );
  }

  if (state === "already-signed") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.gray50 }}>
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#ecfdf5" }}>
            <CheckCircle className="w-10 h-10" style={{ color: BRAND.green }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: BRAND.navy, fontFamily: "Montserrat, sans-serif" }}>Already Signed</h1>
          <p style={{ color: BRAND.gray500 }}>This document has already been signed. Thank you!</p>
        </div>
      </div>
    );
  }

  if (state === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.gray50 }}>
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#ecfdf5" }}>
            <CheckCircle className="w-10 h-10" style={{ color: BRAND.green }} />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: BRAND.navy, fontFamily: "Montserrat, sans-serif" }}>Document Signed!</h1>
          <p className="mb-2" style={{ color: BRAND.gray700 }}>Your signature has been recorded successfully.</p>
          <p className="text-sm" style={{ color: BRAND.gray500 }}>A confirmation email with a copy of your signed document will be sent to you shortly.</p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs" style={{ color: BRAND.gray400 }}>
            <ShieldCheck className="w-4 h-4" />
            <span>Secured by Advisor Link Online</span>
          </div>
        </div>
      </div>
    );
  }

  // --- Main signing page ---
  return (
    <div className="min-h-screen" style={{ background: BRAND.gray50 }}>
      {/* Branded Header */}
      <header style={{ background: BRAND.navy }} className="px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png"
              alt="Advisor Link Online"
              className="h-8 sm:h-10 brightness-0 invert"
            />
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-white/90">{doc?.client_name}</p>
            <p className="text-xs text-white/50">{doc?.client_email}</p>
          </div>
        </div>
      </header>

      {/* Cyan accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${BRAND.cyan}, ${BRAND.cyanDark})` }} />

      <div className="max-w-3xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-5">
        {/* Document title banner */}
        <div className="rounded-2xl overflow-hidden" style={{ background: BRAND.white, border: `1px solid ${BRAND.gray200}` }}>
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${BRAND.gray100}` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: BRAND.cyanLight }}>
              <FileText className="w-5 h-5" style={{ color: BRAND.cyan }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: BRAND.navy, fontFamily: "Montserrat, sans-serif" }}>
                {doc?.document_name}
              </h2>
              <p className="text-xs" style={{ color: BRAND.gray500 }}>Please review the document below, then scroll down to sign.</p>
            </div>
          </div>

          {/* PDF Preview - rendered inline so it shows immediately on all devices */}
          {pdfUrl && <InlinePdfViewer url={pdfUrl} />}
        </div>

        {/* Signature Area */}
        <div className="rounded-2xl overflow-hidden" style={{ background: BRAND.white, border: `1px solid ${BRAND.gray200}` }}>
          <div className="px-5 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${BRAND.navy}, #1e293b)` }}>
            <PenTool className="w-5 h-5 text-white/80" />
            <div>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Sign Here
              </h2>
              <p className="text-xs text-white/60">
                Draw your signature using your finger or mouse
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div
              ref={containerRef}
              className="rounded-xl overflow-hidden"
              style={{ border: `2px dashed ${signatureData ? BRAND.cyan : BRAND.gray200}`, background: signatureData ? BRAND.cyanLight + "33" : BRAND.gray50 }}
            >
              <canvas
                ref={canvasRef}
                className="w-full cursor-crosshair touch-none"
                style={{ height: "auto", aspectRatio: "3 / 1" }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={clearSignature}
                className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
                style={{ color: BRAND.gray500 }}
              >
                <Eraser className="w-4 h-4" />
                Clear
              </button>

              {signatureData && (
                <span className="text-xs font-medium flex items-center gap-1" style={{ color: BRAND.green }}>
                  <CheckCircle className="w-3.5 h-3.5" /> Signature captured
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!signatureData || submitting}
          className="w-full h-14 text-base font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: signatureData ? `linear-gradient(135deg, ${BRAND.cyan}, ${BRAND.cyanDark})` : BRAND.gray200,
            color: signatureData ? BRAND.white : BRAND.gray500,
            boxShadow: signatureData ? `0 8px 24px -4px ${BRAND.cyan}44` : "none",
            fontFamily: "Montserrat, sans-serif",
          }}
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</>
          ) : (
            <><CheckCircle className="w-5 h-5" /> Submit Signed Document</>
          )}
        </button>

        {/* Footer */}
        <div className="text-center pb-6 space-y-3">
          <p className="text-xs" style={{ color: BRAND.gray400 }}>
            By signing, you agree to the terms of this document. A copy will be sent to you and your adviser.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: BRAND.gray400 }}>
            <ShieldCheck className="w-4 h-4" style={{ color: BRAND.cyan }} />
            <span>Secured by <strong>Advisor Link Online</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
