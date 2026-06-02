import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { uploadClientDocumentSubmission } from "@/lib/client-document-upload";
import {
  Shield, Lock, Camera, Upload, CheckCircle2, FileText,
  Image as ImageIcon, ChevronRight, Loader2, X, ShieldCheck,
  EyeOff, Check, ArrowRight, Sparkles,
} from "lucide-react";
import { z } from "zod";
import logoSvg from "@/assets/logo.svg";
const BRAND_LOGO = "/logo-email.png";

const MAX_BYTES = 15 * 1024 * 1024;

type Method = "camera" | "screenshot" | "pdf";

type CapturedFile = {
  id: string;
  method: Method;
  file: File;
  preview: string;
};

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
});

type Stage = "welcome" | "intro" | "camera" | "review";

export default function StatementUpload() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [captured, setCaptured] = useState<CapturedFile[]>([]);
  const [client, setClient] = useState({ fullName: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const [flash, setFlash] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pickCtxRef = useRef<{ method: Method; accept: string } | null>(null);

  const showBanner = (m: string) => {
    setBanner(m);
    setTimeout(() => setBanner(null), 1400);
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
      setStage("intro");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (stage === "camera") startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [stage, startCamera, stopCamera]);

  const captureCropped = (): Promise<CapturedFile | null> => {
    return new Promise((resolve) => {
      const v = videoRef.current;
      const overlay = overlayRef.current;
      if (!v || !v.videoWidth || !overlay) return resolve(null);
      const vw = v.videoWidth, vh = v.videoHeight;
      const cr = v.getBoundingClientRect(), or = overlay.getBoundingClientRect();
      const scale = Math.max(cr.width / vw, cr.height / vh);
      const dW = vw * scale, dH = vh * scale;
      const oX = (dW - cr.width) / 2, oY = (dH - cr.height) / 2;
      let sx = (or.left - cr.left + oX) / scale;
      let sy = (or.top - cr.top + oY) / scale;
      let sw = or.width / scale, sh = or.height / scale;
      sx = Math.max(0, Math.min(sx, vw - 1));
      sy = Math.max(0, Math.min(sy, vh - 1));
      sw = Math.max(1, Math.min(sw, vw - sx));
      sh = Math.max(1, Math.min(sh, vh - sy));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          const file = new File([blob], `statement-${Date.now()}.jpg`, { type: "image/jpeg" });
          resolve({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            method: "camera",
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

  const handleCapture = async () => {
    if (busy || !cameraReady) return;
    setBusy(true);
    const item = await captureCropped();
    if (!item) {
      setBusy(false);
      return toast.error("Couldn't capture image, try again");
    }
    triggerFlash();
    setCaptured((prev) => [...prev, item]);
    showBanner(`Page ${captured.length + 1} saved`);
    setBusy(false);
  };

  const finishCamera = () => {
    stopCamera();
    setStage("review");
  };

  // ===== File pick =====
  const triggerPick = (method: Method, accept: string) => {
    pickCtxRef.current = { method, accept };
    const el = fileInputRef.current;
    if (!el) return;
    el.value = "";
    el.setAttribute("accept", accept);
    el.removeAttribute("capture");
    el.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ctx = pickCtxRef.current;
    const file = e.target.files?.[0];
    if (!file || !ctx) return;
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: `${file.name} exceeds 15MB` });
      return;
    }
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    setCaptured((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        method: ctx.method,
        file,
        preview,
      },
    ]);
    setStage("review");
  };

  const removeItem = (id: string) => {
    setCaptured((prev) => {
      const f = prev.find((c) => c.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((c) => c.id !== id);
    });
  };

  const handleSubmit = async () => {
    const result = detailsSchema.safeParse(client);
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
      setErrors(fe);
      return;
    }
    if (!consent) return toast.error("Please accept the privacy consent to continue");
    if (captured.length === 0) return toast.error("Please add at least one statement");

    setErrors({});
    setSubmitting(true);
    setProgress(5);
    try {
      const total = captured.length;
      let count = 0;
      for (const item of captured) {
        await uploadClientDocumentSubmission({
          clientName: client.fullName,
          clientEmail: client.email,
          documentType: "statement",
          notes: `Method: ${item.method}`,
          file: item.file,
        });
        count += 1;
        setProgress(Math.round((count / total) * 100));
      }
      setDone(true);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Upload failed", { description: e instanceof Error ? e.message : "Please try again" });
    } finally {
      setSubmitting(false);
    }
  };

  const METHOD_OPTIONS = [
    {
      type: "camera" as const,
      label: "Take photos",
      description: "Use your camera, capture as many pages as you like in one go",
      icon: Camera,
      onClick: () => setStage("camera"),
    },
    {
      type: "screenshot" as const,
      label: "Screenshot",
      description: "Upload a screenshot from your phone or computer",
      icon: ImageIcon,
      onClick: () => triggerPick("screenshot", "image/*"),
    },
    {
      type: "pdf" as const,
      label: "PDF",
      description: "Upload the PDF straight from your super or bank",
      icon: FileText,
      onClick: () => triggerPick("pdf", "application/pdf"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[hsl(215_60%_12%)]">
      {/* Header, AdvisorLink */}
      <header className="relative overflow-hidden bg-[hsl(215_60%_10%)] text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(192_90%_50%)]/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-[hsl(192_90%_60%)]/15 blur-3xl" />
        <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center">
            <img src={BRAND_LOGO} alt="AdvisorLink Online" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(192_90%_55%)] shadow-[0_0_12px_2px_hsl(192_90%_55%)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Secure Upload</span>
          </div>
        </div>
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(192_90%_55%)] to-transparent" />
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />

        {done ? (
          <section className="rounded-2xl border border-[hsl(215_60%_12%)]/10 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(215_60%_12%)]/8">
              <CheckCircle2 className="h-8 w-8 text-[hsl(215_60%_12%)]" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-[hsl(215_60%_12%)]">Thank you, {client.fullName.split(" ")[0]}</h1>
            <p className="mt-3 text-[14px] text-[hsl(215_60%_12%)]/65">
              Your statement has been uploaded successfully and delivered straight to us. We'll look forward to speaking to you soon.
            </p>
          </section>
        ) : stage === "welcome" ? (
          <section className="page-enter">
            <div className="mb-6 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(192_90%_50%)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(192_90%_30%)]">
                Welcome
              </span>
              <h1 className="font-heading mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
                Welcome to AdvisorLink Online secure document upload
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-[hsl(215_60%_12%)]/65">
                Please send through your most recent statement before our meeting so we can prepare properly and make sure everything runs smoothly on the day.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[hsl(215_60%_12%)]/10 bg-white shadow-[0_4px_24px_-12px_rgba(15,23,42,0.12)]">
              <div className="border-b border-[hsl(215_60%_12%)]/10 bg-gradient-to-r from-[hsl(215_60%_10%)] to-[hsl(215_60%_18%)] px-6 py-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(192_90%_65%)]">A few quick notes</p>
                <p className="mt-1 font-heading text-[15px] font-semibold">Your privacy is in your hands</p>
              </div>
              <ul className="space-y-4 px-6 py-6 text-[13.5px] leading-relaxed text-[hsl(215_60%_12%)]/80">
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(192_90%_50%)]/15 text-[hsl(192_90%_30%)]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span><span className="font-semibold text-[hsl(215_60%_12%)]">Member number not required</span>, feel free to leave it off or block it out, we don't need it to prepare.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(192_90%_50%)]/15 text-[hsl(192_90%_30%)]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span><span className="font-semibold text-[hsl(215_60%_12%)]">Cross out anything personal</span> you'd rather we don't see, addresses, account numbers, tax file numbers, your choice.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(192_90%_50%)]/15 text-[hsl(192_90%_30%)]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span><span className="font-semibold text-[hsl(215_60%_12%)]">All we need</span> is your current balance, the investments you're in, your fund, and any insurances.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(192_90%_50%)]/15 text-[hsl(192_90%_30%)]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span><span className="font-semibold text-[hsl(215_60%_12%)]">Encrypted end-to-end</span>. It comes straight to us, not through anyone else.</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-[hsl(215_60%_12%)]/10 bg-white p-3 text-center text-[10px] font-semibold uppercase tracking-wider text-[hsl(215_60%_12%)]/60">
              <div className="flex flex-col items-center gap-1"><ShieldCheck className="h-4 w-4 text-[hsl(192_90%_35%)]" /> Encrypted</div>
              <div className="flex flex-col items-center gap-1"><EyeOff className="h-4 w-4 text-[hsl(192_90%_35%)]" /> Private</div>
              <div className="flex flex-col items-center gap-1"><Shield className="h-4 w-4 text-[hsl(192_90%_35%)]" /> Direct to us</div>
            </div>

            <Button
              onClick={() => setStage("intro")}
              size="lg"
              className="mt-6 h-14 w-full rounded-xl bg-gradient-to-r from-[hsl(215_60%_12%)] to-[hsl(215_60%_22%)] text-[15px] font-bold tracking-wide text-white shadow-[0_12px_28px_-12px_hsl(215_60%_12%/0.55)] hover:from-[hsl(215_60%_10%)] hover:to-[hsl(215_60%_20%)]"
            >
              Begin <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="mt-3 text-center text-[11px] text-[hsl(215_60%_12%)]/45">
              Takes about a minute · TLS 1.3 · AES-256 at rest
            </p>
          </section>
        ) : (
          <>
            <div className="mb-6 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(192_90%_50%)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(192_90%_30%)]">
                <Lock className="h-3 w-3" /> Secured upload
              </span>
              <h1 className="font-heading mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
                Send through your most recent statement
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[14px] text-[hsl(215_60%_12%)]/65">
                Feel free to just take photos or screenshots, and block out any personal information you'd prefer to keep private. We'll handle the rest.
              </p>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl border border-[hsl(215_60%_12%)]/10 bg-white p-3 text-center text-[10px] font-semibold uppercase tracking-wider text-[hsl(215_60%_12%)]/60">
              <div className="flex flex-col items-center gap-1"><ShieldCheck className="h-4 w-4 text-[hsl(192_90%_35%)]" /> Encrypted</div>
              <div className="flex flex-col items-center gap-1"><EyeOff className="h-4 w-4 text-[hsl(192_90%_35%)]" /> Private</div>
              <div className="flex flex-col items-center gap-1"><Shield className="h-4 w-4 text-[hsl(192_90%_35%)]" /> Direct to us</div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(215_60%_12%)]/55">
                Choose how you'd like to send it
              </p>
              {METHOD_OPTIONS.map((opt, i) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={opt.onClick}
                    className="group flex w-full items-center gap-4 rounded-xl border border-[hsl(215_60%_12%)]/10 bg-white px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-[hsl(192_90%_50%)]/40 hover:shadow-[0_12px_32px_-12px_hsl(192_90%_50%/0.4)]"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(215_60%_12%)] to-[hsl(215_60%_22%)] text-[hsl(192_90%_55%)] shadow-[0_4px_16px_-4px_hsl(215_60%_12%/0.4)]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(192_90%_30%)]">Option {i + 1}</span>
                      </div>
                      <p className="mt-0.5 text-[15px] font-semibold">{opt.label}</p>
                      <p className="mt-0.5 text-[12px] text-[hsl(215_60%_12%)]/60">{opt.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[hsl(215_60%_12%)]/30 transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(192_90%_45%)]" />
                  </button>
                );
              })}
            </div>

            {captured.length > 0 && (
              <section className="mt-6 rounded-xl border border-[hsl(215_60%_12%)]/10 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-base font-bold">
                    {captured.length} page{captured.length === 1 ? "" : "s"} ready
                  </h2>
                  <button
                    onClick={() => setStage("camera")}
                    className="inline-flex items-center gap-1 rounded-full bg-[hsl(192_90%_50%)]/10 px-3 py-1 text-[11px] font-semibold text-[hsl(192_90%_30%)] hover:bg-[hsl(192_90%_50%)]/15"
                  >
                    <Camera className="h-3 w-3" /> Add more pages
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {captured.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border border-[hsl(215_60%_12%)]/10 bg-[#f4f7fb] p-2">
                      {c.preview ? (
                        <img src={c.preview} alt="" className="h-12 w-16 rounded object-cover ring-1 ring-[hsl(215_60%_12%)]/10" />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded bg-white">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{c.file.name}</p>
                        <p className="text-[11px] uppercase tracking-wider text-[hsl(215_60%_12%)]/55">{c.method}</p>
                      </div>
                      <button onClick={() => removeItem(c.id)} className="rounded p-1.5 text-[hsl(215_60%_12%)]/40 hover:bg-destructive/10 hover:text-destructive" aria-label="Remove">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="su-name" className="text-xs">Your full name</Label>
                    <Input id="su-name" value={client.fullName} onChange={(e) => setClient((p) => ({ ...p, fullName: e.target.value }))} className="mt-1" />
                    {errors.fullName && <p className="mt-1 text-[11px] text-destructive">{errors.fullName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="su-email" className="text-xs">Email</Label>
                    <Input id="su-email" type="email" value={client.email} onChange={(e) => setClient((p) => ({ ...p, email: e.target.value }))} className="mt-1" />
                    {errors.email && <p className="mt-1 text-[11px] text-destructive">{errors.email}</p>}
                  </div>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-2 text-[12px] text-[hsl(215_60%_12%)]/70">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                  <span>I consent to AdvisorLink Online receiving and storing this statement securely for the purpose of preparing for our meeting.</span>
                </label>

                {submitting && (
                  <div className="mt-4">
                    <Progress value={progress} />
                    <p className="mt-1 text-center text-[11px] text-[hsl(215_60%_12%)]/55">Uploading… {progress}%</p>
                  </div>
                )}

                <Button onClick={handleSubmit} disabled={submitting} size="lg" className="mt-5 h-12 w-full rounded-lg bg-[hsl(215_60%_12%)] font-semibold text-white hover:bg-[hsl(215_60%_18%)]">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="mr-2 h-4 w-4" /> Send statement securely</>}
                </Button>
              </section>
            )}
          </>
        )}

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.3em] text-[hsl(215_60%_12%)]/40">
          AdvisorLink Online · Secure document portal
        </p>
      </main>

      {/* ============ FULLSCREEN CAMERA ============ */}
      {stage === "camera" && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
          <div className="flex shrink-0 items-center justify-between bg-black/85 px-5 py-3 backdrop-blur">
            <button onClick={() => { stopCamera(); setStage(captured.length > 0 ? "review" : "intro"); }} className="rounded-sm p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close camera">
              <X className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">Page {captured.length + 1}</p>
              <p className="font-heading text-[15px] font-semibold">Statement</p>
            </div>
            <div className="w-9" />
          </div>

          <div className="relative flex-1 overflow-hidden bg-black">
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

            {banner && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4">
                <div className="flex items-center gap-2 rounded-full bg-emerald-500/95 px-4 py-2 text-[13px] font-semibold text-white shadow-lg ring-1 ring-white/20 animate-in fade-in slide-in-from-top-2">
                  <Check className="h-4 w-4" />
                  {banner}
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-10 z-20 flex justify-center px-6">
              <p className="max-w-[92%] rounded-lg bg-black/75 px-5 py-2.5 text-center text-[15px] font-semibold text-white shadow-lg backdrop-blur">
                Place each page inside the frame. Tap the shutter to save.
              </p>
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div ref={overlayRef} className="relative aspect-[1/1.414] w-[78%] max-w-[480px] max-h-[68vh] rounded-xl border-2 border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.62)]">
                <span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-white" />
                <span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-white" />
                <span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-white" />
              </div>
            </div>

            {flash && <div className="pointer-events-none absolute inset-0 bg-white/85" />}

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Starting camera…
              </div>
            )}
          </div>

          <div className="relative flex shrink-0 items-center justify-between bg-black/90 px-6 py-5 backdrop-blur">
            <div className="flex w-20 items-center">
              {captured.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  {captured.length}
                </div>
              )}
            </div>
            <button onClick={handleCapture} disabled={!cameraReady || busy} aria-label="Capture" className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10 transition active:scale-95 disabled:opacity-40">
              <span className="block h-14 w-14 rounded-full bg-white" />
            </button>
            <div className="flex w-20 justify-end">
              {captured.length > 0 && (
                <button onClick={finishCamera} className="rounded-full bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-black hover:bg-white/90">
                  Finished
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
