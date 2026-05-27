import { useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { EventBus, PDFLinkService, PDFScriptingManager } from "pdfjs-dist/web/pdf_viewer.mjs";
// Vite worker import.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
// Vite asset import for sandbox bundle (needed for AcroForm JS calculations).
import sandboxUrl from "pdfjs-dist/build/pdf.sandbox.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfFormEditorHandle = {
  /** Returns the filled PDF bytes (with all user input applied to AcroForm fields). */
  getFilledPdfBytes: () => Promise<Uint8Array>;
  /** Clear any auto-saved draft for this storageKey (call after successful save/download). */
  clearDraft: () => void;
};

interface Props {
  /** Public URL or path of the PDF (must be same origin or CORS enabled). */
  src: string;
  /** Render scale. */
  scale?: number;
  /**
   * Optional key for auto-persisting form input to localStorage so the user's
   * in-progress answers survive navigating away and coming back. Use a stable
   * value per logical document (e.g. "factfind:new" or `factfind:${docId}`).
   */
  storageKey?: string;
}

type PdfFieldObject = {
  id?: string;
  name?: string;
  value?: unknown;
  actions?: Record<string, string[]>;
};

type AnnotationStorageLike = {
  setValue: (key: string, value: Record<string, unknown>) => void;
};

type PdfDocumentWithFields = pdfjsLib.PDFDocumentProxy & {
  annotationStorage: AnnotationStorageLike;
  getFieldObjects: () => Promise<Record<string, PdfFieldObject[]> | null>;
  getCalculationOrderIds?: () => Promise<string[] | null>;
};

type ScriptingManagerLike = {
  setViewer: (viewer: unknown) => void;
  setDocument: (pdf: pdfjsLib.PDFDocumentProxy) => Promise<void> | void;
  dispatchWillSave?: () => Promise<void> | void;
  dispatchDidSave?: () => Promise<void> | void;
  destroy?: () => void;
};

type AnnotationLayerLike = {
  render: (params: Record<string, unknown>) => Promise<void> | void;
};

const ScriptingManagerCtor = PDFScriptingManager as unknown as new (options: {
  eventBus: EventBus;
  sandboxBundleSrc: string;
  wasmUrl: string;
}) => ScriptingManagerLike;

const AnnotationLayerCtor = (pdfjsLib as unknown as {
  AnnotationLayer: new (options: Record<string, unknown>) => AnnotationLayerLike;
}).AnnotationLayer;

const currencyFormatter = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });

const parseMoney = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number) => `$ ${currencyFormatter.format(Math.round(value || 0))}`;

