import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Shield, Lock, FileCheck2, Camera, Upload, CheckCircle2,
  IdCard, FileText, Image as ImageIcon, ArrowRight, ArrowLeft,
  Loader2, X, ChevronRight, Plus, Check,
} from "lucide-react";
import { z } from "zod";

const LOGO_BLACK_URL = "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png";
const PURE_LOGO_URL = "/pure-private-wealth-logo.png";

const REPRESENTATIVES = [
  "Travis Seckold",
  "Stas Stanislav",
];

// Four design variants for the user to A/B test the look & feel.
// Only colour, surface, font feel and button radius change — the flow is identical.
type VariantConfig = {
  label: string;
  page: string;       // page background
  ink: string;        // primary ink colour (HSL inside arbitrary value)
  accent: string;     // accent colour (HSL)
  surface: string;    // card/surface background
  border: string;     // standard border colour
  radius: string;     // tailwind radius class for cards
  btnRadius: string;  // tailwind radius for buttons
  heading: string;    // heading font class
  vibe: string;       // short description shown in switcher
};

const VARIANTS: Record<1 | 2 | 3 | 4 | 5, VariantConfig> = {
  1: {
    label: "AdvisorLink",
    page: "bg-[hsl(var(--page-alt))]",
    ink: "215 60% 12%",
    accent: "192 90% 42%",
    surface: "bg-white",
    border: "border-[hsl(var(--ink))]/10",
    radius: "rounded-xl",
    btnRadius: "rounded-lg",
    heading: "font-heading",
    vibe: "Navy · cyan · product feel",
  },
  2: {
    label: "Private Bank",
    page: "bg-[hsl(var(--page-alt))]",
    ink: "215 60% 12%",
    accent: "215 60% 12%",
    surface: "bg-white",
    border: "border-[hsl(var(--ink))]/10",
    radius: "rounded-md",
    btnRadius: "rounded-sm",
    heading: "font-heading",
    vibe: "Ivory · navy · editorial",
  },
  3: {
    label: "Soft Modern",
    page: "bg-[#f4f6fb]",
    ink: "222 47% 18%",
    accent: "221 83% 53%",
    surface: "bg-white",
    border: "border-[hsl(222_47%_18%)]/8",
    radius: "rounded-2xl",
    btnRadius: "rounded-xl",
    heading: "font-sans",
    vibe: "Rounded · airy · blue accent",
  },
  4: {
    label: "Mono Lux",
    page: "bg-black",
    ink: "0 0% 100%",
    accent: "45 85% 60%",
    surface: "bg-[#0e0e0e]",
    border: "border-white/10",
    radius: "rounded-none",
    btnRadius: "rounded-none",
    heading: "font-heading",
    vibe: "Black · gold · brutalist",
  },
  5: {
    label: "Warm Trust",
    page: "bg-[#faf6f1]",
    ink: "20 30% 18%",
    accent: "16 72% 46%",
    surface: "bg-white",
    border: "border-[hsl(20_30%_18%)]/10",
    radius: "rounded-3xl",
    btnRadius: "rounded-full",
    heading: "font-heading",
    vibe: "Warm · terracotta · friendly",
  },
};

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your first name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  representative: z.string().trim().min(1, "Please select your consultant"),
});

type DocType = "license";

type CapturedFile = {
  id: string;
  docType: DocType;
  label: string;
  file: File;
  preview: string;
};

const MAX_BYTES = 10 * 1024 * 1024;

type Stage =
  | "license_method"
  | "license_camera"
  | "license_upload"
  | "review"
  | "details"
  | "done";

