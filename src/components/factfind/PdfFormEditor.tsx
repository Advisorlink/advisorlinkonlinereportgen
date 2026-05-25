import { useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfFormEditorHandle = {
  /** Returns the filled PDF bytes (with all user input applied to AcroForm fields). */
  getFilledPdfBytes: () => Promise<Uint8Array>;
};

interface Props {
  /** Public URL or path of the PDF (must be same origin or CORS enabled). */
  src: string;
  /** Render scale. */
  scale?: number;
}

export const PdfFormEditor = forwardRef<PdfFormEditorHandle, Props>(
  ({ src, scale = 1.3 }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      async getFilledPdfBytes() {
        if (!pdfRef.current) throw new Error("PDF not loaded");
        const bytes = await pdfRef.current.saveDocument();
        return bytes;
      },
    }), []);

    useEffect(() => {
      let cancelled = false;
      const container = containerRef.current;
      if (!container) return;

      (async () => {
        try {
          setLoading(true);
          setError(null);
          container.innerHTML = "";

          const loadingTask = pdfjsLib.getDocument({ url: src });
          const pdf = await loadingTask.promise;
          if (cancelled) return;
          pdfRef.current = pdf;

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            const pageWrap = document.createElement("div");
            pageWrap.className =
              "relative mx-auto mb-4 bg-white shadow-md rounded overflow-hidden";
            pageWrap.style.width = `${viewport.width}px`;
            pageWrap.style.height = `${viewport.height}px`;

            const canvas = document.createElement("canvas");
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.height = Math.floor(viewport.height * dpr);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
            const ctx = canvas.getContext("2d")!;
            ctx.scale(dpr, dpr);
            pageWrap.appendChild(canvas);

            const annotationDiv = document.createElement("div");
            annotationDiv.className = "annotationLayer";
            annotationDiv.style.position = "absolute";
            annotationDiv.style.inset = "0";
            annotationDiv.style.width = `${viewport.width}px`;
            annotationDiv.style.height = `${viewport.height}px`;
            // Provide CSS variables pdf.js relies on for sizing form widgets
            annotationDiv.style.setProperty(
              "--scale-factor",
              String(viewport.scale),
            );
            pageWrap.appendChild(annotationDiv);

            container.appendChild(pageWrap);

            await page.render({
              canvasContext: ctx,
              viewport,
              annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS,
            }).promise;

            const annotations = await page.getAnnotations({ intent: "display" });

            // Use AnnotationLayer (pdfjs v5 API)
            const annotationLayer = new (pdfjsLib as any).AnnotationLayer({
              div: annotationDiv,
              page,
              viewport: viewport.clone({ dontFlip: true }),
              accessibilityManager: null,
              annotationCanvasMap: null,
              annotationEditorUIManager: null,
              structTreeLayer: null,
            });

            await annotationLayer.render({
              annotations,
              imageResourcesPath: "",
              renderForms: true,
              linkService: {
                externalLinkTarget: 2,
                externalLinkRel: "noopener noreferrer nofollow",
                externalLinkEnabled: true,
                getDestinationHash: () => "#",
                getAnchorUrl: () => "#",
                isPageVisible: () => true,
                isInPresentationMode: false,
                addLinkAttributes: () => {},
              },
              downloadManager: null,
              annotationStorage: pdf.annotationStorage,
              enableScripting: false,
              hasJSActions: false,
              fieldObjects: null,
            });
          }

          setLoading(false);
        } catch (e: any) {
          console.error("[PdfFormEditor]", e);
          setError(e?.message || "Failed to load PDF");
          setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
        pdfRef.current?.destroy();
        pdfRef.current = null;
      };
    }, [src, scale]);

    return (
      <div className="w-full">
        {loading && (
          <div className="text-center py-12 text-muted-foreground">
            Loading editable PDF…
          </div>
        )}
        {error && (
          <div className="text-center py-12 text-destructive">{error}</div>
        )}
        <div
          ref={containerRef}
          className="pdf-form-editor max-h-[80vh] overflow-y-auto bg-muted/30 p-4 rounded-lg"
        />
        <style>{`
          .pdf-form-editor .annotationLayer { position: absolute; inset: 0; pointer-events: auto; transform-origin: 0 0; }
          .pdf-form-editor .annotationLayer section { position: absolute; pointer-events: auto; }
          .pdf-form-editor .annotationLayer .textWidgetAnnotation input,
          .pdf-form-editor .annotationLayer .textWidgetAnnotation textarea,
          .pdf-form-editor .annotationLayer .choiceWidgetAnnotation select {
            background: rgba(0, 130, 255, 0.08);
            border: 1px solid rgba(0, 130, 255, 0.4);
            border-radius: 2px;
            box-sizing: border-box;
            font: inherit;
            padding: 0 2px;
            width: 100%;
            height: 100%;
            color: #000;
          }
          .pdf-form-editor .annotationLayer .buttonWidgetAnnotation.checkBox input,
          .pdf-form-editor .annotationLayer .buttonWidgetAnnotation.radioButton input {
            width: 100%; height: 100%; margin: 0;
          }
          .pdf-form-editor .annotationLayer .textWidgetAnnotation input:focus,
          .pdf-form-editor .annotationLayer .textWidgetAnnotation textarea:focus {
            outline: 2px solid hsl(var(--primary)); background: rgba(0, 130, 255, 0.15);
          }
        `}</style>
      </div>
    );
  },
);

PdfFormEditor.displayName = "PdfFormEditor";
