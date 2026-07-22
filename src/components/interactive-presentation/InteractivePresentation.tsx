import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, Maximize, Minimize, X, Check, Send, Loader2, Copy,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

import slide01 from "@/assets/presentation/01-cover.png";
import slide02 from "@/assets/presentation/02-profile.png";
import slide03 from "@/assets/presentation/03-option1-industry.png";
import slide04 from "@/assets/presentation/04-option2-smsf.png";
import slide05 from "@/assets/presentation/05-option3-adviser.png";
import slide06 from "@/assets/presentation/06-fees.png";
import slide07 from "@/assets/presentation/07-why-choose-us.png";
import slide08 from "@/assets/presentation/08-explained-clearly.png";
import slide09 from "@/assets/presentation/09-next-steps.png";
import slide10 from "@/assets/presentation/10-opportunities.png";

/* ============================================================ */
/*  ADVICE CATEGORIES (matches the 6 cards on slide 10)          */
/* ============================================================ */

type Category = { id: string; title: string; blurb: string; Icon: any };

const CATEGORIES: Category[] = [
  { id: "superannuation", title: "Superannuation", blurb: "Make sure your super is working as hard as it can for your future.", Icon: PiggyBank },
  { id: "investments", title: "Investments", blurb: "Grow your wealth faster with the right investment strategy.", Icon: TrendingUp },
  { id: "insurance", title: "Insurance", blurb: "Protect what matters most and get the right cover in place.", Icon: Umbrella },
  { id: "retirement-planning", title: "Retirement Planning", blurb: "Build a plan today for the lifestyle you want tomorrow.", Icon: HomeIcon },
  { id: "debt-management", title: "Debt Management", blurb: "Pay off debt sooner and take control of your financial future.", Icon: HandCoins },
  { id: "tax-optimisation", title: "Tax Optimisation", blurb: "Legal strategies to help you keep more of what you earn.", Icon: FileText },
];

/* ============================================================ */
/*  SLIDE DEFINITIONS                                            */
/* ============================================================ */

type SlideDef =
  | { kind: "image"; src: string; label: string }
  | { kind: "opportunities"; label: string }
  | { kind: "form"; label: string };

const SLIDES: SlideDef[] = [
  { kind: "image", src: slide01, label: "Welcome" },
  { kind: "image", src: slide02, label: "Your analyst" },
  { kind: "image", src: slide03, label: "Option 1: Industry / Retail" },
  { kind: "image", src: slide04, label: "Option 2: SMSF" },
  { kind: "image", src: slide05, label: "Option 3: Adviser Driven" },
  { kind: "image", src: slide06, label: "Fees & costs" },
  { kind: "image", src: slide07, label: "Why choose us" },
  { kind: "image", src: slide08, label: "Was everything explained" },
  { kind: "image", src: slide09, label: "Super easy next steps" },
  { kind: "opportunities", label: "Other opportunities for advice" },
  { kind: "form", label: "Your details" },
];

/* ============================================================ */
/*  MAIN COMPONENT                                               */
/* ============================================================ */

interface InteractivePresentationProps {
  onExit?: () => void;
  clientName?: string;
  clientEmail?: string;
}