const extractSimpleCalculation = (script?: string) => {
  const match = script?.match(/AFSimple_Calculate\("(SUM|PRD|AVG|MIN|MAX)",\s*new Array\s*\(([^)]*)\)\)/);
  if (!match) return null;
  const fields = [...match[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return { op: match[1], fields };
};

const setupManualMoneyCalculations = (
  container: HTMLDivElement,
  annotationStorage: AnnotationStorageLike,
  fieldObjects: Record<string, PdfFieldObject[]> | null,
  calculationOrderIds: string[] | null,
) => {
  if (!fieldObjects) return { sync: () => {}, cleanup: () => {} };

  const currencyFields = new Set<string>();
  const idToName = new Map<string, string>();
  const formulas = new Map<string, { op: string; fields: string[] }>();

  for (const [name, fields] of Object.entries(fieldObjects)) {
    for (const field of fields) {
      if (field.id) idToName.set(field.id, name);
      const formatAction = field.actions?.Format?.join("\n") ?? "";
      if (/AFNumber_Format/.test(formatAction) && (/\\u0024|\$/.test(formatAction))) {
        currencyFields.add(field.name || name);
      }
      const calculation = extractSimpleCalculation(field.actions?.Calculate?.[0]);
      if (calculation) formulas.set(field.name || name, calculation);
    }
  }

  const getElementsByName = (name: string) =>
    Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[name], textarea[name]"))
      .filter((element) => element.name === name);

  const getInitialValue = (name: string) => {
    const field = fieldObjects[name]?.find((item) => item.value !== undefined);
    return field?.value ?? "";
  };

  const syncStorage = (element: HTMLInputElement | HTMLTextAreaElement, raw: number, formatted: string) => {
    const id = element.getAttribute("data-element-id");
    if (!id) return;
    annotationStorage.setValue(id, { value: String(raw), formattedValue: formatted });
  };

  const setFieldValue = (name: string, raw: number) => {
    const formatted = currencyFields.has(name) ? formatMoney(raw) : String(raw);
    for (const element of getElementsByName(name)) {
      element.value = formatted;
      syncStorage(element, raw, formatted);
    }
  };

  const orderedFormulaNames = [
    ...(calculationOrderIds ?? []).map((id) => idToName.get(id)).filter((name): name is string => !!name && formulas.has(name)),
    ...Array.from(formulas.keys()).filter((name) => !(calculationOrderIds ?? []).some((id) => idToName.get(id) === name)),
  ];

  const calculate = (formatEditableFields = false) => {
    const computed = new Map<string, number>();
    const getValue = (name: string) => {
      if (computed.has(name)) return computed.get(name)!;
      const element = getElementsByName(name).find((item) => item.value.trim() !== "");
      return parseMoney(element?.value ?? getInitialValue(name));
    };

    for (const name of orderedFormulaNames) {
      const formula = formulas.get(name);
      if (!formula) continue;
      const values = formula.fields.map(getValue);
      const result = formula.op === "PRD"
        ? values.reduce((total, value) => total * value, values.length ? 1 : 0)
        : formula.op === "AVG"
          ? values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1)
          : formula.op === "MIN"
            ? Math.min(...values)
            : formula.op === "MAX"
              ? Math.max(...values)
              : values.reduce((total, value) => total + value, 0);
      computed.set(name, result);
      setFieldValue(name, result);
    }

    if (formatEditableFields) {
      for (const name of currencyFields) {
        for (const element of getElementsByName(name)) {
          if (element.disabled || !element.value.trim() || document.activeElement === element) continue;
          const raw = parseMoney(element.value);
          const formatted = formatMoney(raw);
          element.value = formatted;
          syncStorage(element, raw, formatted);
        }
      }
    }
  };

  let frame = 0;
  const scheduleCalculate = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => calculate(false));
  };
  const managedElements = Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[name], textarea[name]"),
  );
  const onFocus = (event: FocusEvent) => {
    const element = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!currencyFields.has(element.name) || element.disabled || !element.value.trim()) return;
    element.value = String(parseMoney(element.value) || "");
  };
  const onBlur = (event: FocusEvent) => {
    const element = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!currencyFields.has(element.name) || element.disabled) return;
    setTimeout(() => calculate(true), 0);
  };

  container.addEventListener("input", scheduleCalculate, true);
  container.addEventListener("change", scheduleCalculate, true);
  container.addEventListener("keyup", scheduleCalculate, true);
  container.addEventListener("focus", onFocus, true);
  container.addEventListener("blur", onBlur, true);
  managedElements.forEach((element) => element.addEventListener("updatefromsandbox", scheduleCalculate));
  setTimeout(() => calculate(true), 0);

  return {
    sync: () => calculate(true),
    cleanup: () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("input", scheduleCalculate, true);
      container.removeEventListener("change", scheduleCalculate, true);
      container.removeEventListener("keyup", scheduleCalculate, true);
      container.removeEventListener("focus", onFocus, true);
      container.removeEventListener("blur", onBlur, true);
      managedElements.forEach((element) => element.removeEventListener("updatefromsandbox", scheduleCalculate));
    },
  };
};

