import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Shield, Lock, FileCheck2, Camera, Upload, CheckCircle2,
  IdCard, FileText, AlertCircle, Loader2, X, Eye, ChevronRight,
  ShieldCheck, Sparkles, BadgeCheck,
} from "lucide-react";
import { z } from "zod";

const clientSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().min(6, "Please enter a valid phone number").max(30),
});

type DocSlot = {
  key: string;
  label: string;
  description: string;
  icon: typeof IdCard;
  required: boolean;
  kind: "photo" | "document";
};

const DOC_SLOTS: DocSlot[] = [
  { key: "id_front", label: "Photo ID — Front", description: "Driver's licence or passport (front)", icon: IdCard, required: true, kind: "photo" },
  { key: "id_back", label: "Photo ID — Back", description: "Back of your driver's licence (skip for passport)", icon: IdCard, required: false, kind: "photo" },
  { key: "super_statement", label: "Super Statement", description: "Most recent super fund statement", icon: FileText, required: true, kind: "document" },
  { key: "additional", label: "Additional Document", description: "Any other supporting document (optional)", icon: FileText, required: false, kind: "document" },
];

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

type UploadedFile = { file: File; preview?: string };
type PendingPick = { slotKey: string; source: "camera" | "file" } | null;

export default function UploadDocuments() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [client, setClient] = useState({ fullName: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, UploadedFile[]>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingPick, setPendingPick] = useState<PendingPick>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleClientNext = () => {
    const result = clientSchema.safeParse(client);
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
      setErrors(fe);
      return;
    }
    setErrors({});
    setStep(2);
  };

  const triggerInput = (slotKey: string, source: "camera" | "file", multiple: boolean) => {
    const el = inputRefs.current[`${slotKey}_${source}`];
    if (!el) return;
    el.multiple = multiple;
    el.value = "";
    el.click();
  };

  const askMultiple = (slotKey: string, source: "camera" | "file") => {
    setPendingPick({ slotKey, source });
  };

  const resolvePick = (multiple: boolean) => {
    if (!pendingPick) return;
    const { slotKey, source } = pendingPick;
    setPendingPick(null);
    // Defer one tick to allow dialog to close before opening file picker
    setTimeout(() => triggerInput(slotKey, source, multiple), 50);
  };

  const handlePickFiles = (slotKey: string, list: FileList) => {
    const incoming: UploadedFile[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_BYTES) {
        toast.error("File too large", { description: `${file.name} exceeds 10MB and was skipped` });
        continue;
      }
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      incoming.push({ file, preview });
    }
    if (!incoming.length) return;
    setFiles((prev) => ({ ...prev, [slotKey]: [...(prev[slotKey] || []), ...incoming] }));
  };

  const handleRemove = (slotKey: string, idx: number) => {
    setFiles((prev) => {
      const arr = prev[slotKey] || [];
      const removed = arr[idx];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      const next = arr.filter((_, i) => i !== idx);
      return { ...prev, [slotKey]: next };
    });
  };

  const requiredMissing = DOC_SLOTS.filter((s) => s.required && !(files[s.key]?.length));

  const handleSubmit = async () => {
    if (requiredMissing.length > 0) {
      toast.error("Missing required documents", {
        description: `Please upload: ${requiredMissing.map((s) => s.label).join(", ")}`,
      });
      return;
    }
    if (!consent) {
      toast.error("Please accept the privacy consent to continue");
      return;
    }

    setSubmitting(true);
    setProgress(5);

    try {
      const slug = client.email.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const folder = `${slug}/${Date.now()}`;
      const allUploads: { slot: DocSlot; uf: UploadedFile; idx: number }[] = [];
      DOC_SLOTS.forEach((slot) => {
        (files[slot.key] || []).forEach((uf, idx) => allUploads.push({ slot, uf, idx }));
      });
      const total = allUploads.length;
      let done = 0;

      for (const { slot, uf, idx } of allUploads) {
        const ext = uf.file.name.split(".").pop() || "bin";
        const path = `${folder}/${slot.key}_${idx + 1}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("client-documents")
          .upload(path, uf.file, { contentType: uf.file.type, upsert: false });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from("client_documents").insert({
          client_name: client.fullName,
          client_email: client.email,
          client_phone: client.phone,
          document_type: slot.key,
          file_path: path,
          file_name: uf.file.name,
          file_size: uf.file.size,
          mime_type: uf.file.type,
          consent_given: true,
        });
        if (dbErr) throw dbErr;

        done += 1;
        setProgress(Math.round((done / total) * 100));
      }

      setStep(3);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Upload failed", {
        description: e instanceof Error ? e.message : "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingSlot = pendingPick ? DOC_SLOTS.find((s) => s.key === pendingPick.slotKey) : null;
  const pendingNoun = pendingSlot?.kind === "photo" ? "photos" : "documents";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[hsl(var(--navy))] text-[hsl(var(--navy-foreground))]">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 50% at 50% -10%, hsl(var(--cyan) / 0.18), transparent 60%),
            radial-gradient(ellipse 50% 40% at 100% 100%, hsl(215 80% 40% / 0.25), transparent 60%),
            radial-gradient(ellipse 40% 30% at 0% 30%, hsl(var(--cyan) / 0.08), transparent 60%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* Top trust bar */}
      <header className="relative border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--cyan))] to-[hsl(var(--cyan-glow))] shadow-[0_0_20px_-4px_hsl(var(--cyan)/0.6)]">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--navy))]" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <p className="font-heading text-sm font-bold tracking-tight">AdvisorLink</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Secure Client Portal</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/80 sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--accent-online))] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent-online))]" />
            </span>
            Encrypted Session
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Hero */}
        <div className="mb-8 sm:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--cyan))]/30 bg-[hsl(var(--cyan))]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--cyan-glow))]">
            <Lock className="h-3 w-3" />
            Bank-Grade Encryption
          </div>
          <h1 className="font-heading text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
            Submit your documents <span className="bg-gradient-to-r from-[hsl(var(--cyan))] to-[hsl(var(--cyan-glow))] bg-clip-text text-transparent">securely</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            Your adviser has invited you to upload your identification and supporting financial
            documents through this private, encrypted channel. Takes less than 2 minutes.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-7 flex items-center gap-2">
          {[
            { n: 1, label: "Your details" },
            { n: 2, label: "Upload" },
            { n: 3, label: "Done" },
          ].map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    step >= s.n
                      ? "bg-gradient-to-br from-[hsl(var(--cyan))] to-[hsl(var(--cyan-glow))] text-[hsl(var(--navy))] shadow-[0_0_20px_-4px_hsl(var(--cyan)/0.6)]"
                      : "border border-white/15 bg-white/5 text-white/50"
                  }`}
                >
                  {step > s.n ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} /> : s.n}
                </div>
                <span className={`hidden text-[10px] font-medium sm:block ${step >= s.n ? "text-white" : "text-white/40"}`}>{s.label}</span>
              </div>
              {i < 2 && <div className={`h-px flex-1 ${step > s.n ? "bg-[hsl(var(--cyan))]" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="page-enter rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--cyan))]/10 text-[hsl(var(--cyan-glow))]">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-semibold">Verify your identity</h2>
                <p className="mt-0.5 text-sm text-white/60">
                  Confirm your details so we can match the documents to your file.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName" className="text-white/80">Full legal name</Label>
                <Input
                  id="fullName"
                  value={client.fullName}
                  onChange={(e) => setClient({ ...client, fullName: e.target.value })}
                  placeholder="As shown on your ID"
                  className="mt-1.5 h-11 border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-[hsl(var(--cyan))]"
                />
                {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>}
              </div>
              <div>
                <Label htmlFor="email" className="text-white/80">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={client.email}
                  onChange={(e) => setClient({ ...client, email: e.target.value })}
                  placeholder="you@example.com"
                  className="mt-1.5 h-11 border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-[hsl(var(--cyan))]"
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="phone" className="text-white/80">Mobile number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={client.phone}
                  onChange={(e) => setClient({ ...client, phone: e.target.value })}
                  placeholder="04XX XXX XXX"
                  className="mt-1.5 h-11 border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-[hsl(var(--cyan))]"
                />
                {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
              </div>
            </div>

            <Button
              onClick={handleClientNext}
              size="lg"
              className="mt-7 h-12 w-full bg-gradient-to-r from-[hsl(var(--cyan))] to-[hsl(var(--cyan-glow))] font-semibold text-[hsl(var(--navy))] shadow-[0_0_28px_-6px_hsl(var(--cyan)/0.7)] hover:from-[hsl(var(--cyan-glow))] hover:to-[hsl(var(--cyan))] hover:opacity-100"
            >
              Continue to upload <ChevronRight className="ml-1 h-4 w-4" />
            </Button>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-white/50">
              <Lock className="h-3 w-3" />
              Your information is encrypted end-to-end
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="page-enter space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--cyan))]/10 text-[hsl(var(--cyan-glow))]">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-semibold">Upload your documents</h2>
                  <p className="mt-0.5 text-sm text-white/60">
                    Take a photo or choose a file. JPG, PNG, PDF — up to 10MB each.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {DOC_SLOTS.map((slot) => {
                  const uploaded = files[slot.key] || [];
                  const Icon = slot.icon;
                  const hasFiles = uploaded.length > 0;
                  return (
                    <div
                      key={slot.key}
                      className={`group rounded-xl border p-4 transition-all ${
                        hasFiles
                          ? "border-[hsl(var(--cyan))]/40 bg-[hsl(var(--cyan))]/[0.04]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                            hasFiles
                              ? "bg-gradient-to-br from-[hsl(var(--cyan))] to-[hsl(var(--cyan-glow))] text-[hsl(var(--navy))]"
                              : "bg-white/5 text-white/70"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{slot.label}</p>
                            {slot.required ? (
                              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive">
                                Required
                              </span>
                            ) : (
                              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/50">
                                Optional
                              </span>
                            )}
                            {hasFiles && (
                              <span className="rounded-full bg-[hsl(var(--accent-online))]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--accent-online))]">
                                {uploaded.length} file{uploaded.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-white/55">{slot.description}</p>
                        </div>
                      </div>

                      {hasFiles && (
                        <div className="mt-3 space-y-2">
                          {uploaded.map((u, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 rounded-lg border border-[hsl(var(--cyan))]/20 bg-[hsl(var(--cyan))]/[0.05] p-2"
                            >
                              {u.preview ? (
                                <img src={u.preview} alt="" className="h-11 w-11 rounded-md object-cover ring-1 ring-white/10" />
                              ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/5">
                                  <FileCheck2 className="h-5 w-5 text-[hsl(var(--cyan-glow))]" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-white">{u.file.name}</p>
                                <p className="text-[10px] text-white/50">
                                  {(u.file.size / 1024 / 1024).toFixed(2)} MB · Ready
                                </p>
                              </div>
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--cyan-glow))]" />
                              <button
                                onClick={() => handleRemove(slot.key, idx)}
                                className="shrink-0 rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"
                                aria-label="Remove file"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input
                          ref={(el) => (inputRefs.current[`${slot.key}_camera`] = el)}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => e.target.files && handlePickFiles(slot.key, e.target.files)}
                        />
                        <input
                          ref={(el) => (inputRefs.current[`${slot.key}_file`] = el)}
                          type="file"
                          accept={ACCEPTED}
                          className="hidden"
                          onChange={(e) => e.target.files && handlePickFiles(slot.key, e.target.files)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => askMultiple(slot.key, "camera")}
                        >
                          <Camera className="mr-1.5 h-4 w-4" />
                          {hasFiles ? "Add photo" : "Take photo"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => askMultiple(slot.key, "file")}
                        >
                          <Upload className="mr-1.5 h-4 w-4" />
                          {hasFiles ? "Add file" : "Choose file"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trust + consent */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
              <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { icon: Lock, label: "TLS 1.3", sub: "In transit" },
                  { icon: Shield, label: "AES-256", sub: "At rest" },
                  { icon: Eye, label: "Private", sub: "Adviser only" },
                ].map((t) => (
                  <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                    <t.icon className="mx-auto mb-1.5 h-4 w-4 text-[hsl(var(--cyan-glow))]" />
                    <p className="text-[11px] font-bold text-white">{t.label}</p>
                    <p className="text-[9px] uppercase tracking-wider text-white/40">{t.sub}</p>
                  </div>
                ))}
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5 border-white/30 data-[state=checked]:bg-[hsl(var(--cyan))] data-[state=checked]:text-[hsl(var(--navy))]"
                />
                <span className="text-[11px] leading-relaxed text-white/70">
                  I confirm these documents are mine and consent to AdvisorLink collecting,
                  storing and using them to provide financial advice services. My data is
                  handled in accordance with the <span className="font-medium text-white/90">Australian Privacy Act 1988</span>.
                </span>
              </label>
            </div>

            {submitting && (
              <div className="rounded-2xl border border-[hsl(var(--cyan))]/30 bg-[hsl(var(--cyan))]/[0.05] p-4 backdrop-blur-xl">
                <div className="mb-2 flex items-center gap-2 text-sm text-white">
                  <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--cyan-glow))]" />
                  <span>Securely uploading your documents…</span>
                  <span className="ml-auto text-xs text-white/60">{progress}%</span>
                </div>
                <Progress value={progress} className="bg-white/10" />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="h-12 flex-1 bg-gradient-to-r from-[hsl(var(--cyan))] to-[hsl(var(--cyan-glow))] font-semibold text-[hsl(var(--navy))] shadow-[0_0_28px_-6px_hsl(var(--cyan)/0.7)] hover:opacity-90"
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                ) : (
                  <><Lock className="mr-2 h-4 w-4" /> Submit securely</>
                )}
              </Button>
            </div>

            {requiredMissing.length > 0 && !submitting && (
              <p className="flex items-center gap-1.5 text-xs text-white/60">
                <AlertCircle className="h-3.5 w-3.5" />
                Still needed: {requiredMissing.map((s) => s.label).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="page-enter overflow-hidden rounded-2xl border border-[hsl(var(--cyan))]/30 bg-white/[0.03] p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-[hsl(var(--cyan))]/20" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--cyan))] to-[hsl(var(--cyan-glow))] shadow-[0_0_40px_-4px_hsl(var(--cyan)/0.7)]">
                <CheckCircle2 className="h-10 w-10 text-[hsl(var(--navy))]" strokeWidth={2.5} />
              </div>
            </div>
            <h2 className="font-heading text-2xl font-bold">Documents received securely</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
              Thank you, <span className="font-semibold text-white">{client.fullName.split(" ")[0]}</span>. Your documents have been encrypted
              and delivered to your adviser. We'll be in touch shortly via {client.email}.
            </p>
            <div className="mx-auto mt-6 max-w-sm rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left text-xs text-white/70">
              <p className="mb-2 flex items-center gap-1.5 font-bold text-white">
                <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--cyan-glow))]" />
                What happens next?
              </p>
              <ul className="space-y-1.5">
                <li className="flex gap-2"><span className="text-[hsl(var(--cyan-glow))]">•</span> Your adviser is notified immediately</li>
                <li className="flex gap-2"><span className="text-[hsl(var(--cyan-glow))]">•</span> Documents are reviewed within 1 business day</li>
                <li className="flex gap-2"><span className="text-[hsl(var(--cyan-glow))]">•</span> You'll receive a confirmation email shortly</li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer trust */}
        <footer className="mt-10 flex flex-col items-center gap-2 text-center text-[10px] text-white/40">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> TLS 1.3</span>
            <span className="opacity-30">·</span>
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> AES-256</span>
            <span className="opacity-30">·</span>
            <span className="flex items-center gap-1"><FileCheck2 className="h-3 w-3" /> Privacy Act 1988</span>
          </div>
          <p>© {new Date().getFullYear()} AdvisorLink · Authorised Representative</p>
        </footer>
      </main>

      {/* Multi-file question dialog */}
      <AlertDialog open={!!pendingPick} onOpenChange={(o) => !o && setPendingPick(null)}>
        <AlertDialogContent className="border-white/10 bg-[hsl(var(--navy))] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              {pendingSlot?.kind === "photo" ? "Multiple photos?" : "Multiple documents?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Are you uploading multiple {pendingNoun}? You can select them all at once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => resolvePick(false)}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              No, just one
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resolvePick(true)}
              className="bg-gradient-to-r from-[hsl(var(--cyan))] to-[hsl(var(--cyan-glow))] font-semibold text-[hsl(var(--navy))] hover:opacity-90"
            >
              Yes, select multiple
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
