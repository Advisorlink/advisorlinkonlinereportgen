import { useState } from "react";
import { useParams } from "react-router-dom";
import { BookingPicker } from "@/components/booking/BookingPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, CheckCircle2, Calendar as CalendarIcon, Clock, Video, Sparkles } from "lucide-react";
import logo from "@/assets/logo.svg";

export default function BookPublic() {
  const { slug = "travis" } = useParams();
  const [step, setStep] = useState<"pick" | "form" | "done">("pick");
  const [pickedIso, setPickedIso] = useState<string | null>(null);
  const [pickedTz, setPickedTz] = useState<string>("Australia/Sydney");
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async () => {
    if (!pickedIso) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Please add your name and email");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-create", {
        body: {
          slug,
          startAt: pickedIso,
          clientName: form.name.trim(),
          clientEmail: form.email.trim(),
          clientPhone: form.phone.trim() || null,
          clientTimezone: pickedTz,
          notes: form.notes.trim() || null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setResult(data.booking);
      setStep("done");
    } catch (e: any) {
      toast.error(e.message || "Couldn't book - try another time");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06101f] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 30% 0%, hsl(192 90% 50% / 0.18), transparent 60%), radial-gradient(ellipse 50% 50% at 80% 100%, hsl(215 80% 40% / 0.18), transparent 60%)" }}
      />
      <div className="relative max-w-5xl mx-auto px-4 py-10 sm:py-16">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Advisor Link Online" className="h-10 w-auto" />
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-cyan/70 font-semibold">
            Book a call
          </div>
        </header>

        <div className="grid lg:grid-cols-[260px_1fr] gap-8 mb-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan/10 text-cyan text-[10px] font-semibold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Strategy Call
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.05]">
              Book a call with <span className="text-cyan">Travis Seckold</span>
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              A focused 45-minute call to review your super and walk you through your personalised strategy.
            </p>
            <div className="space-y-2 pt-2 text-sm">
              <div className="flex items-center gap-2 text-white/70"><Clock className="w-4 h-4 text-cyan" /> 45 minutes</div>
              <div className="flex items-center gap-2 text-white/70"><Video className="w-4 h-4 text-cyan" /> Online screen-share</div>
              <div className="flex items-center gap-2 text-white/70"><CalendarIcon className="w-4 h-4 text-cyan" /> Reschedule any time</div>
            </div>
          </div>

          <div>
            {step === "pick" && (
              <BookingPicker
                slug={slug}
                selected={pickedIso ?? undefined}
                onSelect={(iso, tz) => { setPickedIso(iso); setPickedTz(tz); setStep("form"); }}
              />
            )}

            {step === "form" && pickedIso && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-6 backdrop-blur-sm">
                <button
                  onClick={() => setStep("pick")}
                  className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-4"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Pick a different time
                </button>
                <div className="mb-5 p-4 rounded-xl bg-cyan/10 border border-cyan/30">
                  <div className="text-[10px] uppercase tracking-widest text-cyan/80 font-semibold mb-1">Your slot</div>
                  <div className="font-semibold">
                    {new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: pickedTz }).format(new Date(pickedIso))}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">{pickedTz}</div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-white/70">Full name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="bg-white/[0.04] border-white/10 text-white mt-1" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-white/70">Email *</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="bg-white/[0.04] border-white/10 text-white mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-white/70">Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="bg-white/[0.04] border-white/10 text-white mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-white/70">Anything you'd like Travis to know?</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={3} className="bg-white/[0.04] border-white/10 text-white mt-1" />
                  </div>
                  <Button onClick={submit} disabled={busy}
                    className="w-full h-12 bg-cyan text-navy hover:bg-cyan-glow font-semibold shadow-glow">
                    {busy ? "Booking..." : "Confirm booking"}
                  </Button>
                </div>
              </div>
            )}

            {step === "done" && result && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-8 backdrop-blur-sm text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-cyan/15 flex items-center justify-center mb-4 shadow-glow">
                  <CheckCircle2 className="w-8 h-8 text-cyan" />
                </div>
                <h2 className="text-2xl font-bold mb-2">You're booked!</h2>
                <p className="text-white/60 mb-6">A confirmation email is on its way.</p>
                <div className="p-4 rounded-xl bg-cyan/10 border border-cyan/30 text-left mb-6">
                  <div className="text-[10px] uppercase tracking-widest text-cyan/80 font-semibold mb-1">When</div>
                  <div className="font-semibold">{result.dateStr}</div>
                  <div className="text-white/70 text-sm">{result.timeStr} ({result.tz})</div>
                </div>
                <Button asChild className="w-full bg-cyan text-navy hover:bg-cyan-glow font-semibold">
                  <a href={result.meeting_link}>Save meeting link</a>
                </Button>
              </div>
            )}
          </div>
        </div>

        <footer className="text-center text-[11px] text-white/30 mt-12">
          Powered by Advisor Link Online · advisorlinkonline.com.au
        </footer>
      </div>
    </div>
  );
}
