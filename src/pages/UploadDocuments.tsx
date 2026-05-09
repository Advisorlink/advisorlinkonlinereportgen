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
  IdCard, FileText, AlertCircle, Loader2, X, ChevronRight,
} from "lucide-react";
import { z } from "zod";
const LOGO_BLACK_URL = "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png";

const REPRESENTATIVES = [
  "Travis Miller",
  "Sarah Chen",
  "James O'Connor",
  "Olivia Bennett",
];

const clientSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  representative: z.string().trim().min(1, "Please select your representative"),
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
  const [client, setClient] = useState({ fullName: "", email: "", representative: "" });
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
          client_phone: `Adviser: ${client.representative}`,
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

  // Brand colors as inline style refs
  const navy = "hsl(215 60% 12%)";

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[hsl(215_32%_14%)]">
      {/* Top brand bar */}
      <header className="border-b border-[hsl(215_60%_12%)]/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center">
            <img src={LOGO_BLACK_URL} alt="Advisor Link Online" className="h-10 w-auto" />
          </div>
          <div className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(215_60%_12%)]/60 sm:flex">
            <Lock className="h-3 w-3" />
            Secure Channel
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 border-y border-[hsl(215_60%_12%)]/15 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(215_60%_12%)]/70">
            <span className="h-px w-4 bg-[hsl(215_60%_12%)]/30" />
            Confidential Client Portal
            <span className="h-px w-4 bg-[hsl(215_60%_12%)]/30" />
          </div>
          <h1 className="font-heading text-[28px] font-bold leading-tight tracking-tight text-[hsl(215_60%_12%)] sm:text-[34px]">
            Document Submission
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-[hsl(215_60%_12%)]/65">
            Your adviser has invited you to submit your identification and supporting
            documents through our private, encrypted portal.
          </p>
        </div>

        {/* Step indicator — refined serial */}
        <div className="mx-auto mb-8 flex max-w-md items-center justify-between">
          {[
            { n: 1, label: "Identity" },
            { n: 2, label: "Documents" },
            { n: 3, label: "Confirmed" },
          ].map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-all ${
                    step >= s.n
                      ? "border-[hsl(215_60%_12%)] bg-[hsl(215_60%_12%)] text-white"
                      : "border-[hsl(215_60%_12%)]/20 bg-white text-[hsl(215_60%_12%)]/40"
                  }`}
                >
                  {step > s.n ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} /> : s.n}
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${step >= s.n ? "text-[hsl(215_60%_12%)]" : "text-[hsl(215_60%_12%)]/35"}`}>
                  {s.label}
                </span>
              </div>
              {i < 2 && <div className={`mx-2 mb-5 h-px flex-1 ${step > s.n ? "bg-[hsl(215_60%_12%)]" : "bg-[hsl(215_60%_12%)]/15"}`} />}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <section className="page-enter overflow-hidden rounded-md border border-[hsl(215_60%_12%)]/10 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="border-b border-[hsl(215_60%_12%)]/10 bg-[hsl(215_60%_12%)] px-7 py-5 text-white">
              <h2 className="font-heading text-lg font-semibold">Verify your identity</h2>
              <p className="mt-0.5 text-[12px] text-white/65">
                Please confirm your details so we can match the documents to your file.
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
                  className="mt-1.5 h-11 rounded-sm border-[hsl(215_60%_12%)]/15 bg-white text-[hsl(215_60%_12%)] placeholder:text-[hsl(215_60%_12%)]/30 focus-visible:border-[hsl(215_60%_12%)] focus-visible:ring-1 focus-visible:ring-[hsl(215_60%_12%)]"
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
                  className="mt-1.5 h-11 rounded-sm border-[hsl(215_60%_12%)]/15 bg-white text-[hsl(215_60%_12%)] placeholder:text-[hsl(215_60%_12%)]/30 focus-visible:border-[hsl(215_60%_12%)] focus-visible:ring-1 focus-visible:ring-[hsl(215_60%_12%)]"
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="representative" className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(215_60%_12%)]/70">Your representative</Label>
                <select
                  id="representative"
                  value={client.representative}
                  onChange={(e) => setClient({ ...client, representative: e.target.value })}
                  className="mt-1.5 flex h-11 w-full rounded-sm border border-[hsl(215_60%_12%)]/15 bg-white px-3 py-2 text-sm text-[hsl(215_60%_12%)] focus-visible:border-[hsl(215_60%_12%)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(215_60%_12%)]"
                >
                  <option value="" disabled>Select your representative</option>
                  {REPRESENTATIVES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {errors.representative && <p className="mt-1 text-xs text-destructive">{errors.representative}</p>}
              </div>

              <Button
                onClick={handleClientNext}
                size="lg"
                className="mt-2 h-12 w-full rounded-sm bg-[hsl(215_60%_12%)] font-semibold tracking-wide text-white hover:bg-[hsl(215_60%_18%)]"
              >
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="page-enter space-y-4">
            <section className="overflow-hidden rounded-md border border-[hsl(215_60%_12%)]/10 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
              <div className="border-b border-[hsl(215_60%_12%)]/10 bg-[hsl(215_60%_12%)] px-7 py-5 text-white">
                <h2 className="font-heading text-lg font-semibold">Upload your documents</h2>
                <p className="mt-0.5 text-[12px] text-white/65">
                  Take a photo or choose a file. JPG, PNG, PDF — up to 10MB each.
                </p>
              </div>

              <div className="space-y-3 p-5 sm:p-6">
                {DOC_SLOTS.map((slot) => {
                  const uploaded = files[slot.key] || [];
                  const Icon = slot.icon;
                  const hasFiles = uploaded.length > 0;
                  return (
                    <div
                      key={slot.key}
                      className={`rounded-md border p-4 transition-all ${
                        hasFiles
                          ? "border-[hsl(215_60%_12%)]/40 bg-[hsl(215_60%_12%)]/[0.025]"
                          : "border-[hsl(215_60%_12%)]/12 bg-white hover:border-[hsl(215_60%_12%)]/25"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${
                            hasFiles
                              ? "bg-[hsl(215_60%_12%)] text-white"
                              : "border border-[hsl(215_60%_12%)]/15 bg-white text-[hsl(215_60%_12%)]/70"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-semibold text-[hsl(215_60%_12%)]">{slot.label}</p>
                            {slot.required ? (
                              <span className="rounded-sm bg-[hsl(215_60%_12%)]/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[hsl(215_60%_12%)]">
                                Required
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium uppercase tracking-wider text-[hsl(215_60%_12%)]/40">
                                Optional
                              </span>
                            )}
                            {hasFiles && (
                              <span className="rounded-sm bg-emerald-700/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                                {uploaded.length} file{uploaded.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[12px] text-[hsl(215_60%_12%)]/55">{slot.description}</p>
                        </div>
                      </div>

                      {hasFiles && (
                        <div className="mt-3 space-y-1.5">
                          {uploaded.map((u, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2.5 rounded-sm border border-[hsl(215_60%_12%)]/10 bg-[#f7f5f0] p-2"
                            >
                              {u.preview ? (
                                <img src={u.preview} alt="" className="h-10 w-10 rounded-sm object-cover ring-1 ring-[hsl(215_60%_12%)]/10" />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white">
                                  <FileCheck2 className="h-5 w-5 text-[hsl(215_60%_12%)]" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-medium text-[hsl(215_60%_12%)]">{u.file.name}</p>
                                <p className="text-[10px] text-[hsl(215_60%_12%)]/50">
                                  {(u.file.size / 1024 / 1024).toFixed(2)} MB · Ready
                                </p>
                              </div>
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                              <button
                                onClick={() => handleRemove(slot.key, idx)}
                                className="shrink-0 rounded-sm p-1 text-[hsl(215_60%_12%)]/40 hover:bg-[hsl(215_60%_12%)]/[0.06] hover:text-[hsl(215_60%_12%)]"
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
                          className="rounded-sm border-[hsl(215_60%_12%)]/20 bg-white text-[hsl(215_60%_12%)] hover:bg-[hsl(215_60%_12%)] hover:text-white"
                          onClick={() => askMultiple(slot.key, "camera")}
                        >
                          <Camera className="mr-1.5 h-4 w-4" />
                          {hasFiles ? "Add photo" : "Take photo"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-sm border-[hsl(215_60%_12%)]/20 bg-white text-[hsl(215_60%_12%)] hover:bg-[hsl(215_60%_12%)] hover:text-white"
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
            </section>

            {/* Consent */}
            <section className="rounded-md border border-[hsl(215_60%_12%)]/10 bg-white p-5">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5 border-[hsl(215_60%_12%)]/30 data-[state=checked]:border-[hsl(215_60%_12%)] data-[state=checked]:bg-[hsl(215_60%_12%)] data-[state=checked]:text-white"
                />
                <span className="text-[12px] leading-relaxed text-[hsl(215_60%_12%)]/75">
                  I confirm these documents are mine and consent to AdvisorLink collecting,
                  storing and using them to provide financial advice services. My data is
                  handled in accordance with the <span className="font-semibold text-[hsl(215_60%_12%)]">Australian Privacy Act 1988</span>.
                </span>
              </label>
            </section>

            {submitting && (
              <div className="rounded-md border border-[hsl(215_60%_12%)]/15 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-[13px] text-[hsl(215_60%_12%)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Securely uploading your documents…</span>
                  <span className="ml-auto text-xs text-[hsl(215_60%_12%)]/60">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="rounded-sm border-[hsl(215_60%_12%)]/20 bg-white text-[hsl(215_60%_12%)] hover:bg-[hsl(215_60%_12%)]/[0.04]"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="h-12 flex-1 rounded-sm bg-[hsl(215_60%_12%)] font-semibold tracking-wide text-white hover:bg-[hsl(215_60%_18%)]"
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                ) : (
                  <><Lock className="mr-2 h-4 w-4" /> Submit securely</>
                )}
              </Button>
            </div>

            {requiredMissing.length > 0 && !submitting && (
              <p className="flex items-center gap-1.5 text-xs text-[hsl(215_60%_12%)]/60">
                <AlertCircle className="h-3.5 w-3.5" />
                Still needed: {requiredMissing.map((s) => s.label).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <section className="page-enter overflow-hidden rounded-md border border-[hsl(215_60%_12%)]/10 bg-white text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="border-b border-[hsl(215_60%_12%)]/10 bg-[hsl(215_60%_12%)] px-7 py-8 text-white">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/10">
                <CheckCircle2 className="h-7 w-7 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="font-heading text-2xl font-bold">Documents received</h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] text-white/70">
                Thank you, {client.fullName.split(" ")[0]}. Your documents have been encrypted
                and delivered to your adviser.
              </p>
            </div>
            <div className="px-7 py-6 text-left">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[hsl(215_60%_12%)]/70">
                What happens next
              </p>
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
            © {new Date().getFullYear()} Advisor Link Online · Authorised Representative
          </p>
        </footer>
      </main>

      {/* Multi-file question dialog */}
      <AlertDialog open={!!pendingPick} onOpenChange={(o) => !o && setPendingPick(null)}>
        <AlertDialogContent className="border-[hsl(215_60%_12%)]/15 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-[hsl(215_60%_12%)]">
              {pendingSlot?.kind === "photo" ? "Multiple photos?" : "Multiple documents?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[hsl(215_60%_12%)]/70">
              Are you uploading multiple {pendingNoun}? You can select them all at once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => resolvePick(false)}
              className="rounded-sm border-[hsl(215_60%_12%)]/20 bg-white text-[hsl(215_60%_12%)] hover:bg-[hsl(215_60%_12%)]/[0.04]"
            >
              No, just one
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resolvePick(true)}
              className="rounded-sm bg-[hsl(215_60%_12%)] font-semibold text-white hover:bg-[hsl(215_60%_18%)]"
            >
              Yes, select multiple
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