export const PdfFormEditor = forwardRef<PdfFormEditorHandle, Props>(
  ({ src, scale = 1.5, storageKey }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
    const scriptingRef = useRef<ScriptingManagerLike | null>(null);
    const manualCalculationSyncRef = useRef<(() => void) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Walk every form widget in the rendered annotation layer and push the
     * user's current value into the PDF's annotationStorage. Safety net before
     * saving: pdfjs scripting/storage wiring can silently fail (sandbox load
     * issues etc.) and leave the saved PDF blank.
     */
    const forceSyncAllFieldsToStorage = () => {
      const pdf = pdfRef.current;
      const container = containerRef.current;
      if (!pdf || !container) return;
      const storage = (pdf as unknown as { annotationStorage: AnnotationStorageLike })
        .annotationStorage;
      if (!storage?.setValue) return;

      const widgets = container.querySelectorAll<HTMLElement>(
        ".annotationLayer [data-annotation-id], .annotationLayer [data-element-id]",
      );
      widgets.forEach((widget) => {
        const id =
          widget.getAttribute("data-element-id") ||
          widget.getAttribute("data-annotation-id");
        if (!id) return;
        const input = (widget.matches("input,textarea,select")
          ? widget
          : widget.querySelector("input,textarea,select")) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        if (!input) return;
        try {
          if (
            input instanceof HTMLInputElement &&
            (input.type === "checkbox" || input.type === "radio")
          ) {
            storage.setValue(id, { value: input.checked });
          } else if (input instanceof HTMLSelectElement) {
            const values = Array.from(input.selectedOptions).map((o) => o.value);
            storage.setValue(id, {
              value: input.multiple ? values : values[0] ?? "",
            });
          } else {
            storage.setValue(id, { value: input.value ?? "" });
          }
        } catch {
          /* ignore individual field sync failures */
        }
      });
    };

    useImperativeHandle(ref, () => ({
      async getFilledPdfBytes() {
        if (!pdfRef.current) throw new Error("PDF not loaded");
        // Commit any focused field first so its value is in the DOM
        const active = document.activeElement as HTMLElement | null;
        if (
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT")
        ) {
          active.blur();
        }
        manualCalculationSyncRef.current?.();
        forceSyncAllFieldsToStorage();
        await scriptingRef.current?.dispatchWillSave?.();
        const bytes = await pdfRef.current.saveDocument();
        await scriptingRef.current?.dispatchDidSave?.();
        return bytes;
      },
      clearDraft() {
        if (!storageKey) return;
        try { localStorage.removeItem(`pdfFormEditor:${storageKey}`); } catch {}
      },
    }), [storageKey]);

    useEffect(() => {
      let cancelled = false;
      let manualCalculationCleanup: (() => void) | null = null;
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
          const calculationOrderIds = await (pdf as any).getCalculationOrderIds?.().catch(() => null) ?? null;

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

          const manualCalculations = setupManualMoneyCalculations(
            container,
            pdf.annotationStorage,
            fieldObjects,
            calculationOrderIds,
          );
          manualCalculationCleanup = manualCalculations.cleanup;
          manualCalculationSyncRef.current = manualCalculations.sync;

          // ---------- Auto-persist field values across navigation ----------
          // Snapshot every form widget into localStorage on input so leaving
          // the page and coming back doesn't wipe the user's work.
          let persistCleanup: (() => void) | null = null;
          if (storageKey) {
            const lsKey = `pdfFormEditor:${storageKey}`;
            type Snapshot = Record<string, { type: string; value: string | boolean | string[] }>;

            const collectInputs = () =>
              Array.from(
                container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
                  ".annotationLayer input, .annotationLayer textarea, .annotationLayer select",
                ),
              );

            const keyFor = (el: HTMLElement) => {
              const widget = el.closest<HTMLElement>("[data-annotation-id], [data-element-id]");
              const id =
                widget?.getAttribute("data-element-id") ||
                widget?.getAttribute("data-annotation-id") ||
                "";
              const name = (el as HTMLInputElement).name || "";
              // Combine id + name + type so radio groups don't collide.
              return `${id}|${name}|${(el as HTMLInputElement).type || el.tagName}`;
            };

            // Restore first.
            try {
              const raw = localStorage.getItem(lsKey);
              if (raw) {
                const snap: Snapshot = JSON.parse(raw);
                const storage = pdf.annotationStorage;
                for (const el of collectInputs()) {
                  const k = keyFor(el);
                  const entry = snap[k];
                  if (!entry) continue;
                  const widget = el.closest<HTMLElement>("[data-annotation-id], [data-element-id]");
                  const annId =
                    widget?.getAttribute("data-element-id") ||
                    widget?.getAttribute("data-annotation-id") ||
                    "";
                  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
                    el.checked = !!entry.value;
                    if (annId) storage.setValue(annId, { value: el.checked });
                  } else if (el instanceof HTMLSelectElement) {
                    const values = Array.isArray(entry.value) ? entry.value : [String(entry.value ?? "")];
                    for (const opt of Array.from(el.options)) opt.selected = values.includes(opt.value);
                    if (annId) storage.setValue(annId, { value: el.multiple ? values : values[0] ?? "" });
                  } else {
                    el.value = String(entry.value ?? "");
                    if (annId) storage.setValue(annId, { value: el.value });
                  }
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                }
                // Re-run formulas after restoring.
                manualCalculations.sync();
              }
            } catch (err) {
              console.warn("[PdfFormEditor] restore failed:", err);
            }

            // Persist on every change.
            let persistTimer: number | undefined;
            const persist = () => {
              window.clearTimeout(persistTimer);
              persistTimer = window.setTimeout(() => {
                try {
                  const snap: Snapshot = {};
                  for (const el of collectInputs()) {
                    const k = keyFor(el);
                    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
                      snap[k] = { type: el.type, value: el.checked };
                    } else if (el instanceof HTMLSelectElement) {
                      const vals = Array.from(el.selectedOptions).map((o) => o.value);
                      snap[k] = { type: "select", value: el.multiple ? vals : vals[0] ?? "" };
                    } else {
                      snap[k] = { type: (el as HTMLInputElement).type || "text", value: el.value };
                    }
                  }
                  localStorage.setItem(lsKey, JSON.stringify(snap));
                } catch (err) {
                  console.warn("[PdfFormEditor] persist failed:", err);
                }
              }, 250);
            };
            container.addEventListener("input", persist, true);
            container.addEventListener("change", persist, true);
            persistCleanup = () => {
              window.clearTimeout(persistTimer);
              container.removeEventListener("input", persist, true);
              container.removeEventListener("change", persist, true);
            };
          }
          // Stash cleanup so the outer effect teardown runs it.
          (manualCalculationCleanup as any) = (function (prev) {
            return () => { prev?.(); persistCleanup?.(); };
          })(manualCalculationCleanup);

          setLoading(false);
        } catch (e: any) {
          console.error("[PdfFormEditor]", e);
          setError(e?.message || "Failed to load PDF");
          setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
        manualCalculationCleanup?.();
        manualCalculationSyncRef.current = null;
        try { scriptingRef.current?.destroy?.(); } catch {}
        scriptingRef.current = null;
        pdfRef.current?.destroy();
        pdfRef.current = null;
      };
    }, [src, scale, storageKey]);

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
             value, so the underlay just produces ghost text.
             IMPORTANT: use visibility:hidden (not display:none) so pdfjs's
             internal element refs still resolve. display:none breaks the
             annotation layer's wiring into annotationStorage and causes
             saveDocument() to write a blank PDF. */
          .pdf-form-editor .annotationLayer .textWidgetAnnotation > :not(input):not(textarea),
          .pdf-form-editor .annotationLayer .textWidgetAnnotation canvas,
          .pdf-form-editor .annotationLayer .textWidgetAnnotation svg {
            visibility: hidden !important;
            pointer-events: none !important;
          }
          .pdf-form-editor .annotationLayer .textWidgetAnnotation {
            background: #ffffff;
          }
          .pdf-form-editor .annotationLayer .textWidgetAnnotation input,
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
