import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Shield, Lock, Camera, Upload, CheckCircle2, IdCard,
  Loader2, X, ShieldCheck, EyeOff, Check, ArrowLeft,
} from "lucide-react";
import { z } from "zod";

const LOGO_BLACK_URL =
  "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png";
const PURE_LOGO_URL = "/pure-private-wealth-logo.png";

const MAX_BYTES = 10 * 1024 * 1024;

type Side = "front" | "back";

type CapturedFile = {
  id: string;
  side: Side;
  file: File;
  preview: string;
};

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
});

const REPRESENTATIVES = ["Travis Seckold", "Stas Stanislav"];

type Stage = "intro" | "method" | "camera" | "review" | "done";

export default function LicenseUpload() {
  const [stage, setStage] = useState<Stage>("intro");
  const [captured, setCaptured] = useState<CapturedFile[]>([]);
  const [client, setClient] = useState({ fullName: "", email: "", representative: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const [licenseSide, setLicenseSide] = useState<Side>("front");
  const [flash, setFlash] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sideCtxRef = useRef<Side>("front");

  // ===== Live camera =====
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const showBanner = (m: string) => {
    setBanner(m);
    setTimeout(() => setBanner(null), 1400);
  };

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
      setStage("method");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (stage === "camera") startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [stage, startCamera, stopCamera]);

  const captureCropped = (side: Side): Promise<CapturedFile | null> => {
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
          const file = new File([blob], `license-${side}-${Date.now()}.jpg`, { type: "image/jpeg" });
          resolve({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            side,
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
    const item = await captureCropped(licenseSide);
    if (!item) {
      setBusy(false);
      return toast.error("Couldn't capture image, try again");
    }
    triggerFlash();
    setCaptured((prev) => [...prev.filter((c) => c.side !== licenseSide), item]);
    if (licenseSide === "front") {
      setLicenseSide("back");
      showBanner("Front saved — now capture the back");
      setBusy(false);
    } else {
      showBanner("Back saved");
      setLicenseSide("front");
      stopCamera();
      setStage("review");
      setBusy(false);
    }
  };

  // ===== Upload fallback =====
  const triggerPick = (side: Side) => {
    sideCtxRef.current = side;
    const el = fileInputRef.current;
    if (!el) return;
    el.value = "";
    el.setAttribute("accept", "image/*");
    el.removeAttribute("capture");
    el.click();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const side = sideCtxRef.current;
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: `${file.name} exceeds 10MB` });
      return;
    }
    const preview = URL.createObjectURL(file);
    setCaptured((prev) => [
      ...prev.filter((c) => c.side !== side),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, side, file, preview },
    ]);
    toast.success(`${side === "front" ? "Front" : "Back"} added`);
    setStage("review");
  };

  const remove = (id: string) => {
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
    if (captured.length === 0) return toast.error("Please add at least the front of your Photo ID");

    setErrors({});
    setSubmitting(true);
    setProgress(5);
    try {
      const slug = client.email.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const folder = `${slug}/${Date.now()}`;
      const total = captured.length;
      let count = 0;
      for (const item of captured) {
        const ext = item.file.name.split(".").pop() || "jpg";
        const path = `${folder}/license_${item.side}_${item.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("client-documents")
          .upload(path, item.file, { contentType: item.file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("client_documents").insert({
          client_name: client.fullName,
          client_email: client.email,
          client_phone: client.representative ? `Adviser: ${client.representative}` : null,
          document_type: "license",
          file_path: path,
          file_name: item.file.name,
          file_size: item.file.size,
          mime_type: item.file.type,
          consent_given: true,
          notes: `Photo ID — ${item.side === "front" ? "Front" : "Back"}`,
        });
        if (dbErr) throw dbErr;
        count += 1;
        setProgress(Math.round((count / total) * 100));
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
    <div className="min-h-screen bg-[#f4f6fb] text-[hsl(222_47%_18%)]">
      {/* Header — Pure Private Wealth */}
      <header className="bg-[#f4f6fb] pt-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl bg-white px-5 py-3 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] sm:mx-5 md:mx-auto">
          <img src={LOGO_BLACK_URL} alt="Advisor Link Online" className="h-8 w-auto" />
          <div className="flex items-center gap-2 rounded-full bg-[hsl(221_83%_53%)]/10 px-3 py-1 text-[hsl(221_83%_45%)]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Sharing with</span>
          </div>
          <img src={PURE_LOGO_URL} alt="Pure Private Wealth" className="h-12 w-auto sm:h-14" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <input ref={fileInputRef} type="file" className="hidden" onChange={onFile} />

        <div className="mb-6 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(222_47%_18%)]/55">
          <Lock className="h-3 w-3" /> Secure Photo ID upload for Pure Private Wealth
        </div>

        {stage === "done" ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Thanks, {client.fullName.split(" ")[0]}!</h1>
            <p className="mt-2 text-[14px] text-[hsl(222_47%_18%)]/65">
              Your Photo ID has been sent securely to Pure Private Wealth. You'll hear from your adviser shortly.
            </p>
          </section>
        ) : (
          <>
            {(stage === "intro" || stage === "method") && (
              <>
                <div className="mb-6 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(221_83%_53%)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(221_83%_45%)]">
                    <IdCard className="h-3 w-3" /> Photo ID
                  </span>
                  <h1 className="font-heading mt-3 text-[26px] font-bold leading-tight tracking-tight sm:text-[34px]">
                    Capture your Photo ID
                  </h1>
                  <p className="mx-auto mt-3 max-w-md text-[13px] text-[hsl(222_47%_18%)]/60 sm:text-[14px]">
                    We'll capture the front and back in one quick sequence. Make sure all details are clear.
                  </p>
                </div>

                {/* Privacy strip */}
                <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 text-center text-[10px] font-semibold uppercase tracking-wider text-[hsl(222_47%_18%)]/60 ring-1 ring-[hsl(222_47%_18%)]/5">
                  <div className="flex flex-col items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-[hsl(221_83%_45%)]" /> Encrypted
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <EyeOff className="h-4 w-4 text-[hsl(221_83%_45%)]" /> Private
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Shield className="h-4 w-4 text-[hsl(221_83%_45%)]" /> Adviser-only
                  </div>
                </div>

                <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] ring-1 ring-[hsl(222_47%_18%)]/5">
                  <h2 className="font-heading text-base font-bold">How would you like to add your licence?</h2>
                  <p className="mt-1 text-[13px] text-[hsl(222_47%_18%)]/60">
                    Take a photo using your camera — the frame helps you line up the front and back — or upload existing photos.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => { setLicenseSide("front"); setStage("camera"); }}
                      className="group flex flex-col items-center gap-2 rounded-xl bg-[hsl(221_83%_53%)] p-5 text-center text-white shadow-[0_8px_24px_-8px_hsl(221_83%_53%/0.55)] transition-transform hover:-translate-y-0.5"
                    >
                      <Camera className="h-7 w-7" />
                      <p className="text-[14px] font-semibold">Take photos</p>
                      <p className="text-[11px] text-white/80">Front then back, guided</p>
                    </button>
                    <button
                      onClick={() => { setLicenseSide("front"); triggerPick("front"); }}
                      className="group flex flex-col items-center gap-2 rounded-xl bg-white p-5 text-center text-[hsl(222_47%_18%)] ring-1 ring-[hsl(222_47%_18%)]/15 transition-colors hover:bg-[hsl(221_83%_53%)]/5 hover:ring-[hsl(221_83%_53%)]/40"
                    >
                      <Upload className="h-7 w-7" />
                      <p className="text-[14px] font-semibold">Upload photos</p>
                      <p className="text-[11px] text-[hsl(222_47%_18%)]/55">From your device</p>
                    </button>
                  </div>
                </section>
              </>
            )}

            {stage === "review" && (
              <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] ring-1 ring-[hsl(222_47%_18%)]/5">
                <h2 className="font-heading text-base font-bold">Your licence photos</h2>
                <p className="mt-1 text-[13px] text-[hsl(222_47%_18%)]/60">
                  {captured.length} of 2 captured. Add the other side, retake any, or continue.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {(["front", "back"] as Side[]).map((side) => {
                    const item = captured.find((c) => c.side === side);
                    return (
                      <div key={side} className="rounded-xl bg-[#f4f6fb] p-3 ring-1 ring-[hsl(222_47%_18%)]/5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(222_47%_18%)]/55">
                          {side === "front" ? "Front" : "Back"}
                        </p>
                        {item ? (
                          <>
                            <img src={item.preview} alt="" className="mt-2 aspect-[1.586/1] w-full rounded-lg object-cover ring-1 ring-[hsl(222_47%_18%)]/10" />
                            <div className="mt-2 flex items-center justify-between gap-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Captured
                              </span>
                              <button
                                onClick={() => remove(item.id)}
                                className="rounded p-1 text-[hsl(222_47%_18%)]/50 hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Remove"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => { setLicenseSide(side); setStage("camera"); }}
                            className="mt-2 flex aspect-[1.586/1] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[hsl(221_83%_53%)]/40 bg-white text-[hsl(221_83%_45%)] transition-colors hover:bg-[hsl(221_83%_53%)]/5"
                          >
                            <Camera className="h-5 w-5" />
                            <span className="text-[11px] font-semibold">Capture {side}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="lu-name" className="text-xs">Full name</Label>
                    <Input
                      id="lu-name"
                      value={client.fullName}
                      onChange={(e) => setClient((p) => ({ ...p, fullName: e.target.value }))}
                      className="mt-1"
                    />
                    {errors.fullName && <p className="mt-1 text-[11px] text-destructive">{errors.fullName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="lu-email" className="text-xs">Email</Label>
                    <Input
                      id="lu-email"
                      type="email"
                      value={client.email}
                      onChange={(e) => setClient((p) => ({ ...p, email: e.target.value }))}
                      className="mt-1"
                    />
                    {errors.email && <p className="mt-1 text-[11px] text-destructive">{errors.email}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Your consultant (optional)</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {REPRESENTATIVES.map((r) => {
                        const active = client.representative === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setClient((p) => ({ ...p, representative: active ? "" : r }))}
                            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                              active
                                ? "border-[hsl(221_83%_53%)] bg-[hsl(221_83%_53%)] text-white"
                                : "border-[hsl(222_47%_18%)]/15 bg-white text-[hsl(222_47%_18%)] hover:border-[hsl(221_83%_53%)]/40"
                            }`}
                          >
                            {r}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-2 text-[12px] text-[hsl(222_47%_18%)]/70">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                  <span>
                    I consent to Pure Private Wealth receiving and storing my licence securely for the purpose of providing advice.
                  </span>
                </label>

                {submitting && (
                  <div className="mt-4">
                    <Progress value={progress} />
                    <p className="mt-1 text-center text-[11px] text-[hsl(222_47%_18%)]/55">Uploading… {progress}%</p>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  size="lg"
                  className="mt-5 h-12 w-full rounded-xl bg-[hsl(221_83%_53%)] font-semibold text-white hover:bg-[hsl(221_83%_45%)]"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="mr-2 h-4 w-4" /> Send licence securely</>}
                </Button>
              </section>
            )}
          </>
        )}

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.3em] text-[hsl(222_47%_18%)]/40">
          Pure Private Wealth · via Advisor Link Online
        </p>
      </main>

      {/* ============ FULLSCREEN CAMERA ============ */}
      {stage === "camera" && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
          <div className="flex shrink-0 items-center justify-between bg-black/85 px-5 py-3 backdrop-blur">
            <button
              onClick={() => {
                stopCamera();
                setLicenseSide("front");
                setStage(captured.length > 0 ? "review" : "method");
              }}
              className="rounded-sm p-2 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Close camera"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
                {licenseSide === "front" ? "Step 1 of 2" : "Step 2 of 2"}
              </p>
              <p className="font-heading text-[15px] font-semibold">
                {licenseSide === "front" ? "Front of licence" : "Back of licence"}
              </p>
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
                Place your licence inside the frame. Make sure all details are clear.
              </p>
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                ref={overlayRef}
                className="relative aspect-[1.586/1] w-[88%] max-w-[560px] rounded-xl border-2 border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.62)]"
              >
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
                  {captured.length}/2
                </div>
              )}
            </div>
            <button
              onClick={handleCapture}
              disabled={!cameraReady || busy}
              aria-label="Capture"
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10 transition active:scale-95 disabled:opacity-40"
            >
              <span className="block h-14 w-14 rounded-full bg-white" />
            </button>
            <div className="w-20" />
          </div>
        </div>
      )}
    </div>
  );
}