export default function LicenseUpload() {
  const [stage, setStage] = useState<Stage>("license_method");
  const [captured, setCaptured] = useState<CapturedFile[]>([]);
  const [client, setClient] = useState({ fullName: "", email: "", representative: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  // license/statement capture sub-state
  const [licenseSide, setLicenseSide] = useState<"front" | "back">("front");
  const [statementCount, setStatementCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [captureBanner, setCaptureBanner] = useState<string | null>(null);

  // Design variant (1–4) for testing different aesthetics
  const [variant, setVariant] = useState<1 | 2 | 3 | 4 | 5>(3);
  const v = VARIANTS[variant];

  const showCaptureBanner = (msg: string) => {
    setCaptureBanner(msg);
    setTimeout(() => setCaptureBanner(null), 1400);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputContextRef = useRef<{ docType: DocType; label: string; useCamera: boolean } | null>(null);

  const addCaptured = (item: CapturedFile) => {
    setCaptured((prev) => [...prev, item]);
  };

  const removeCaptured = (id: string) => {
    setCaptured((prev) => {
      const found = prev.find((c) => c.id === id);
      if (found?.preview) URL.revokeObjectURL(found.preview);
      return prev.filter((c) => c.id !== id);
    });
  };

  const fileFromPick = (file: File, docType: DocType, label: string) => {
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: `${file.name} exceeds 10MB` });
      return null;
    }
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      docType,
      label,
      file,
      preview,
    } as CapturedFile;
  };

  const triggerFilePick = (docType: DocType, label: string, useCamera: boolean) => {
    fileInputContextRef.current = { docType, label, useCamera };
    const el = fileInputRef.current;
    if (!el) return;
    el.value = "";
    if (useCamera) {
      el.setAttribute("accept", "image/*");
      el.setAttribute("capture", "environment");
    } else {
      el.setAttribute("accept", "image/*");
      el.removeAttribute("capture");
    }
    el.click();
  };

  const onHiddenFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ctx = fileInputContextRef.current;
    const file = e.target.files?.[0];
    if (!file || !ctx) return;
    const item = fileFromPick(file, ctx.docType, ctx.label);
    if (!item) return;

    if (ctx.docType === "license") {
      addCaptured(item);
      if (licenseSide === "front") {
        setLicenseSide("back");
      } else {
        setLicenseSide("front");
        setStage("review");
      }
    } else {
      addCaptured(item);
      setStage("review");
    }
  };

  // ===== Live camera =====
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err) {
      console.error(err);
      toast.error("Camera unavailable", { description: "Please use 'Upload photo' instead." });
      setStage((s) => (s === "license_camera" ? "license_method" : s));
    }
  }, [stopCamera]);

  useEffect(() => {
    if (stage === "license_camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [stage, startCamera, stopCamera]);

  // Capture cropped to overlay rectangle
  const captureCropped = (label: string, docType: DocType): Promise<CapturedFile | null> => {
    return new Promise((resolve) => {
      const v = videoRef.current;
      const overlay = overlayRef.current;
      if (!v || !v.videoWidth || !overlay) return resolve(null);

      const vw = v.videoWidth;
      const vh = v.videoHeight;
      const containerRect = v.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();

      // object-cover scale
      const scale = Math.max(containerRect.width / vw, containerRect.height / vh);
      const displayedW = vw * scale;
      const displayedH = vh * scale;
      const offsetX = (displayedW - containerRect.width) / 2;
      const offsetY = (displayedH - containerRect.height) / 2;

      const relX = overlayRect.left - containerRect.left + offsetX;
      const relY = overlayRect.top - containerRect.top + offsetY;

      let srcX = relX / scale;
      let srcY = relY / scale;
      let srcW = overlayRect.width / scale;
      let srcH = overlayRect.height / scale;

      // Clamp
      srcX = Math.max(0, Math.min(srcX, vw - 1));
      srcY = Math.max(0, Math.min(srcY, vh - 1));
      srcW = Math.max(1, Math.min(srcW, vw - srcX));
      srcH = Math.max(1, Math.min(srcH, vh - srcY));

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(srcW);
      canvas.height = Math.round(srcH);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(v, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          const file = new File([blob], `${docType}-${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          resolve({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            docType,
            label,
            file,
            preview: URL.createObjectURL(blob),
          });
        },
        "image/jpeg",
        0.92,
      );
    });
  };

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
  };

  const handleLicenseCapture = async () => {
    if (busy || !cameraReady) return;
    setBusy(true);
    const label = licenseSide === "front" ? "Licence — Front" : "Licence — Back";
    const item = await captureCropped(label, "license");
    if (!item) {
      setBusy(false);
      return toast.error("Couldn't capture image, try again");
    }
    triggerFlash();
    addCaptured(item);
    if (licenseSide === "front") {
      setLicenseSide("back");
      showCaptureBanner("Front saved — now capture the back");
      setBusy(false);
    } else {
      showCaptureBanner("Back saved");
      setLicenseSide("front");
      stopCamera();
      setStage("review");
      setBusy(false);
    }
  };

  // ===== Submit =====
  const handleSubmit = async () => {
    const result = detailsSchema.safeParse(client);
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
      setErrors(fe);
      return;
    }
    if (!consent) {
      toast.error("Please accept the privacy consent to continue");
      return;
    }
    if (captured.length === 0) {
      toast.error("Please add at least one document");
      setStage("license_method");
      return;
    }
    setErrors({});
    setSubmitting(true);
    setProgress(5);
    try {
      const slug = client.email.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const folder = `${slug}/${Date.now()}`;
      const total = captured.length;
      let done = 0;
      for (const item of captured) {
        const ext = item.file.name.split(".").pop() || "jpg";
        const path = `${folder}/${item.docType}_${item.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("client-documents")
          .upload(path, item.file, { contentType: item.file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("client_documents").insert({
          client_name: client.fullName,
          client_email: client.email,
          client_phone: `Adviser: ${client.representative}`,
          document_type: item.docType,
          file_path: path,
          file_name: item.file.name,
          file_size: item.file.size,
          mime_type: item.file.type,
          consent_given: true,
          notes: item.label,
        });
        if (dbErr) throw dbErr;
        done += 1;
        setProgress(Math.round((done / total) * 100));
      }
      setStage("done");
    } catch (e: unknown) {
      console.error(e);
      toast.error("Upload failed", { description: e instanceof Error ? e.message : "Please try again" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen ${v.page} text-[hsl(var(--ink))]`}
      style={{
        // CSS variables consumed by all interior `[hsl(var(--ink))]` / `[hsl(var(--page-alt))]` classes.
        ["--ink" as never]: v.ink,
        ["--accent" as never]: v.accent,
        ["--page-alt" as never]:
          variant === 4 ? "0 0% 8%" : variant === 3 ? "220 30% 96%" : variant === 5 ? "30 40% 94%" : variant === 2 ? "44 33% 95%" : "210 30% 97%",
      } as React.CSSProperties}
    >
      {/* ============ VARIANT-SPECIFIC HEADER ============ */}
      {variant === 1 && (
        // AdvisorLink — product feel, dark navy bar with cyan rule
        <header className="relative overflow-hidden bg-[hsl(215_60%_10%)] text-white">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(192_90%_50%)]/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-[hsl(192_90%_60%)]/15 blur-3xl" />
          <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5">
            <img src={LOGO_BLACK_URL} alt="Advisor Link Online" className="h-9 w-auto invert" />
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(192_90%_55%)] shadow-[0_0_12px_2px_hsl(192_90%_55%)]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Secure Channel</span>
            </div>
            <img src={PURE_LOGO_URL} alt="Pure Private Wealth" className="h-14 w-auto invert sm:h-16" />
          </div>
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(192_90%_55%)] to-transparent" />
        </header>
      )}

      {variant === 2 && (
        // Private Bank — editorial, hairline rules, centered crest
        <header className="bg-[hsl(var(--page-alt))]">
          <div className="mx-auto max-w-3xl px-5 pt-7">
            <div className="flex items-center justify-between gap-4 pb-5">
              <img src={LOGO_BLACK_URL} alt="Advisor Link Online" className="h-7 w-auto opacity-80" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[hsl(var(--ink))]/50">Confidential</span>
              <img src={PURE_LOGO_URL} alt="Pure Private Wealth" className="h-12 w-auto sm:h-14" />
            </div>
            <div className="border-t border-[hsl(var(--ink))]/30" />
            <div className="mt-px border-t border-[hsl(var(--ink))]/15" />
          </div>
        </header>
      )}

      {variant === 3 && (
        // Soft Modern — pill nav floating on tinted surface
        <header className="bg-[hsl(var(--page-alt))] pt-5">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl bg-white px-5 py-3 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] sm:mx-5 md:mx-auto">
            <img src={LOGO_BLACK_URL} alt="Advisor Link Online" className="h-8 w-auto" />
            <div className="flex items-center gap-2 rounded-full bg-[hsl(221_83%_53%)]/8 px-3 py-1 text-[hsl(221_83%_45%)]">
              <ArrowRight className="h-3 w-3" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Sharing with</span>
            </div>
            <img src={PURE_LOGO_URL} alt="Pure Private Wealth" className="h-12 w-auto sm:h-14" />
          </div>
        </header>
      )}

      {variant === 4 && (
        // Mono Lux — full bleed black, gold hairline, oversized typography
        <header className="bg-black text-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-6">
            <img src={LOGO_BLACK_URL} alt="Advisor Link Online" className="h-8 w-auto invert" />
            <div className="text-[9px] font-bold uppercase tracking-[0.5em] text-[hsl(45_85%_60%)]">Vault · Secure</div>
            <img src={PURE_LOGO_URL} alt="Pure Private Wealth" className="h-12 w-auto invert sm:h-14" />
          </div>
          <div className="h-px w-full bg-[hsl(45_85%_60%)]" />
        </header>
      )}

      {variant === 5 && (
        // Warm Trust — illustrated peach band, rounded card
        <header className="bg-[#f5e6d8]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5">
            <img src={LOGO_BLACK_URL} alt="Advisor Link Online" className="h-9 w-auto" />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-px w-8 bg-[hsl(16_72%_46%)]/60" />
              <ArrowRight className="h-4 w-4 text-[hsl(16_72%_46%)]" />
              <span className="h-px w-8 bg-[hsl(16_72%_46%)]/60" />
            </div>
            <img src={PURE_LOGO_URL} alt="Pure Private Wealth" className="h-14 w-auto sm:h-16" />
          </div>
        </header>
      )}

      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        {/* Progress strip */}
        <div className="mb-6 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(var(--ink))]/55">
          <Lock className="h-3 w-3" /> Secure document upload for Pure Private Wealth
        </div>

        {/* ============ LICENSE — METHOD ============ */}
        {stage === "license_method" && (
          <section className="page-enter rounded-md border border-[hsl(var(--ink))]/10 bg-white p-6">
            <h2 className="font-heading text-xl font-bold text-[hsl(var(--ink))]">Photo ID</h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--ink))]/65">We'll capture the front and back. Choose how you'd like to add the photos.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => { setLicenseSide("front"); setStage("license_camera"); }}
                className="group flex flex-col items-center gap-2 rounded-md bg-white p-6 text-center shadow-[0_4px_14px_rgba(15,23,42,0.08)] ring-1 ring-[hsl(var(--ink))]/5 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
              >
                <Camera className="h-7 w-7 text-[hsl(var(--ink))]" />
                <p className="text-[14px] font-semibold text-[hsl(var(--ink))]">Take photo</p>
                <p className="text-[11px] text-[hsl(var(--ink))]/55">Use your camera</p>
              </button>
              <button
                onClick={() => { setLicenseSide("front"); setStage("license_upload"); }}
                className="group flex flex-col items-center gap-2 rounded-md bg-white p-6 text-center shadow-[0_4px_14px_rgba(15,23,42,0.08)] ring-1 ring-[hsl(var(--ink))]/5 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
              >
                <Upload className="h-7 w-7 text-[hsl(var(--ink))]" />
                <p className="text-[14px] font-semibold text-[hsl(var(--ink))]">Upload photo</p>
                <p className="text-[11px] text-[hsl(var(--ink))]/55">From your device</p>
              </button>
            </div>
          </section>
        )}

        {/* ============ LICENSE — UPLOAD ============ */}
        {stage === "license_upload" && (
          <section className="page-enter rounded-md border border-[hsl(var(--ink))]/10 bg-white p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(var(--ink))]/55">
              {licenseSide === "front" ? "Step 1 of 2" : "Step 2 of 2"}
            </p>
            <h2 className="mt-1 font-heading text-xl font-bold text-[hsl(var(--ink))]">
              Upload {licenseSide === "front" ? "FRONT OF ID" : "BACK OF ID"}
            </h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--ink))]/65">
              Choose a clear photo from your device. Make sure all details are readable.
            </p>
            <Button
              onClick={() => triggerFilePick("license", licenseSide === "front" ? "FRONT OF ID" : "BACK OF ID", false)}
              size="lg"
              className="mt-5 h-12 w-full rounded-sm bg-[hsl(var(--ink))] font-semibold text-white hover:bg-[hsl(215_60%_18%)]"
            >
              <Upload className="mr-2 h-4 w-4" /> Choose photo
            </Button>
            <button
              onClick={() => { setLicenseSide("front"); setStage("license_method"); }}
              className="mt-3 w-full text-center text-[12px] text-[hsl(var(--ink))]/55 hover:text-[hsl(var(--ink))]"
            >
              ← Back
            </button>
          </section>
        )}


        {/* ============ REVIEW ============ */}
        {stage === "review" && (
          <section className="page-enter space-y-4">
            <div className="rounded-md border border-[hsl(var(--ink))]/10 bg-white p-6">
              <h2 className="font-heading text-xl font-bold text-[hsl(var(--ink))]">Your documents</h2>
              <p className="mt-1 text-[13px] text-[hsl(var(--ink))]/65">
                {captured.length} item{captured.length === 1 ? "" : "s"} ready to send. Add more or continue.
              </p>
              <div className="mt-4 space-y-2">
                {captured.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-sm border border-[hsl(var(--ink))]/10 bg-[hsl(var(--page-alt))] p-2">
                    {c.preview ? (
                      <img src={c.preview} alt="" className="h-12 w-16 rounded-sm object-cover ring-1 ring-[hsl(var(--ink))]/10" />
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded-sm bg-white">
                        <FileText className="h-5 w-5 text-[hsl(var(--ink))]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[hsl(var(--ink))]">{c.label}</p>
                      <p className="text-[11px] text-[hsl(var(--ink))]/55">
                        {(c.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    <button
                      onClick={() => removeCaptured(c.id)}
                      className="rounded-sm p-1 text-[hsl(var(--ink))]/40 hover:bg-[hsl(var(--ink))]/[0.06] hover:text-[hsl(var(--ink))]"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStage("choose")}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-[hsl(var(--ink))]/25 bg-white py-3 text-[13px] font-semibold text-[hsl(var(--ink))] hover:border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))]/[0.03]"
              >
                <Plus className="h-4 w-4" /> Add another document
              </button>
            </div>
            <Button
              onClick={() => setStage("details")}
              disabled={captured.length === 0}
              size="lg"
              className="h-12 w-full rounded-sm bg-[hsl(var(--ink))] font-semibold text-white hover:bg-[hsl(215_60%_18%)]"
            >
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </section>
        )}

        {/* ============ DETAILS ============ */}
        {stage === "details" && (
          <section className="page-enter overflow-hidden rounded-md border border-[hsl(var(--ink))]/10 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="border-b border-[hsl(var(--ink))]/10 bg-[hsl(var(--ink))] px-7 py-5 text-white">
              <h2 className="font-heading text-lg font-semibold">Almost done</h2>
              <p className="mt-0.5 text-[12px] text-white/65">
                Tell us who you are so we can send these to the right adviser.
              </p>
            </div>
            <div className="space-y-5 px-7 py-7">
              <div>
                <Label htmlFor="fullName" className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--ink))]/70">First name</Label>
                <Input
                  id="fullName"
                  value={client.fullName}
                  onChange={(e) => setClient({ ...client, fullName: e.target.value })}
                  placeholder="Your first name"
                  className="mt-1.5 h-11 rounded-sm border-[hsl(var(--ink))]/15"
                />
                {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>}
              </div>
              <div>
                <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--ink))]/70">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={client.email}
                  onChange={(e) => setClient({ ...client, email: e.target.value })}
                  placeholder="you@example.com"
                  className="mt-1.5 h-11 rounded-sm border-[hsl(var(--ink))]/15"
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="representative" className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--ink))]/70">Your consultant</Label>
                <select
                  id="representative"
                  value={client.representative}
                  onChange={(e) => setClient({ ...client, representative: e.target.value })}
                  className="mt-1.5 flex h-11 w-full rounded-sm border border-[hsl(var(--ink))]/15 bg-white px-3 py-2 text-sm text-[hsl(var(--ink))] focus-visible:border-[hsl(var(--ink))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ink))]"
                >
                  <option value="" disabled>Select your consultant</option>
                  {REPRESENTATIVES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {errors.representative && <p className="mt-1 text-xs text-destructive">{errors.representative}</p>}
              </div>

              <label className="flex cursor-pointer items-start gap-3 pt-2">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5 border-[hsl(var(--ink))]/30 data-[state=checked]:border-[hsl(var(--ink))] data-[state=checked]:bg-[hsl(var(--ink))] data-[state=checked]:text-white"
                />
                <span className="text-[12px] leading-relaxed text-[hsl(var(--ink))]/75">
                  I confirm these documents are mine and consent to Pure Private Wealth collecting and storing them, and to <span className="font-semibold text-[hsl(var(--ink))]">being contacted by Pure Private Wealth</span>, in accordance with the <span className="font-semibold text-[hsl(var(--ink))]">Australian Privacy Act 1988</span>.
                </span>
              </label>

              {submitting && (
                <div className="rounded-sm border border-[hsl(var(--ink))]/15 bg-[hsl(var(--page-alt))] p-3">
                  <div className="mb-2 flex items-center gap-2 text-[13px] text-[hsl(var(--ink))]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Securely uploading…</span>
                    <span className="ml-auto text-xs text-[hsl(var(--ink))]/60">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStage("review")}
                  disabled={submitting}
                  className="rounded-sm border-[hsl(var(--ink))]/20 bg-white"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  size="lg"
                  className="h-12 flex-1 rounded-sm bg-[hsl(var(--ink))] font-semibold tracking-wide text-white hover:bg-[hsl(215_60%_18%)]"
                >
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Lock className="mr-2 h-4 w-4" /> Send securely</>
                  )}
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* ============ DONE ============ */}
        {stage === "done" && (
          <section className={`page-enter overflow-hidden ${v.radius} border ${v.border} ${v.surface} text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]`}>
            <div className={`border-b ${v.border} bg-[hsl(var(--ink))] px-7 py-10 text-[hsl(var(--page-alt))]`}>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-current/30 bg-current/10">
                <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} />
              </div>
              <h2 className={`${v.heading} text-2xl font-bold`}>
                Documents received{client.fullName ? `, ${client.fullName.split(" ")[0]}` : ""}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[13px] opacity-80">
                Your documents have been encrypted and delivered to Pure Private Wealth.
              </p>
            </div>
          </section>
        )}


        {/* Trust seal footer */}
        <footer className="mt-10 border-t border-[hsl(var(--ink))]/10 pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--ink))]/55">
            <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> TLS 1.3 Encrypted</span>
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> AES-256 At Rest</span>
            <span className="flex items-center gap-1.5"><FileCheck2 className="h-3 w-3" /> Privacy Act 1988</span>
          </div>
          <p className="text-center text-[11px] text-[hsl(var(--ink))]/45">
            © {new Date().getFullYear()} Pure Private Wealth · Powered by Advisor Link Online
          </p>
        </footer>
      </main>

      <input ref={fileInputRef} type="file" className="hidden" onChange={onHiddenFileChange} />

      {/* ============ FULLSCREEN CAMERA OVERLAY ============ */}
      {(stage === "license_camera" || stage === "statement_camera") && (
        <FullscreenCamera
          mode={stage === "license_camera" ? "license" : "statement"}
          licenseSide={licenseSide}
          ready={cameraReady}
          videoRef={videoRef}
          overlayRef={overlayRef}
          flash={flash}
          busy={busy}
          banner={captureBanner}
          capturedCount={
            stage === "license_camera"
              ? captured.filter((c) => c.docType === "license").length
              : statementCount
          }
          onCapture={stage === "license_camera" ? handleLicenseCapture : handleStatementCapture}
          onFinish={
            stage === "statement_camera"
              ? finishStatementCapture
              : () => {
                  stopCamera();
                  setLicenseSide("front");
                  setStage(captured.length > 0 ? "review" : "license_method");
                }
          }
          onCancel={() => {
            stopCamera();
            if (stage === "license_camera") {
              setLicenseSide("front");
              setStage("license_method");
            } else {
              setStatementCount(0);
              setStage("statement_method");
            }
          }}
        />
      )}
    </div>
  );
}

/* ===================== Helper components ===================== */

function MethodChoice({
  title, subtitle, onCamera, onUpload, onBack, uploadLabel,
}: {
  title: string;
  subtitle: string;
  onCamera: () => void;
  onUpload: () => void;
  onBack: () => void;
  uploadLabel?: string;
}) {
  return (
    <section className="page-enter rounded-md border border-[hsl(var(--ink))]/10 bg-white p-6">
      <h2 className="font-heading text-xl font-bold text-[hsl(var(--ink))]">{title}</h2>
      <p className="mt-1 text-[13px] text-[hsl(var(--ink))]/65">{subtitle}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          onClick={onCamera}
          className="group flex flex-col items-center gap-2 rounded-md bg-white p-6 text-center shadow-[0_4px_14px_rgba(15,23,42,0.08)] ring-1 ring-[hsl(var(--ink))]/5 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
        >
          <Camera className="h-7 w-7 text-[hsl(var(--ink))]" />
          <p className="text-[14px] font-semibold text-[hsl(var(--ink))]">Take photo</p>
          <p className="text-[11px] text-[hsl(var(--ink))]/55">Use your camera</p>
        </button>
        <button
          onClick={onUpload}
          className="group flex flex-col items-center gap-2 rounded-md bg-white p-6 text-center shadow-[0_4px_14px_rgba(15,23,42,0.08)] ring-1 ring-[hsl(var(--ink))]/5 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
        >
          <Upload className="h-7 w-7 text-[hsl(var(--ink))]" />
          <p className="text-[14px] font-semibold text-[hsl(var(--ink))]">{uploadLabel || "Upload photo"}</p>
          <p className="text-[11px] text-[hsl(var(--ink))]/55">From your device</p>
        </button>
      </div>
      <button
        onClick={onBack}
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[hsl(var(--ink))]/20 bg-white px-4 py-2.5 text-[13px] font-semibold text-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))]/5"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
    </section>
  );
}

function FullscreenCamera({
  mode, licenseSide, ready, videoRef, overlayRef, flash, busy, capturedCount, banner,
  onCapture, onFinish, onCancel,
}: {
  mode: "license" | "statement";
  licenseSide: "front" | "back";
  ready: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLDivElement>;
  flash: boolean;
  busy: boolean;
  capturedCount: number;
  banner: string | null;
  onCapture: () => void;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const isLicense = mode === "license";
  const instruction = isLicense
    ? (licenseSide === "front" ? "Front of licence" : "Back of licence")
    : "Statement";
  const helper = isLicense
    ? "Place your licence inside the frame. Make sure all details are clear."
    : "Place each page inside the frame. Tap the shutter to save.";
  const sideLabel = isLicense
    ? (licenseSide === "front" ? "Step 1 of 2" : "Step 2 of 2")
    : `Page ${capturedCount + 1}`;

  // ID card aspect ~ 1.586:1, statement ~ A4 portrait
  const overlayClass = isLicense
    ? "aspect-[1.586/1] w-[88%] max-w-[560px]"
    : "aspect-[1/1.414] w-[78%] max-w-[480px] max-h-[68vh]";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between bg-black/85 px-5 py-3 backdrop-blur">
        <button
          onClick={onCancel}
          className="rounded-sm p-2 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="Close camera"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{sideLabel}</p>
          <p className="font-heading text-[15px] font-semibold">{instruction}</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Camera view */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

        {/* Capture confirmation banner — slides from TOP so it never covers the shutter */}
        {banner && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4">
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/95 px-4 py-2 text-[13px] font-semibold text-white shadow-lg ring-1 ring-white/20 animate-in fade-in slide-in-from-top-2">
              <Check className="h-4 w-4" />
              {banner}
            </div>
          </div>
        )}


        {/* Helper text — above the frame for clear readability */}
        <div className="pointer-events-none absolute inset-x-0 top-10 z-20 flex justify-center px-6">
          <p className="max-w-[92%] rounded-lg bg-black/75 px-5 py-2.5 text-center text-[15px] font-semibold text-white shadow-lg backdrop-blur">
            {helper}
          </p>
        </div>

        {/* Overlay frame */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            ref={overlayRef}
            className={`relative ${overlayClass} rounded-xl border-2 border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.62)]`}
          >
            <span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-white" />
            <span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-white" />
            <span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-white" />
            <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-white" />
          </div>
        </div>

        {/* Flash effect */}
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/85 transition-opacity" />}

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Starting camera…
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative flex shrink-0 items-center justify-between bg-black/90 px-6 py-5 backdrop-blur">
        {/* Left: thumbnail count */}
        <div className="flex w-20 items-center">
          {capturedCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              {capturedCount}
            </div>
          ) : null}
        </div>

        {/* Shutter */}
        <button
          onClick={onCapture}
          disabled={!ready || busy}
          aria-label="Capture"
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10 transition active:scale-95 disabled:opacity-40"
        >
          <span className="block h-14 w-14 rounded-full bg-white" />
        </button>

        {/* Right: finish (statement) */}
        <div className="flex w-20 justify-end">
          {!isLicense && capturedCount > 0 && (
            <button
              onClick={onFinish}
              className="rounded-full bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-black hover:bg-white/90"
            >
              Finished
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
