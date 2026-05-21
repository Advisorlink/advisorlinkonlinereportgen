import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Shield, Lock, Camera, Upload, CheckCircle2, FileText,
  Image as ImageIcon, ChevronRight, Loader2, X, ArrowLeft, ShieldCheck,
  Eye, EyeOff,
} from "lucide-react";
import { z } from "zod";

const LOGO_URL =
  "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png";

const MAX_BYTES = 15 * 1024 * 1024;

type Method = "screenshot" | "photo" | "pdf";

type CapturedFile = {
  id: string;
  method: Method;
  file: File;
  preview: string;
};

const METHOD_OPTIONS: {
  type: Method;
  label: string;
  description: string;
  icon: typeof ImageIcon;
  accept: string;
  capture?: "environment";
}[] = [
  {
    type: "screenshot",
    label: "Screenshot",
    description: "Upload a screenshot from your phone or computer",
    icon: ImageIcon,
    accept: "image/*",
  },
  {
    type: "photo",
    label: "Photo",
    description: "Take a photo of your printed statement",
    icon: Camera,
    accept: "image/*",
    capture: "environment",
  },
  {
    type: "pdf",
    label: "PDF",
    description: "Upload the PDF straight from your super or bank",
    icon: FileText,
    accept: "application/pdf",
  },
];

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
});

