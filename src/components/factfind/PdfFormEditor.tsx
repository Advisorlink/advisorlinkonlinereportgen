import { useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { EventBus, PDFLinkService, PDFScriptingManager } from "pdfjs-dist/web/pdf_viewer.mjs";
// @ts-ignore - vite worker import
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
// @ts-ignore - vite asset import for sandbox bundle (needed for AcroForm JS calculations)
import sandboxUrl from "pdfjs-dist/build/pdf.sandbox.min.mjs?url";

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
  ({ src, scale = 1.5 }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
    const scriptingRef = useRef<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      async getFilledPdfBytes() {
        if (!pdfRef.current) throw new Error("PDF not loaded");
        await scriptingRef.current?.dispatchWillSave?.();
        const bytes = await pdfRef.current.saveDocument();
        await scriptingRef.current?.dispatchDidSave?.();
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

          const loadingTask = pdfjsLib.getDocument({
            url: src,
            enableXfa: true,
          });
          const pdf = await loadingTask.promise;
          if (cancelled) return;
          pdfRef.current = pdf;

          const eventBus = new EventBus();
          const linkService = new PDFLinkService({
            eventBus,
            externalLinkTarget: 2,
            externalLinkRel: "noopener noreferrer nofollow",
          });
          linkService.setDocument(pdf);
          linkService.externalLinkEnabled = true;

          const pageViews: Array<{ pdfPage: pdfjsLib.PDFPageProxy; renderingState: number }> = [];
          const viewer = {
            currentPageNumber: 1,
            pagesCount: pdf.numPages,
            pagesPromise: Promise.resolve(),
            isInPresentationMode: false,
            isChangingPresentationMode: false,
            getPageView: (index: number) => pageViews[index],
            nextPage: () => { viewer.currentPageNumber = Math.min(pdf.numPages, viewer.currentPageNumber + 1); },
            previousPage: () => { viewer.currentPageNumber = Math.max(1, viewer.currentPageNumber - 1); },
            increaseScale: () => {},
            decreaseScale: () => {},
            currentScaleValue: "auto",
            spreadMode: 0,
          } as any;
          linkService.setViewer(viewer);

          // Set up scripting manager so AcroForm JavaScript calculations
          // (BMI, totals, etc.) actually run as the user fills the form.
          let scriptingManager: any = null;
          try {
            scriptingManager = new PDFScriptingManager({
              eventBus,
              sandboxBundleSrc: sandboxUrl,
              wasmUrl: "/pdfjs/wasm/",
            } as any);
            scriptingManager.setViewer(viewer);
            scriptingRef.current = scriptingManager;
          } catch (e) {
            console.warn("[PdfFormEditor] scripting disabled:", e);
          }

          const hasJSActions = await pdf.hasJSActions().catch(() => false);
          const fieldObjects = await (pdf as any).getFieldObjects().catch(() => null);

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            const pageWrap = document.createElement("div");
            pageWrap.className =
              "relative mx-auto mb-4 bg-white shadow-md rounded overflow-hidden";
            pageWrap.style.width = `${viewport.width}px`;
            pageWrap.style.height = `${viewport.height}px`;
            pageWrap.setAttribute("data-page-number", String(pageNum));

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
            annotationDiv.style.setProperty("--scale-factor", String(viewport.scale));
            pageWrap.appendChild(annotationDiv);

            container.appendChild(pageWrap);

            await page.render({
              canvas,
              canvasContext: ctx,
              viewport,
              // ENABLE_FORMS = render annotations on canvas EXCEPT form widgets
              // (those are drawn by the HTML annotation layer below, so we don't
              // get the field's stale baked-in "$0" / "0.00" appearance ghosting
              // through behind the live calculated values).
              annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS,
            } as any).promise;
            pageViews[pageNum - 1] = { pdfPage: page, renderingState: 3 };
            eventBus.dispatch("pagerendered", { source: page, pageNumber: pageNum });

            const annotations = await page.getAnnotations({ intent: "display" });

            const annotationLayer = new (pdfjsLib as any).AnnotationLayer({
              div: annotationDiv,
              page,
              viewport: viewport.clone({ dontFlip: true }),
              accessibilityManager: null,
              annotationCanvasMap: null,
              annotationEditorUIManager: null,
              structTreeLayer: null,
              linkService,
            });

            await annotationLayer.render({
              annotations,
              imageResourcesPath: "",
              renderForms: true,
              linkService,
              downloadManager: null,
              annotationStorage: pdf.annotationStorage,
              enableScripting: !!scriptingManager,
              hasJSActions,
              fieldObjects,
            });
          }

          // Start the scripting sandbox now that pages + widgets exist
          if (scriptingManager) {
            try {
              await scriptingManager.setDocument(pdf);
            } catch (e) {
              console.warn("[PdfFormEditor] scripting startup failed:", e);
            }
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
        try { scriptingRef.current?.destroyPromise; } catch {}
        scriptingRef.current = null;
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
          className="pdf-form-editor max-h-[85vh] overflow-y-auto bg-muted/30 p-4 rounded-lg"
        />
        <style>{`
          .pdf-form-editor .annotationLayer { position: absolute; inset: 0; pointer-events: auto; transform-origin: 0 0; }
          .pdf-form-editor .annotationLayer section { position: absolute; pointer-events: auto; }
          /* Hide any baked-in widget appearance stream (e.g. canvas/svg the
             annotation layer paints under the input showing the field's saved
             "$0" / "0.00" value). The live HTML input above shows the current
             value, so the underlay just produces ghost text. */
          .pdf-form-editor .annotationLayer .textWidgetAnnotation > :not(input):not(textarea),
          .pdf-form-editor .annotationLayer .textWidgetAnnotation canvas,
          .pdf-form-editor .annotationLayer .textWidgetAnnotation svg {
            display: none !important;
          }
          .pdf-form-editor .annotationLayer .textWidgetAnnotation {
            background: #ffffff;
          }
          .pdf-form-editor .annotationLayer .textWidgetAnnotation textarea,
          .pdf-form-editor .annotationLayer .choiceWidgetAnnotation select {
            background: #ffffff;
            border: 1px solid rgba(0, 130, 255, 0.4);
            border-radius: 2px;
            box-sizing: border-box;
            font-family: inherit;
            padding: 0 3px;
            margin: 0;
            width: 100%;
            height: 100%;
            color: #000;
            line-height: 1.1;
            vertical-align: middle;
            /* Don't clip the caret/glyphs at the top */
            overflow: visible;
          }
          /* Auto-shrink font so text never gets clipped vertically */
          .pdf-form-editor .annotationLayer .textWidgetAnnotation input {
            font-size: calc(9px * var(--scale-factor, 1));
          }
          .pdf-form-editor .annotationLayer .textWidgetAnnotation textarea {
            font-size: calc(9px * var(--scale-factor, 1));
            resize: none;
          }
          .pdf-form-editor .annotationLayer .buttonWidgetAnnotation.checkBox input,
          .pdf-form-editor .annotationLayer .buttonWidgetAnnotation.radioButton input {
            width: 100%; height: 100%; margin: 0;
          }
          .pdf-form-editor .annotationLayer .textWidgetAnnotation input:focus,
          .pdf-form-editor .annotationLayer .textWidgetAnnotation textarea:focus {
            outline: 2px solid hsl(var(--primary));
            background: rgba(0, 130, 255, 0.15);
            /* Let focused field grow slightly to show full text without clipping */
            z-index: 10;
          }
        `}</style>
      </div>
    );
  },
);

PdfFormEditor.displayName = "PdfFormEditor";
