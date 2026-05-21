import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Shield, Lock, Camera, Upload, CheckCircle2, IdCard,
  ChevronRight, Loader2, X, ShieldCheck, EyeOff,
} from "lucide-react";
import { z } from "zod";

const LOGO_BLACK_URL =
  "https://osqreiyssdhpplxtcxdv.supabase.co/storage/v1/object/public/email-assets/logo-email-black.png";
const PURE_LOGO_URL = "/pure-private-wealth-logo.png";

const MAX_BYTES = 10 * 1024 * 1024;

type Side = "front" | "back";
type Method = "photo" | "upload";

type CapturedFile = {
  id: string;
  side: Side;
  method: Method;
  file: File;
  preview: string;
};

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
});

const REPRESENTATIVES = ["Travis Seckold", "Stas Stanislav"];

export default function LicenseUpload() {
  const [captured, setCaptured] = useState<CapturedFile[]>([]);
  const [client, setClient] = useState({ fullName: "", email: "", representative: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ctxRef = useRef<{ side: Side; method: Method } | null>(null);

  const sides: { side: Side; label: string; hint: string }[] = [
    { side: "front", label: "Front of licence", hint: "Photo or PDF" },
    { side: "back", label: "Back of licence", hint: "Photo or PDF" },
  ];

  const hasSide = (s: Side) => captured.some((c) => c.side === s);

  const trigger = (side: Side, method: Method) => {
    ctxRef.current = { side, method };
    const el = fileInputRef.current;
    if (!el) return;
    el.value = "";
    el.setAttribute("accept", "image/*");
    if (method === "photo") el.setAttribute("capture", "environment");
    else el.removeAttribute("capture");
    el.click();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ctx = ctxRef.current;
    const file = e.target.files?.[0];
    if (!file || !ctx) return;
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: `${file.name} exceeds 10MB` });
      return;
    }
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    setCaptured((prev) => [
      ...prev.filter((c) => c.side !== ctx.side),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        side: ctx.side,
        method: ctx.method,
        file,
        preview,
      },
    ]);
    toast.success(`${ctx.side === "front" ? "Front" : "Back"} added`);
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
      result.error.errors.forEach((e) => {
        if (e.path[0]) fe[e.path[0] as string] = e.message;
      });
      setErrors(fe);
      return;
    }
    if (!consent) return toast.error("Please accept the privacy consent to continue");
    if (captured.length === 0) return toast.error("Please add at least the front of your licence");

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
          notes: `Licence — ${item.side === "front" ? "Front" : "Back"} (${item.method})`,
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

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-[hsl(222_47%_18%)]">
      {/* Header — Pure Private Wealth (variant 3 style) */}
      <header className="bg-[#f4f6fb] pt-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl bg-white px-5 py-3 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] sm:mx-5 md:mx-auto">
          <img src={LOGO_BLACK_URL} alt="Advisor Link Online" className="h-8 w-auto" />
          <div className="flex items-center gap-2 rounded-full bg-[hsl(221_83%_53%)]/8 px-3 py-1 text-[hsl(221_83%_45%)]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Sharing with</span>
          </div>
          <img src={PURE_LOGO_URL} alt="Pure Private Wealth" className="h-12 w-auto sm:h-14" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <input ref={fileInputRef} type="file" className="hidden" onChange={onFile} />

        <div className="mb-6 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(222_47%_18%)]/55">
          <Lock className="h-3 w-3" /> Secure licence upload for Pure Private Wealth
        </div>

        {done ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Thanks, {client.fullName.split(" ")[0]}!</h1>
            <p className="mt-2 text-[14px] text-[hsl(222_47%_18%)]/65">
              Your licence has been sent securely to Pure Private Wealth. You'll hear from your adviser shortly.
            </p>
          </section>
        ) : (
          <>
            <div className="mb-6 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(221_83%_53%)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(221_83%_45%)]">
                <IdCard className="h-3 w-3" /> Driver's Licence
              </span>
              <h1 className="font-heading mt-3 text-[26px] font-bold leading-tight tracking-tight sm:text-[34px]">
                Upload a clear photo of your licence
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[13px] text-[hsl(222_47%_18%)]/60 sm:text-[14px]">
                Front is required, back is optional. Make sure all details are readable.
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

            {/* Front + Back cards */}
            <div className="space-y-4">
              {sides.map(({ side, label, hint }) => {
                const item = captured.find((c) => c.side === side);
                return (
                  <div
                    key={side}
                    className="rounded-2xl bg-white p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] ring-1 ring-[hsl(222_47%_18%)]/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(221_83%_92%)] to-[hsl(221_83%_85%)] text-[hsl(221_83%_45%)]">
                        <IdCard className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold">{label}</p>
                        <p className="text-[12px] text-[hsl(222_47%_18%)]/55">
                          {item ? item.file.name : hint}
                        </p>
                      </div>
                      {hasSide(side) && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      )}
                    </div>

                    {item ? (
                      <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f4f6fb] p-2">
                        {item.preview ? (
                          <img
                            src={item.preview}
                            alt=""
                            className="h-14 w-20 rounded-lg object-cover ring-1 ring-[hsl(222_47%_18%)]/10"
                          />
                        ) : (
                          <div className="flex h-14 w-20 items-center justify-center rounded-lg bg-white">
                            <IdCard className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold">{item.file.name}</p>
                          <p className="text-[10px] uppercase tracking-wider text-[hsl(222_47%_18%)]/55">
                            {item.method === "photo" ? "Captured" : "Uploaded"}
                          </p>
                        </div>
                        <button
                          onClick={() => remove(item.id)}
                          className="rounded p-1.5 text-[hsl(222_47%_18%)]/40 hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => trigger(side, "photo")}
                          className="group flex items-center justify-center gap-2 rounded-xl bg-[hsl(221_83%_53%)] px-3 py-3 text-[13px] font-semibold text-white shadow-[0_4px_16px_-4px_hsl(221_83%_53%/0.5)] transition-transform hover:-translate-y-0.5"
                        >
                          <Camera className="h-4 w-4" /> Take photo
                        </button>
                        <button
                          onClick={() => trigger(side, "upload")}
                          className="group flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-[13px] font-semibold text-[hsl(222_47%_18%)] ring-1 ring-[hsl(222_47%_18%)]/15 transition-colors hover:bg-[hsl(221_83%_53%)]/5 hover:ring-[hsl(221_83%_53%)]/40"
                        >
                          <Upload className="h-4 w-4" /> Upload
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Details + submit */}
            {captured.length > 0 && (
              <section className="mt-6 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] ring-1 ring-[hsl(222_47%_18%)]/5">
                <h2 className="font-heading text-base font-bold">Your details</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="lu-name" className="text-xs">Full name</Label>
                    <Input
                      id="lu-name"
                      value={client.fullName}
                      onChange={(e) => setClient((p) => ({ ...p, fullName: e.target.value }))}
                      className="mt-1"
                    />
                    {errors.fullName && (
                      <p className="mt-1 text-[11px] text-destructive">{errors.fullName}</p>
                    )}
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
                    {errors.email && (
                      <p className="mt-1 text-[11px] text-destructive">{errors.email}</p>
                    )}
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
                  <Checkbox
                    checked={consent}
                    onCheckedChange={(v) => setConsent(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    I consent to Pure Private Wealth receiving and storing my licence securely
                    for the purpose of providing advice.
                  </span>
                </label>

                {submitting && (
                  <div className="mt-4">
                    <Progress value={progress} />
                    <p className="mt-1 text-center text-[11px] text-[hsl(222_47%_18%)]/55">
                      Uploading… {progress}%
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  size="lg"
                  className="mt-5 h-12 w-full rounded-xl bg-[hsl(221_83%_53%)] font-semibold text-white hover:bg-[hsl(221_83%_45%)]"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" /> Send licence securely
                    </>
                  )}
                </Button>
              </section>
            )}
          </>
        )}

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.3em] text-[hsl(222_47%_18%)]/40">
          Pure Private Wealth · via Advisor Link Online
        </p>
      </main>
    </div>
  );
}
