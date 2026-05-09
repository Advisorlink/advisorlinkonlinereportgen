import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Shield, Lock, FileCheck2, Camera, Upload, CheckCircle2,
  IdCard, FileText, AlertCircle, Loader2, X, Eye, ChevronRight,
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
};

const DOC_SLOTS: DocSlot[] = [
  { key: "id_front", label: "Photo ID — Front", description: "Driver's licence or passport (front side)", icon: IdCard, required: true },
  { key: "id_back", label: "Photo ID — Back", description: "Back of your driver's licence (skip for passport)", icon: IdCard, required: false },
  { key: "super_statement", label: "Super Statement", description: "Most recent super fund statement (PDF or photo)", icon: FileText, required: true },
  { key: "additional", label: "Additional Document", description: "Any other supporting document (optional)", icon: FileText, required: false },
];

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

type UploadedFile = { file: File; preview?: string };

export default function UploadDocuments() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [client, setClient] = useState({ fullName: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, UploadedFile | undefined>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
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

  const handlePickFile = (slotKey: string, file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: "Maximum file size is 10MB" });
      return;
    }
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    setFiles((prev) => ({ ...prev, [slotKey]: { file, preview } }));
  };

  const handleRemove = (slotKey: string) => {
    const existing = files[slotKey];
    if (existing?.preview) URL.revokeObjectURL(existing.preview);
    setFiles((prev) => ({ ...prev, [slotKey]: undefined }));
  };

  const requiredMissing = DOC_SLOTS.filter((s) => s.required && !files[s.key]);

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
      const slots = DOC_SLOTS.filter((s) => files[s.key]);
      const total = slots.length;
      let done = 0;

      for (const slot of slots) {
        const u = files[slot.key]!;
        const ext = u.file.name.split(".").pop() || "bin";
        const path = `${folder}/${slot.key}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("client-documents")
          .upload(path, u.file, { contentType: u.file.type, upsert: false });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from("client_documents").insert({
          client_name: client.fullName,
          client_email: client.email,
          client_phone: client.phone,
          document_type: slot.key,
          file_path: path,
          file_name: u.file.name,
          file_size: u.file.size,
          mime_type: u.file.type,
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top trust bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Shield className="h-4 w-4 text-primary" />
            <span>AdvisorLink Secure Portal</span>
          </div>
          <div className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
            <Lock className="h-3.5 w-3.5" />
            <span>256-bit TLS Encryption</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Lock className="h-3 w-3" />
            ENCRYPTED DOCUMENT UPLOAD
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Secure Document Submission
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Submit your identification and supporting documents through our encrypted portal.
            Your information is protected with bank-grade security.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex flex-1 items-center gap-2">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step > n ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              {n < 3 && <div className={`h-0.5 flex-1 ${step > n ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* STEP 1: Client details */}
        {step === 1 && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <h2 className="mb-1 text-lg font-semibold">Verify your identity</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Please confirm your details so we can match the documents to your file.
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full legal name</Label>
                <Input
                  id="fullName"
                  value={client.fullName}
                  onChange={(e) => setClient({ ...client, fullName: e.target.value })}
                  placeholder="As shown on your ID"
                  className="mt-1.5"
                />
                {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>}
              </div>
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={client.email}
                  onChange={(e) => setClient({ ...client, email: e.target.value })}
                  placeholder="you@example.com"
                  className="mt-1.5"
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Mobile number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={client.phone}
                  onChange={(e) => setClient({ ...client, phone: e.target.value })}
                  placeholder="04XX XXX XXX"
                  className="mt-1.5"
                />
                {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
              </div>
            </div>
            <Button onClick={handleClientNext} className="mt-6 w-full" size="lg">
              Continue to upload <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP 2: Upload */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <h2 className="mb-1 text-lg font-semibold">Upload your documents</h2>
              <p className="mb-5 text-sm text-muted-foreground">
                You can take a photo with your camera or choose a file. Accepted: JPG, PNG, PDF (max 10MB).
              </p>

              <div className="space-y-3">
                {DOC_SLOTS.map((slot) => {
                  const uploaded = files[slot.key];
                  const Icon = slot.icon;
                  return (
                    <div key={slot.key} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{slot.label}</p>
                              {slot.required && (
                                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                                  REQUIRED
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{slot.description}</p>
                          </div>
                        </div>
                        {uploaded && (
                          <button
                            onClick={() => handleRemove(slot.key)}
                            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Remove file"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {uploaded ? (
                        <div className="mt-3 flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                          {uploaded.preview ? (
                            <img src={uploaded.preview} alt="" className="h-12 w-12 rounded object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                              <FileCheck2 className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{uploaded.file.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {(uploaded.file.size / 1024 / 1024).toFixed(2)} MB · Ready to submit
                            </p>
                          </div>
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                        </div>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <input
                            ref={(el) => (inputRefs.current[`${slot.key}_camera`] = el)}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handlePickFile(slot.key, e.target.files[0])}
                          />
                          <input
                            ref={(el) => (inputRefs.current[`${slot.key}_file`] = el)}
                            type="file"
                            accept={ACCEPTED}
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handlePickFile(slot.key, e.target.files[0])}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => inputRefs.current[`${slot.key}_camera`]?.click()}
                          >
                            <Camera className="mr-1.5 h-4 w-4" /> Take photo
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => inputRefs.current[`${slot.key}_file`]?.click()}
                          >
                            <Upload className="mr-1.5 h-4 w-4" /> Choose file
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Consent + security */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-muted/50 p-3">
                  <Lock className="mx-auto mb-1 h-5 w-5 text-primary" />
                  <p className="text-[11px] font-medium">Encrypted in transit</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <Shield className="mx-auto mb-1 h-5 w-5 text-primary" />
                  <p className="text-[11px] font-medium">Stored securely</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <Eye className="mx-auto mb-1 h-5 w-5 text-primary" />
                  <p className="text-[11px] font-medium">Private access only</p>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  I confirm the documents are mine and I consent to AdvisorLink collecting,
                  storing and using them to provide financial advice services. My data is
                  handled in accordance with the Australian Privacy Act 1988.
                </span>
              </label>
            </div>

            {submitting && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Securely uploading your documents…</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1" size="lg">
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                ) : (
                  <><Lock className="mr-2 h-4 w-4" /> Submit securely</>
                )}
              </Button>
            </div>

            {requiredMissing.length > 0 && !submitting && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                Missing required: {requiredMissing.map((s) => s.label).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* STEP 3: Success */}
        {step === 3 && (
          <div className="rounded-xl border border-border bg-card p-7 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Documents received securely</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you, {client.fullName.split(" ")[0]}. Your documents have been encrypted
              and delivered to your adviser. We'll be in touch shortly via {client.email}.
            </p>
            <div className="mt-6 rounded-lg bg-muted/50 p-4 text-left text-xs text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">What happens next?</p>
              <ul className="space-y-1">
                <li>• Your adviser is notified immediately</li>
                <li>• Documents are reviewed within 1 business day</li>
                <li>• You'll receive a confirmation email shortly</li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer trust */}
        <div className="mt-8 flex flex-col items-center gap-2 text-center text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> TLS 1.3</span>
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> AES-256</span>
            <span className="flex items-center gap-1"><FileCheck2 className="h-3 w-3" /> Privacy Act 1988</span>
          </div>
          <p>© {new Date().getFullYear()} AdvisorLink · Authorised Representative</p>
        </div>
      </div>
    </div>
  );
}