export default function StatementUpload() {
  const [captured, setCaptured] = useState<CapturedFile[]>([]);
  const [client, setClient] = useState({ fullName: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const methodCtxRef = useRef<Method | null>(null);

  const triggerPick = (method: Method) => {
    methodCtxRef.current = method;
    const opt = METHOD_OPTIONS.find((m) => m.type === method)!;
    const el = fileInputRef.current;
    if (!el) return;
    el.value = "";
    el.setAttribute("accept", opt.accept);
    if (opt.capture) el.setAttribute("capture", opt.capture);
    else el.removeAttribute("capture");
    el.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const method = methodCtxRef.current;
    const file = e.target.files?.[0];
    if (!file || !method) return;
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: `${file.name} exceeds 15MB` });
      return;
    }
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    setCaptured((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        method,
        file,
        preview,
      },
    ]);
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
      result.error.errors.forEach((e) => {
        if (e.path[0]) fe[e.path[0] as string] = e.message;
      });
      setErrors(fe);
      return;
    }
    if (!consent) {
      toast.error("Please accept the privacy consent to continue");
      return;
    }
    if (captured.length === 0) {
      toast.error("Please add at least one statement");
      return;
    }
    setErrors({});
    setSubmitting(true);
    setProgress(5);
    try {
      const slug = client.email.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const folder = `${slug}/${Date.now()}`;
      const total = captured.length;
      let count = 0;
      for (const item of captured) {
        const ext = item.file.name.split(".").pop() || (item.method === "pdf" ? "pdf" : "jpg");
        const path = `${folder}/statement_${item.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("client-documents")
          .upload(path, item.file, { contentType: item.file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("client_documents").insert({
          client_name: client.fullName,
          client_email: client.email,
          document_type: "statement",
          file_path: path,
          file_name: item.file.name,
          file_size: item.file.size,
          mime_type: item.file.type,
          consent_given: true,
          notes: `Method: ${item.method}`,
        });
        if (dbErr) throw dbErr;
        count += 1;
        setProgress(Math.round((count / total) * 100));
      }
      setDone(true);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Upload failed", {
        description: e instanceof Error ? e.message : "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ───────── Layout ─────────
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[hsl(215_60%_12%)]">
      {/* Header */}
      <header className="relative overflow-hidden bg-[hsl(215_60%_10%)] text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(192_90%_50%)]/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-[hsl(192_90%_60%)]/15 blur-3xl" />
        <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5">
          <img src={LOGO_URL} alt="AdvisorLink Online" className="h-9 w-auto invert" />
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(192_90%_55%)] shadow-[0_0_12px_2px_hsl(192_90%_55%)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Secure Upload</span>
          </div>
        </div>
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(192_90%_55%)] to-transparent" />
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onFileChange}
        />

        {done ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Thanks, {client.fullName.split(" ")[0]}!</h1>
            <p className="mt-2 text-[14px] text-[hsl(215_60%_12%)]/65">
              Your statement has been sent securely to your adviser at AdvisorLink Online.
              You'll hear from us shortly.
            </p>
          </section>
        ) : (
          <>
            {/* Intro */}
            <div className="mb-6 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(192_90%_50%)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(192_90%_30%)]">
                <Lock className="h-3 w-3" /> Secured upload
              </span>
              <h1 className="font-heading mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
                Send through your most recent statement
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[14px] text-[hsl(215_60%_12%)]/65">
                Feel free to just take photos or screenshots — and block out any personal
                information you'd prefer to keep private. We'll handle the rest.
              </p>
            </div>

            {/* Privacy strip */}
            <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl border border-[hsl(215_60%_12%)]/10 bg-white p-3 text-center text-[10px] font-semibold uppercase tracking-wider text-[hsl(215_60%_12%)]/60">
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-[hsl(192_90%_35%)]" /> Encrypted
              </div>
              <div className="flex flex-col items-center gap-1">
                <EyeOff className="h-4 w-4 text-[hsl(192_90%_35%)]" /> Private
              </div>
              <div className="flex flex-col items-center gap-1">
                <Shield className="h-4 w-4 text-[hsl(192_90%_35%)]" /> Adviser-only
              </div>
            </div>

            {/* Method cards */}
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
                    onClick={() => triggerPick(opt.type)}
                    className="group flex w-full items-center gap-4 rounded-xl border border-[hsl(215_60%_12%)]/10 bg-white px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-[hsl(192_90%_50%)]/40 hover:shadow-[0_12px_32px_-12px_hsl(192_90%_50%/0.4)]"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(215_60%_12%)] to-[hsl(215_60%_22%)] text-[hsl(192_90%_55%)] shadow-[0_4px_16px_-4px_hsl(215_60%_12%/0.4)]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(192_90%_30%)]">
                          Option {i + 1}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[15px] font-semibold">{opt.label}</p>
                      <p className="mt-0.5 text-[12px] text-[hsl(215_60%_12%)]/60">
                        {opt.description}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[hsl(215_60%_12%)]/30 transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(192_90%_45%)]" />
                  </button>
                );
              })}
            </div>

            {/* Uploaded list */}
            {captured.length > 0 && (
              <section className="mt-6 rounded-xl border border-[hsl(215_60%_12%)]/10 bg-white p-5">
                <h2 className="font-heading text-base font-bold">
                  {captured.length} statement{captured.length === 1 ? "" : "s"} ready
                </h2>
                <div className="mt-3 space-y-2">
                  {captured.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-lg border border-[hsl(215_60%_12%)]/10 bg-[#f4f7fb] p-2"
                    >
                      {c.preview ? (
                        <img
                          src={c.preview}
                          alt=""
                          className="h-12 w-16 rounded object-cover ring-1 ring-[hsl(215_60%_12%)]/10"
                        />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded bg-white">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{c.file.name}</p>
                        <p className="text-[11px] uppercase tracking-wider text-[hsl(215_60%_12%)]/55">
                          {c.method}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(c.id)}
                        className="rounded p-1.5 text-[hsl(215_60%_12%)]/40 hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Details */}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="su-name" className="text-xs">Your full name</Label>
                    <Input
                      id="su-name"
                      value={client.fullName}
                      onChange={(e) =>
                        setClient((p) => ({ ...p, fullName: e.target.value }))
                      }
                      className="mt-1"
                    />
                    {errors.fullName && (
                      <p className="mt-1 text-[11px] text-destructive">{errors.fullName}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="su-email" className="text-xs">Email</Label>
                    <Input
                      id="su-email"
                      type="email"
                      value={client.email}
                      onChange={(e) => setClient((p) => ({ ...p, email: e.target.value }))}
                      className="mt-1"
                    />
                    {errors.email && (
                      <p className="mt-1 text-[11px] text-destructive">{errors.email}</p>
                    )}
                  </div>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-2 text-[12px] text-[hsl(215_60%_12%)]/70">
                  <Checkbox
                    checked={consent}
                    onCheckedChange={(v) => setConsent(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    I consent to AdvisorLink Online receiving and storing this statement
                    securely for the purpose of providing advice.
                  </span>
                </label>

                {submitting && (
                  <div className="mt-4">
                    <Progress value={progress} />
                    <p className="mt-1 text-center text-[11px] text-[hsl(215_60%_12%)]/55">
                      Uploading… {progress}%
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  size="lg"
                  className="mt-5 h-12 w-full rounded-lg bg-[hsl(215_60%_12%)] font-semibold text-white hover:bg-[hsl(215_60%_18%)]"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" /> Send statement securely
                    </>
                  )}
                </Button>
              </section>
            )}
          </>
        )}

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.3em] text-[hsl(215_60%_12%)]/40">
          AdvisorLink Online · Secure document portal
        </p>
      </main>
    </div>
  );
}
