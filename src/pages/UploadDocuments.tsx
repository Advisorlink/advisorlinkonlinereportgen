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
  "Travis Miller",
  "Sarah Chen",
  "James O'Connor",
  "Olivia Bennett",
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

const VARIANTS: Record<1 | 2 | 3 | 4, VariantConfig> = {
  1: {
    label: "Private Bank",
    page: "bg-[#f7f5f0]",
    ink: "215_60%_12%",
    accent: "215_60%_12%",
    surface: "bg-white",
    border: "border-[hsl(215_60%_12%)]/10",
    radius: "rounded-md",
    btnRadius: "rounded-sm",
    heading: "font-heading",
    vibe: "Ivory · navy · editorial",
  },
  2: {
    label: "Soft Modern",
    page: "bg-[#f4f6fb]",
    ink: "222_47%_18%",
    accent: "221_83%_53%",
    surface: "bg-white",
    border: "border-[hsl(222_47%_18%)]/8",
    radius: "rounded-2xl",
    btnRadius: "rounded-xl",
    heading: "font-sans",
    vibe: "Rounded · airy · blue accent",
  },
  3: {
    label: "Mono Lux",
    page: "bg-black",
    ink: "0_0%_100%",
    accent: "45_85%_60%",
    surface: "bg-[#0e0e0e]",
    border: "border-white/10",
    radius: "rounded-none",
    btnRadius: "rounded-none",
    heading: "font-heading",
    vibe: "Black · gold · brutalist",
  },
  4: {
    label: "Warm Trust",
    page: "bg-[#faf6f1]",
    ink: "20_30%_18%",
    accent: "16_72%_46%",
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

type DocType = "license" | "statement" | "screenshot";

type CapturedFile = {
  id: string;
  docType: DocType;
  label: string;
  file: File;
  preview: string;
};

const MAX_BYTES = 10 * 1024 * 1024;

const DOC_OPTIONS: { type: DocType; label: string; description: string; icon: typeof IdCard }[] = [
  { type: "license", label: "Driver's Licence", description: "Front and back of your licence", icon: IdCard },
  { type: "statement", label: "Statement", description: "Super or bank statement (PDF or photo)", icon: FileText },
  { type: "screenshot", label: "Screenshot", description: "An image from your phone or computer", icon: ImageIcon },
];

type Stage =
  | "choose"
  | "license_method"
  | "license_camera"
  | "license_upload"
  | "statement_method"
  | "statement_camera"
  | "screenshot_pick"
  | "review"
  | "details"
  | "done";

export default function UploadDocuments() {
  const [stage, setStage] = useState<Stage>("choose");
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
  const [variant, setVariant] = useState<1 | 2 | 3 | 4>(1);
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
      el.setAttribute("accept", docType === "statement" ? "image/*,application/pdf" : "image/*");
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
      setStage((s) => (s === "license_camera" ? "license_method" : s === "statement_camera" ? "statement_method" : s));
    }
  }, [stopCamera]);

  useEffect(() => {
    if (stage === "license_camera" || stage === "statement_camera") {
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
      toast.success("Front captured");
      setBusy(false);
    } else {
      toast.success("Back captured");
      setLicenseSide("front");
      stopCamera();
      setStage("review");
      setBusy(false);
    }
  };

  const handleStatementCapture = async () => {
    if (busy || !cameraReady) return;
    setBusy(true);
    const label = `Statement ${statementCount + 1}`;
    const item = await captureCropped(label, "statement");
    if (!item) {
      setBusy(false);
      return toast.error("Couldn't capture image, try again");
    }
    triggerFlash();
    addCaptured(item);
    setStatementCount((n) => n + 1);
    toast.success(`Page ${statementCount + 1} saved`);
    setBusy(false);
  };

  const finishStatementCapture = () => {
    stopCamera();
    setStatementCount(0);
    setStage("review");
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
      setStage("choose");
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
    <div className="min-h-screen bg-[#f7f5f0] text-[hsl(215_32%_14%)]">
      {/* Top brand bar — AdvisorLink → Pure Private Wealth */}
      <header className="border-b border-[hsl(215_60%_12%)]/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <img src={LOGO_BLACK_URL} alt="Advisor Link Online" className="h-9 w-auto" />
          <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(215_60%_12%)]/40" />
          <img src={PURE_LOGO_URL} alt="Pure Private Wealth" className="h-11 w-auto sm:h-14" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        {/* Progress strip */}
        <div className="mb-6 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(215_60%_12%)]/55">
          <Lock className="h-3 w-3" /> Secure document upload for Pure Private Wealth
        </div>

        {/* ============ CHOOSE ============ */}
        {stage === "choose" && (
          <section className="page-enter">
            <div className="mb-8 text-center">
              <h1 className="font-heading text-[28px] font-bold leading-tight tracking-tight text-[hsl(215_60%_12%)] sm:text-[34px]">
                What document would you like to upload?
              </h1>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-[hsl(215_60%_12%)]/65">
                Choose the type of document you'd like to send to your adviser.
              </p>
            </div>
            <div className="grid gap-3">
              {DOC_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    onClick={() => {
                      if (opt.type === "license") setStage("license_method");
                      else if (opt.type === "statement") setStage("statement_method");
                      else setStage("screenshot_pick");
                    }}
                    className="group flex items-center gap-4 rounded-md border border-[hsl(215_60%_12%)]/12 bg-white px-5 py-5 text-left transition-all hover:border-[hsl(215_60%_12%)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-[hsl(215_60%_12%)]/15 bg-[hsl(215_60%_12%)]/[0.03] text-[hsl(215_60%_12%)] group-hover:bg-[hsl(215_60%_12%)] group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[hsl(215_60%_12%)]">{opt.label}</p>
                      <p className="mt-0.5 text-[12px] text-[hsl(215_60%_12%)]/60">{opt.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[hsl(215_60%_12%)]/30 transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(215_60%_12%)]" />
                  </button>
                );
              })}
            </div>
            {captured.length > 0 && (
              <button
                onClick={() => setStage("review")}
                className="mt-6 w-full rounded-sm border border-[hsl(215_60%_12%)]/15 bg-white py-3 text-[12px] font-semibold uppercase tracking-wider text-[hsl(215_60%_12%)] hover:bg-[hsl(215_60%_12%)] hover:text-white"
              >
                View {captured.length} uploaded · Continue →
              </button>
            )}
          </section>
        )}

        {/* ============ LICENSE — METHOD ============ */}
        {stage === "license_method" && (
          <MethodChoice
            title="Driver's Licence"
            subtitle="We'll capture the front and back. Choose how you'd like to add the photos."
            onCamera={() => { setLicenseSide("front"); setStage("license_camera"); }}
            onUpload={() => { setLicenseSide("front"); setStage("license_upload"); }}
            onBack={() => setStage("choose")}
          />
        )}

        {/* ============ LICENSE — UPLOAD ============ */}
        {stage === "license_upload" && (
          <section className="page-enter rounded-md border border-[hsl(215_60%_12%)]/10 bg-white p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(215_60%_12%)]/55">
              {licenseSide === "front" ? "Step 1 of 2" : "Step 2 of 2"}
            </p>
            <h2 className="mt-1 font-heading text-xl font-bold text-[hsl(215_60%_12%)]">
              Upload {licenseSide} of licence
            </h2>
            <p className="mt-1 text-[13px] text-[hsl(215_60%_12%)]/65">
              Choose a clear photo from your device. Make sure all details are readable.
            </p>
            <Button
              onClick={() => triggerFilePick("license", licenseSide === "front" ? "Licence — Front" : "Licence — Back", false)}
              size="lg"
              className="mt-5 h-12 w-full rounded-sm bg-[hsl(215_60%_12%)] font-semibold text-white hover:bg-[hsl(215_60%_18%)]"
            >
              <Upload className="mr-2 h-4 w-4" /> Choose photo
            </Button>
            <button
              onClick={() => { setLicenseSide("front"); setStage("license_method"); }}
              className="mt-3 w-full text-center text-[12px] text-[hsl(215_60%_12%)]/55 hover:text-[hsl(215_60%_12%)]"
            >
              ← Back
            </button>
          </section>
        )}

        {/* ============ STATEMENT — METHOD ============ */}
        {stage === "statement_method" && (
          <MethodChoice
            title="Statement"
            subtitle="Take a photo or upload a PDF / image of your statement."
            onCamera={() => { setStatementCount(0); setStage("statement_camera"); }}
            onUpload={() => triggerFilePick("statement", "Statement", false)}
            onBack={() => setStage("choose")}
            uploadLabel="Upload file (PDF or image)"
          />
        )}

        {/* ============ SCREENSHOT ============ */}
        {stage === "screenshot_pick" && (
          <section className="page-enter rounded-md border border-[hsl(215_60%_12%)]/10 bg-white p-6">
            <h2 className="font-heading text-xl font-bold text-[hsl(215_60%_12%)]">Upload a screenshot</h2>
            <p className="mt-1 text-[13px] text-[hsl(215_60%_12%)]/65">
              Choose an image from your device.
            </p>
            <Button
              onClick={() => triggerFilePick("screenshot", "Screenshot", false)}
              size="lg"
              className="mt-5 h-12 w-full rounded-sm bg-[hsl(215_60%_12%)] font-semibold text-white hover:bg-[hsl(215_60%_18%)]"
            >
              <ImageIcon className="mr-2 h-4 w-4" /> Choose screenshot
            </Button>
            <button
              onClick={() => setStage("choose")}
              className="mt-3 w-full text-center text-[12px] text-[hsl(215_60%_12%)]/55 hover:text-[hsl(215_60%_12%)]"
            >
              ← Back
            </button>
          </section>
        )}

        {/* ============ REVIEW ============ */}
        {stage === "review" && (
          <section className="page-enter space-y-4">
            <div className="rounded-md border border-[hsl(215_60%_12%)]/10 bg-white p-6">
              <h2 className="font-heading text-xl font-bold text-[hsl(215_60%_12%)]">Your documents</h2>
              <p className="mt-1 text-[13px] text-[hsl(215_60%_12%)]/65">
                {captured.length} item{captured.length === 1 ? "" : "s"} ready to send. Add more or continue.
              </p>
              <div className="mt-4 space-y-2">
                {captured.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-sm border border-[hsl(215_60%_12%)]/10 bg-[#f7f5f0] p-2">
                    {c.preview ? (
                      <img src={c.preview} alt="" className="h-12 w-16 rounded-sm object-cover ring-1 ring-[hsl(215_60%_12%)]/10" />
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded-sm bg-white">
                        <FileText className="h-5 w-5 text-[hsl(215_60%_12%)]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[hsl(215_60%_12%)]">{c.label}</p>
                      <p className="text-[11px] text-[hsl(215_60%_12%)]/55">
                        {(c.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    <button
                      onClick={() => removeCaptured(c.id)}
                      className="rounded-sm p-1 text-[hsl(215_60%_12%)]/40 hover:bg-[hsl(215_60%_12%)]/[0.06] hover:text-[hsl(215_60%_12%)]"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStage("choose")}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-[hsl(215_60%_12%)]/25 bg-white py-3 text-[13px] font-semibold text-[hsl(215_60%_12%)] hover:border-[hsl(215_60%_12%)] hover:bg-[hsl(215_60%_12%)]/[0.03]"
              >
                <Plus className="h-4 w-4" /> Add another document
              </button>
            </div>
            <Button
              onClick={() => setStage("details")}
              disabled={captured.length === 0}
              size="lg"
              className="h-12 w-full rounded-sm bg-[hsl(215_60%_12%)] font-semibold text-white hover:bg-[hsl(215_60%_18%)]"
            >
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </section>
        )}

        {/* ============ DETAILS ============ */}
        {stage === "details" && (
          <section className="page-enter overflow-hidden rounded-md border border-[hsl(215_60%_12%)]/10 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="border-b border-[hsl(215_60%_12%)]/10 bg-[hsl(215_60%_12%)] px-7 py-5 text-white">
              <h2 className="font-heading text-lg font-semibold">Almost done</h2>
              <p className="mt-0.5 text-[12px] text-white/65">
                Tell us who you are so we can send these to the right adviser.
              </p>
            </div>
            <div className="space-y-5 px-7 py-7">
              <div>
                <Label htmlFor="fullName" className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(215_60%_12%)]/70">First name</Label>
                <Input
                  id="fullName"
                  value={client.fullName}
                  onChange={(e) => setClient({ ...client, fullName: e.target.value })}
                  placeholder="Your first name"
                  className="mt-1.5 h-11 rounded-sm border-[hsl(215_60%_12%)]/15"
                />
                {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>}
              </div>
              <div>
                <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(215_60%_12%)]/70">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={client.email}
                  onChange={(e) => setClient({ ...client, email: e.target.value })}
                  placeholder="you@example.com"
                  className="mt-1.5 h-11 rounded-sm border-[hsl(215_60%_12%)]/15"
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="representative" className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(215_60%_12%)]/70">Your consultant</Label>
                <select
                  id="representative"
                  value={client.representative}
                  onChange={(e) => setClient({ ...client, representative: e.target.value })}
                  className="mt-1.5 flex h-11 w-full rounded-sm border border-[hsl(215_60%_12%)]/15 bg-white px-3 py-2 text-sm text-[hsl(215_60%_12%)] focus-visible:border-[hsl(215_60%_12%)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(215_60%_12%)]"
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
                  className="mt-0.5 border-[hsl(215_60%_12%)]/30 data-[state=checked]:border-[hsl(215_60%_12%)] data-[state=checked]:bg-[hsl(215_60%_12%)] data-[state=checked]:text-white"
                />
                <span className="text-[12px] leading-relaxed text-[hsl(215_60%_12%)]/75">
                  I confirm these documents are mine and consent to Pure Private Wealth collecting,
                  storing and using them in accordance with the <span className="font-semibold text-[hsl(215_60%_12%)]">Australian Privacy Act 1988</span>.
                </span>
              </label>

              {submitting && (
                <div className="rounded-sm border border-[hsl(215_60%_12%)]/15 bg-[#f7f5f0] p-3">
                  <div className="mb-2 flex items-center gap-2 text-[13px] text-[hsl(215_60%_12%)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Securely uploading…</span>
                    <span className="ml-auto text-xs text-[hsl(215_60%_12%)]/60">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStage("review")}
                  disabled={submitting}
                  className="rounded-sm border-[hsl(215_60%_12%)]/20 bg-white"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  size="lg"
                  className="h-12 flex-1 rounded-sm bg-[hsl(215_60%_12%)] font-semibold tracking-wide text-white hover:bg-[hsl(215_60%_18%)]"
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
          <section className="page-enter overflow-hidden rounded-md border border-[hsl(215_60%_12%)]/10 bg-white text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="border-b border-[hsl(215_60%_12%)]/10 bg-[hsl(215_60%_12%)] px-7 py-8 text-white">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/10">
                <CheckCircle2 className="h-7 w-7 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="font-heading text-2xl font-bold">Documents received</h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] text-white/70">
                Thank you{client.fullName ? `, ${client.fullName.split(" ")[0]}` : ""}. Your documents have been encrypted
                and delivered to {client.representative || "your adviser"} at Pure Private Wealth.
              </p>
            </div>
            <div className="px-7 py-6 text-left">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[hsl(215_60%_12%)]/70">What happens next</p>
              <ul className="space-y-2 text-[13px] text-[hsl(215_60%_12%)]/75">
                <li className="flex gap-2"><span className="text-[hsl(215_60%_12%)]">›</span> Your adviser is notified immediately</li>
                <li className="flex gap-2"><span className="text-[hsl(215_60%_12%)]">›</span> Documents are reviewed within 1 business day</li>
                <li className="flex gap-2"><span className="text-[hsl(215_60%_12%)]">›</span> You'll receive a confirmation email at {client.email}</li>
              </ul>
            </div>
          </section>
        )}

        {/* Trust seal footer */}
        <footer className="mt-10 border-t border-[hsl(215_60%_12%)]/10 pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(215_60%_12%)]/55">
            <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> TLS 1.3 Encrypted</span>
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> AES-256 At Rest</span>
            <span className="flex items-center gap-1.5"><FileCheck2 className="h-3 w-3" /> Privacy Act 1988</span>
          </div>
          <p className="text-center text-[11px] text-[hsl(215_60%_12%)]/45">
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
    <section className="page-enter rounded-md border border-[hsl(215_60%_12%)]/10 bg-white p-6">
      <h2 className="font-heading text-xl font-bold text-[hsl(215_60%_12%)]">{title}</h2>
      <p className="mt-1 text-[13px] text-[hsl(215_60%_12%)]/65">{subtitle}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          onClick={onCamera}
          className="group flex flex-col items-center gap-2 rounded-md border border-[hsl(215_60%_12%)]/15 bg-white p-6 text-center hover:border-[hsl(215_60%_12%)] hover:bg-[hsl(215_60%_12%)] hover:text-white"
        >
          <Camera className="h-7 w-7 text-[hsl(215_60%_12%)] group-hover:text-white" />
          <p className="text-[14px] font-semibold text-[hsl(215_60%_12%)] group-hover:text-white">Take photo</p>
          <p className="text-[11px] text-[hsl(215_60%_12%)]/55 group-hover:text-white/75">Use your camera</p>
        </button>
        <button
          onClick={onUpload}
          className="group flex flex-col items-center gap-2 rounded-md border border-[hsl(215_60%_12%)]/15 bg-white p-6 text-center hover:border-[hsl(215_60%_12%)] hover:bg-[hsl(215_60%_12%)] hover:text-white"
        >
          <Upload className="h-7 w-7 text-[hsl(215_60%_12%)] group-hover:text-white" />
          <p className="text-[14px] font-semibold text-[hsl(215_60%_12%)] group-hover:text-white">{uploadLabel || "Upload photo"}</p>
          <p className="text-[11px] text-[hsl(215_60%_12%)]/55 group-hover:text-white/75">From your device</p>
        </button>
      </div>
      <button
        onClick={onBack}
        className="mt-5 w-full text-center text-[12px] text-[hsl(215_60%_12%)]/55 hover:text-[hsl(215_60%_12%)]"
      >
        ← Back
      </button>
    </section>
  );
}

function FullscreenCamera({
  mode, licenseSide, ready, videoRef, overlayRef, flash, busy, capturedCount,
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

        {/* Helper text */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-6">
          <p className="rounded-full bg-black/55 px-4 py-1.5 text-center text-[12px] text-white/85 backdrop-blur">
            {helper}
          </p>
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