export default function InteractivePresentation({
  onExit,
  clientName: initialName = "",
  clientEmail: initialEmail = "",
}: InteractivePresentationProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [index, setIndex] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const slide = SLIDES[index];
  const isFirst = index === 0;
  const isLast = index === SLIDES.length - 1;

  const next = useCallback(() => setIndex(i => Math.min(i + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setIndex(i => Math.max(i - 1, 0)), []);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  /* fullscreen */
  const enterFs = useCallback(async () => {
    try { await containerRef.current?.requestFullscreen(); } catch {}
  }, []);
  const exitFs = useCallback(async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
  }, []);
  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    // auto-enter fullscreen on mount
    setTimeout(() => { enterFs(); }, 100);
    return () => document.removeEventListener("fullscreenchange", h);
  }, [enterFs]);

  /* keyboard nav */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "Escape" && !document.fullscreenElement) { handleExit(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line
  }, [next, prev]);

  const handleExit = () => {
    exitFs();
    if (onExit) onExit();
    else navigate(-1);
  };

  const copyShareLink = async () => {
    const url = `${window.location.origin}/present`;
    try { await navigator.clipboard.writeText(url); toast.success("Share link copied"); }
    catch { toast.error("Could not copy"); }
  };

  const buildPdf = (): string => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 42, 68);
    doc.text("Advice Request — Settled & Sound", 20, 25);
    doc.setDrawColor(24, 165, 175);
    doc.setLineWidth(0.8);
    doc.line(20, 30, 190, 30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    let y = 42;
    doc.text(`Date: ${new Date().toLocaleString()}`, 20, y); y += 8;
    doc.text(`Name: ${name || "(not provided)"}`, 20, y); y += 7;
    doc.text(`Email: ${email || "(not provided)"}`, 20, y); y += 7;
    doc.text(`Phone: ${phone || "(not provided)"}`, 20, y); y += 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 42, 68);
    doc.text("Areas of interest", 20, y); y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    const picked = CATEGORIES.filter(c => selected.has(c.id));
    if (picked.length === 0) {
      doc.text("(none selected)", 20, y); y += 7;
    } else {
      picked.forEach(c => {
        doc.setFont("helvetica", "bold");
        doc.text(`• ${c.title}`, 20, y); y += 6;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(c.blurb, 165);
        doc.text(lines, 25, y); y += lines.length * 5 + 4;
      });
    }

    return doc.output("datauristring").split(",")[1];
  };

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Please enter your name and email");
      return;
    }
    if (selected.size === 0) {
      toast.error("Please select at least one area of interest");
      return;
    }
    setSubmitting(true);
    try {
      const pdfBase64 = buildPdf();
      const { error } = await supabase.functions.invoke("submit-advice-request", {
        body: {
          client_name: name.trim(),
          client_email: email.trim(),
          client_phone: phone.trim(),
          selected_categories: CATEGORIES.filter(c => selected.has(c.id)).map(c => c.title),
          pdf_base64: pdfBase64,
          filename: `AdviceRequest_${name.trim().replace(/\s+/g, "_")}_${Date.now()}.pdf`,
        },
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("Sent! We'll be in touch shortly.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black overflow-hidden select-none"
    >
      {/* SLIDE STAGE — always 16:9, letterboxed */}
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="relative bg-white shadow-2xl"
          style={{
            width: "min(100vw, calc(100vh * 16 / 9))",
            height: "min(100vh, calc(100vw * 9 / 16))",
            aspectRatio: "16 / 9",
          }}
        >
          {slide.kind === "image" && (
            <img
              src={slide.src}
              alt={slide.label}
              className="w-full h-full object-contain"
              draggable={false}
            />
          )}

          {slide.kind === "opportunities" && (
            <OpportunitiesSlide
              selected={selected}
              onToggle={toggleSelect}
              onContinue={next}
            />
          )}

          {slide.kind === "form" && (
            <FormSlide
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
              selected={selected}
              submit={submit}
              submitting={submitting}
              submitted={submitted}
              onExit={handleExit}
            />
          )}
        </div>
      </div>

      {/* TOP CHROME — hover reveal */}
      <div className="absolute top-0 left-0 right-0 opacity-0 hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
        <div className="bg-gradient-to-b from-black/70 to-transparent px-6 py-4 flex items-center justify-between pointer-events-auto">
          <div className="text-white/80 text-sm font-medium">
            {index + 1} / {SLIDES.length} · {slide.label}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={copyShareLink} className="text-white hover:bg-white/10">
              <Copy className="h-4 w-4 mr-2" /> Share link
            </Button>
            {isFs ? (
              <Button size="sm" variant="ghost" onClick={exitFs} className="text-white hover:bg-white/10">
                <Minimize className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={enterFs} className="text-white hover:bg-white/10">
                <Maximize className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleExit} className="text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* NAV ARROWS */}
      {!isFirst && (
        <button
          onClick={prev}
          aria-label="Previous slide"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-30 hover:opacity-100"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {!isLast && (
        <button
          onClick={next}
          aria-label="Next slide"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-30 hover:opacity-100"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* PROGRESS DOTS */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 bg-black/40 rounded-full px-3 py-2 opacity-40 hover:opacity-100 transition-opacity">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
/*  OPPORTUNITIES SLIDE — interactive selection                  */
/* ============================================================ */

function OpportunitiesSlide({
  selected, onToggle, onContinue,
}: { selected: Set<string>; onToggle: (id: string) => void; onContinue: () => void }) {
  return (
    <div className="absolute inset-0 grid grid-cols-2">
      {/* LEFT — brand panel */}
      <div className="relative bg-[#F5F7FA] p-[3.5%] flex flex-col">
        <div className="text-[#0F2A44] font-bold text-[1.6vw] tracking-tight">
          Settled<span className="text-[#18A5AF]">&</span>Sound
        </div>
        <div className="mt-[10%]">
          <h1 className="text-[#0F2A44] font-black leading-[1.02] tracking-tight" style={{ fontSize: "clamp(28px, 4.2vw, 68px)" }}>
            Some other<br/>opportunities<br/><span className="text-[#18A5AF]">for advice.</span>
          </h1>
          <div className="h-[3px] w-16 bg-[#18A5AF] mt-4" />
          <p className="text-[#0F2A44]/80 mt-6 max-w-[85%]" style={{ fontSize: "clamp(12px, 1.15vw, 20px)" }}>
            There may be other areas of your financial life that, with the right advice, could drastically improve your future.
          </p>
          <p className="text-[#0F2A44] font-bold mt-5" style={{ fontSize: "clamp(14px, 1.3vw, 22px)" }}>
            Tap the ones that interest you.
          </p>
        </div>

        <div className="mt-auto flex items-center gap-3">
          <Button
            onClick={onContinue}
            className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white rounded-full px-6"
            style={{ fontSize: "clamp(12px, 1vw, 16px)" }}
          >
            Continue{selected.size > 0 ? ` (${selected.size} selected)` : ""} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* decorative wave */}
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 500 120" preserveAspectRatio="none" style={{ height: "18%" }}>
          <path d="M0,80 Q125,20 250,60 T500,50 L500,120 L0,120 Z" fill="#0F2A44" />
          <path d="M0,95 Q125,45 250,80 T500,75 L500,120 L0,120 Z" fill="#18A5AF" opacity="0.7" />
        </svg>
      </div>

      {/* RIGHT — interactive grid on a photo backdrop */}
      <div
        className="relative bg-cover bg-center"
        style={{ backgroundImage: `url(${slide10})`, backgroundPosition: "right center" }}
      >
        {/* dim overlay to help the cards pop */}
        <div className="absolute inset-0 bg-white/25" />
        <div className="relative h-full w-full p-[3%] grid grid-cols-3 grid-rows-2 gap-[2%]">
          {CATEGORIES.map(cat => {
            const isSel = selected.has(cat.id);
            const Icon = cat.Icon;
            return (
              <button
                key={cat.id}
                onClick={() => onToggle(cat.id)}
                className={[
                  "relative rounded-2xl p-[6%] flex flex-col items-center justify-center text-center transition-all duration-200 group",
                  isSel
                    ? "bg-gradient-to-br from-[#7A2CFF] to-[#2F6BFF] text-white shadow-2xl ring-4 ring-[#2F6BFF]/60 scale-[1.02]"
                    : "bg-white text-[#0F2A44] shadow-xl hover:shadow-2xl hover:-translate-y-0.5 ring-2 ring-transparent hover:ring-[#18A5AF]/40",
                ].join(" ")}
              >
                {isSel && (
                  <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white text-[#2F6BFF] flex items-center justify-center shadow">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </div>
                )}
                <Icon
                  className={`mb-3 ${isSel ? "text-white" : "text-[#0F2A44]"}`}
                  style={{ width: "clamp(28px, 3.2vw, 56px)", height: "clamp(28px, 3.2vw, 56px)" }}
                  strokeWidth={1.6}
                />
                <div className="font-bold leading-tight" style={{ fontSize: "clamp(12px, 1.25vw, 22px)" }}>
                  {cat.title}
                </div>
                <div
                  className={`mt-1.5 leading-snug ${isSel ? "text-white/90" : "text-[#0F2A44]/70"}`}
                  style={{ fontSize: "clamp(9px, 0.85vw, 15px)" }}
                >
                  {cat.blurb}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  FORM SLIDE — client details + submit to Drive                */
/* ============================================================ */

function FormSlide({
  name, setName, email, setEmail, phone, setPhone,
  selected, submit, submitting, submitted, onExit,
}: {
  name: string; setName: (s: string) => void;
  email: string; setEmail: (s: string) => void;
  phone: string; setPhone: (s: string) => void;
  selected: Set<string>;
  submit: () => void; submitting: boolean; submitted: boolean;
  onExit: () => void;
}) {
  const picked = CATEGORIES.filter(c => selected.has(c.id));

  if (submitted) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F2A44] to-[#123657] text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="h-24 w-24 rounded-full bg-[#18A5AF] flex items-center justify-center mb-6 shadow-2xl">
          <Check className="h-12 w-12 text-white" strokeWidth={3} />
        </div>
        <h1 className="font-black tracking-tight" style={{ fontSize: "clamp(28px, 4vw, 64px)" }}>Thank you!</h1>
        <p className="mt-4 max-w-2xl text-white/80" style={{ fontSize: "clamp(14px, 1.4vw, 22px)" }}>
          Your request has been received. One of our licensed advisers will be in touch with you shortly.
        </p>
        <Button onClick={onExit} className="mt-10 bg-white text-[#0F2A44] hover:bg-white/90 rounded-full px-8">
          Close presentation
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 grid grid-cols-2 bg-white">
      {/* LEFT: brand panel */}
      <div className="relative bg-[#0F2A44] p-[3.5%] text-white flex flex-col">
        <div className="text-white font-bold text-[1.6vw] tracking-tight">
          Settled<span className="text-[#18A5AF]">&</span>Sound
        </div>
        <div className="mt-[15%]">
          <h1 className="font-black leading-[1.02] tracking-tight" style={{ fontSize: "clamp(28px, 4.2vw, 68px)" }}>
            Let's<br/>get you<br/><span className="text-[#18A5AF]">connected.</span>
          </h1>
          <div className="h-[3px] w-16 bg-[#18A5AF] mt-4" />
          <p className="text-white/80 mt-6 max-w-[85%]" style={{ fontSize: "clamp(12px, 1.15vw, 20px)" }}>
            Pop in your details and we'll send this straight through to our advisory team.
          </p>
        </div>

        <div className="mt-auto space-y-2 text-white/70" style={{ fontSize: "clamp(11px, 1vw, 16px)" }}>
          {picked.length > 0 ? (
            <>
              <div className="text-[#18A5AF] font-semibold uppercase tracking-wider text-xs">You're interested in</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {picked.map(p => (
                  <span key={p.id} className="px-3 py-1 rounded-full bg-white/10 text-white text-xs">{p.title}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="text-white/50 italic text-xs">No areas selected — go back to pick some.</div>
          )}
        </div>
      </div>

      {/* RIGHT: form */}
      <div className="p-[5%] flex flex-col justify-center">
        <h2 className="text-[#0F2A44] font-black tracking-tight" style={{ fontSize: "clamp(22px, 2.6vw, 44px)" }}>
          Your details
        </h2>
        <p className="text-[#0F2A44]/60 mt-2" style={{ fontSize: "clamp(12px, 1.05vw, 18px)" }}>
          We'll only use these to have an adviser reach out.
        </p>

        <div className="mt-8 space-y-4 max-w-lg">
          <div>
            <label className="text-[#0F2A44] font-semibold text-sm">Full name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className="mt-1 h-12 text-base" />
          </div>
          <div>
            <label className="text-[#0F2A44] font-semibold text-sm">Email *</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" className="mt-1 h-12 text-base" />
          </div>
          <div>
            <label className="text-[#0F2A44] font-semibold text-sm">Phone</label>
            <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0400 000 000" className="mt-1 h-12 text-base" />
          </div>

          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full h-14 mt-4 bg-gradient-to-r from-[#7A2CFF] to-[#2F6BFF] hover:opacity-90 text-white text-base font-semibold rounded-xl shadow-lg"
          >
            {submitting ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Sending…</>
            ) : (
              <><Send className="h-5 w-5 mr-2" /> Submit request</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
