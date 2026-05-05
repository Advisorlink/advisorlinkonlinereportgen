import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Loader2, AlertCircle, PenTool } from "lucide-react";
import { toast } from "sonner";

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
}

type PageState = "loading" | "ready" | "signing" | "submitted" | "already-signed" | "error";

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

  useEffect(() => {
    if (!token) { setState("error"); return; }
    loadDocument();
  }, [token]);

  const loadDocument = async () => {
    const { data, error } = await supabase
      .from("esign_documents")
      .select("*")
      .eq("signing_token", token!)
      .single();

    if (error || !data) { setState("error"); return; }
    const d = data as ESignDoc;
    setDoc(d);

    if (d.status === "signed" || d.status === "completed") {
      setState("already-signed");
      return;
    }

    // Get PDF URL
    if (d.original_pdf_path) {
      const { data: urlData } = await supabase.storage
        .from("esign-documents")
        .createSignedUrl(d.original_pdf_path, 3600);
      if (urlData?.signedUrl) setPdfUrl(urlData.signedUrl);
    }

    setState("ready");
  };

  // Canvas drawing handlers
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleSubmit = async () => {
    if (!doc || !signatureData) return;
    setSubmitting(true);
    try {
      // Save signature (field 1)
      await supabase.from("esign_signatures").insert({
        document_id: doc.id,
        signer_name: doc.client_name || "Unknown",
        signer_email: doc.client_email,
        signature_data: signatureData,
        field_index: 1,
      });

      // Save signature (field 2 - auto-applied same signature)
      await supabase.from("esign_signatures").insert({
        document_id: doc.id,
        signer_name: doc.client_name || "Unknown",
        signer_email: doc.client_email,
        signature_data: signatureData,
        field_index: 2,
      });

      // Update document status
      await supabase
        .from("esign_documents")
        .update({ status: "signed", signed_at: new Date().toISOString() })
        .eq("id", doc.id);

      // Notify host
      await supabase.functions.invoke("send-esign-email", {
        body: {
          type: "signed-notification",
          documentId: doc.id,
          clientName: doc.client_name,
          documentName: doc.document_name,
        },
      });

      setState("submitted");
    } catch (err: any) {
      toast.error("Failed to submit signature. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500">This signing link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (state === "already-signed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Signed</h1>
          <p className="text-gray-500">This document has already been signed. Thank you!</p>
        </div>
      </div>
    );
  }

  if (state === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Signed!</h1>
          <p className="text-gray-500 mb-2">Your signature has been recorded successfully.</p>
          <p className="text-gray-400 text-sm">A copy has been sent to your email and the adviser.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Document Signing</h1>
              <p className="text-xs text-gray-500">{doc?.document_name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{doc?.client_name}</p>
            <p className="text-xs text-gray-400">{doc?.client_email}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-8 px-6 space-y-8">
        {/* Client details summary */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Your Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400">Name:</span> <span className="text-gray-900 font-medium ml-2">{doc?.client_name}</span></div>
            <div><span className="text-gray-400">Email:</span> <span className="text-gray-900 font-medium ml-2">{doc?.client_email}</span></div>
            <div><span className="text-gray-400">Phone:</span> <span className="text-gray-900 font-medium ml-2">{doc?.client_phone || "—"}</span></div>
            <div><span className="text-gray-400">Address:</span> <span className="text-gray-900 font-medium ml-2">{doc?.client_address || "—"}</span></div>
          </div>
        </div>

        {/* PDF Preview */}
        {pdfUrl && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Document Preview</h2>
            </div>
            <iframe src={pdfUrl} className="w-full h-[500px]" title="Document" />
          </div>
        )}

        {/* Signature Area */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <PenTool className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Sign Below (Applied to both signature fields)
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Draw your signature using your mouse or finger. This signature will be automatically applied to both signature fields in the document.
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full cursor-crosshair touch-none"
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
            <button onClick={clearSignature} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Clear Signature
            </button>

            {signatureData && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Signature captured
              </span>
            )}
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!signatureData || submitting}
          className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20"
          size="lg"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Submitting...</>
          ) : (
            <><CheckCircle className="w-5 h-5 mr-2" /> Submit Signed Document</>
          )}
        </Button>

        <p className="text-xs text-gray-400 text-center">
          By signing, you agree to the terms of this document. A copy will be sent to you and your adviser.
        </p>
      </div>
    </div>
  );
}
