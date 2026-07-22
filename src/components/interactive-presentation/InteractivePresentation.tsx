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
/*  ADVICE CATEGORIES — grouped                                  */
/* ============================================================ */

type Category = { id: string; title: string; overview: string; benefit: string };
type Section = { heading: string; items: Category[] };

const SECTIONS: Section[] = [
  {
    heading: "Core Planning & Income Strategies",
    items: [
      { id: "retirement-readiness", title: 'Retirement Readiness ("The Number")',
        overview: "Detailed cash-flow modeling to project how long capital will last based on expected expenses, healthcare, and travel.",
        benefit: "Gives complete clarity on whether you can afford to stop working and at what age." },
      { id: "ttr", title: "Transition-to-Retirement (TTR) Strategy",
        overview: "Commencing a partial pension from super while still working past age 60.",
        benefit: "Reduce working hours without dropping lifestyle income, or boost super tax-free via salary sacrifice while working full-time." },
      { id: "de-risking", title: "De-risking & Sequence-of-Returns Protection",
        overview: "Shifting portfolio allocation to protect wealth from a sudden market downturn right before retirement.",
        benefit: "Prevents forced selling of growth assets at a loss during market dips." },
      { id: "late-super", title: "Maximising Late-Stage Super Contributions",
        overview: "Utilising salary sacrificing, catch-up concessional rules, and non-concessional caps during peak earning years.",
        benefit: "Maximises compounding inside a low-tax environment before hitting full retirement." },
      { id: "tax-withdrawal", title: "Tax-Efficient Withdrawal & Income Sequencing",
        overview: "Planning the exact order in which you draw down from cash, taxable accounts, and tax-sheltered super.",
        benefit: "Keeps personal marginal income tax as close to zero as possible across your retirement." },
    ],
  },
  {
    heading: "Entitlements, Debt & Legacy",
    items: [
      { id: "age-pension", title: "Social Security & Age Pension Optimisation",
        overview: "Structuring assets and income streams to align with government means tests (Assets & Income Tests).",
        benefit: "Maximises state pension entitlements and healthcare concession cards." },
      { id: "debt-clearance", title: "Pre-Retirement Debt Clearance",
        overview: "Directing cash flow to eliminate mortgages, personal loans, and credit debts prior to leaving work.",
        benefit: "Drastically reduces monthly overheads, lowering the income required to fund retirement." },
      { id: "estate", title: "Estate Planning & Beneficiary Structuring",
        overview: "Updating binding nominations, testamentary trusts, and ownership structures.",
        benefit: "Ensures seamless, tax-minimised wealth transfer to loved ones without legal disputes." },
      { id: "aged-care", title: "Healthcare & Aged Care Planning",
        overview: "Stress-testing portfolios for longevity (living into your 90s) and setting aside contingency buffers for long-term care.",
        benefit: "Protects the surviving spouse from financial distress if one partner requires high-level aged care." },
      { id: "gifting", title: "Early Legacy & Gifting Strategies",
        overview: "Assisting adult children with home deposits or family costs using structured gifts or formal family loans.",
        benefit: "Helps children when they need it most while ensuring you don't breach gifting rules or jeopardise your own security." },
    ],
  },
  {
    heading: "Specialised Execution Strategies",
    items: [
      { id: "three-bucket", title: 'The "Three-Bucket" Income Strategy',
        overview: "Dividing wealth into Bucket 1 (Cash for 1–3 years), Bucket 2 (Defensive Income), and Bucket 3 (Long-term Growth).",
        benefit: "Eliminates market anxiety by ensuring living expenses are funded by cash regardless of market crashes." },
      { id: "recontribution", title: 'Super Re-Contribution Strategy ("Anti-Death Tax")',
        overview: "Withdrawing super tax-free after age 60 and re-contributing it back as an after-tax (non-concessional) amount.",
        benefit: "Shifts the balance from taxable to tax-free, saving non-dependant adult children up to 17% tax on inherited super." },
      { id: "redraw-recycle", title: "Redraw & Recycle (Mortgage Offset to Super)",
        overview: "Using cash in home loan offset/redraw accounts to make tax-deductible super contributions before age 67.",
        benefit: "Reduces personal taxable income while building higher tax-sheltered wealth inside super." },
      { id: "spouse-equalisation", title: "Spouse Equalisation & Pension Shielding",
        overview: "Transferring super contributions to a younger or lower-balance spouse.",
        benefit: "Shields accumulation balances from Centrelink tests and doubles tax-free pension transfer caps." },
      { id: "downsizer", title: "Downsizer Contribution Strategy",
        overview: "Contributing up to $300,000 per person ($600,000 per couple) into super from the sale of a home owned for 10+ years.",
        benefit: "Injects a large lump sum into the tax-free retirement environment late in life without breaching contribution caps." },
    ],
  },
];

const CATEGORIES: Category[] = SECTIONS.flatMap(s => s.items);

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
        const lines = doc.splitTextToSize(c.overview, 165);
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
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="absolute inset-0 grid grid-cols-[34%_1fr] bg-white">
      {/* LEFT — brand panel matching the rest of the deck */}
      <div className="relative overflow-hidden">
        <img
          src={slide10}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F2A44]/95 via-[#0F2A44]/90 to-[#0F2A44]/95" />
        <div className="relative h-full w-full p-[8%] flex flex-col text-white">
          <div className="font-bold tracking-tight" style={{ fontSize: "clamp(14px, 1.4vw, 22px)" }}>
            Settled<span className="text-[#18A5AF]">&</span>Sound
          </div>

          <div className="mt-auto mb-auto">
            <h1 className="font-black leading-[1.02] tracking-tight" style={{ fontSize: "clamp(24px, 3.2vw, 54px)" }}>
              Some other<br/>opportunities<br/><span className="text-[#18A5AF]">for advice.</span>
            </h1>
            <div className="h-[3px] w-14 bg-[#18A5AF] mt-4" />
            <p className="text-white/85 mt-5" style={{ fontSize: "clamp(11px, 1vw, 17px)" }}>
              There may be other areas of your financial life that, with the right advice, could drastically improve your future.
            </p>
            <p className="font-bold mt-4 text-[#18A5AF]" style={{ fontSize: "clamp(12px, 1.05vw, 18px)" }}>
              Tick the ones that interest you.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-white/70" style={{ fontSize: "clamp(11px, 0.9vw, 14px)" }}>
              {selected.size} selected
            </div>
            <Button
              onClick={onContinue}
              className="bg-[#18A5AF] hover:bg-[#18A5AF]/90 text-white rounded-full px-5 h-10"
              style={{ fontSize: "clamp(11px, 0.95vw, 15px)" }}
            >
              Skip to form <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT — compact 3-column grid, fits 16:9 with no scroll */}
      <div className="relative flex flex-col bg-[#F7F9FC] p-[2.2%]">
        <div className="grid grid-cols-3 gap-[1.8%] flex-1 min-h-0">
          {SECTIONS.map(section => (
            <div key={section.heading} className="flex flex-col min-h-0">
              <div className="text-[#18A5AF] font-bold uppercase tracking-[0.12em] mb-2 leading-tight"
                   style={{ fontSize: "clamp(9px, 0.75vw, 12px)" }}>
                {section.heading}
              </div>

              <ul className="space-y-[6px] flex-1">
                {section.items.map(cat => {
                  const isSel = selected.has(cat.id);
                  const isOpen = openId === cat.id;
                  return (
                    <li key={cat.id} className="relative">
                      <div
                        className={[
                          "rounded-lg bg-white border transition-all flex items-center gap-2 px-2.5 py-2",
                          isSel ? "border-[#18A5AF] shadow-sm" : "border-[#0F2A44]/10 hover:border-[#18A5AF]/50",
                        ].join(" ")}
                      >
                        <button
                          onClick={() => onToggle(cat.id)}
                          aria-pressed={isSel}
                          aria-label={`Select ${cat.title}`}
                          className={[
                            "flex-shrink-0 rounded flex items-center justify-center transition-all",
                            isSel
                              ? "bg-[#18A5AF] border-[#18A5AF] text-white"
                              : "bg-white border-[#0F2A44]/30 hover:border-[#18A5AF]",
                          ].join(" ")}
                          style={{ width: "clamp(16px, 1.3vw, 22px)", height: "clamp(16px, 1.3vw, 22px)", borderWidth: 2 }}
                        >
                          {isSel && <Check style={{ width: "70%", height: "70%" }} strokeWidth={3.5} />}
                        </button>

                        <button
                          onClick={() => onToggle(cat.id)}
                          className="flex-1 text-left text-[#0F2A44] font-semibold leading-tight"
                          style={{ fontSize: "clamp(10px, 0.85vw, 14px)" }}
                        >
                          {cat.title}
                        </button>

                        <button
                          onClick={() => setOpenId(isOpen ? null : cat.id)}
                          className="text-[#18A5AF] hover:text-[#0F2A44] font-semibold flex-shrink-0 flex items-center gap-0.5"
                          style={{ fontSize: "clamp(9px, 0.7vw, 11px)" }}
                        >
                          {isOpen ? "Hide" : "Read"}
                          <ChevronDown
                            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                            style={{ width: "clamp(10px, 0.85vw, 14px)", height: "clamp(10px, 0.85vw, 14px)" }}
                          />
                        </button>
                      </div>

                      {/* Popover for read-more so it doesn't push layout / cause scroll */}
                      {isOpen && (
                        <div
                          className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg bg-[#0F2A44] text-white shadow-2xl p-3 ring-1 ring-[#18A5AF]/40"
                          onClick={() => setOpenId(null)}
                        >
                          <div className="text-[#18A5AF] uppercase tracking-wider font-bold mb-0.5"
                               style={{ fontSize: "clamp(7px, 0.6vw, 10px)" }}>
                            Overview
                          </div>
                          <p className="text-white/90 leading-snug mb-2"
                             style={{ fontSize: "clamp(9px, 0.75vw, 12px)" }}>
                            {cat.overview}
                          </p>
                          <div className="text-[#18A5AF] uppercase tracking-wider font-bold mb-0.5"
                               style={{ fontSize: "clamp(7px, 0.6vw, 10px)" }}>
                            Key benefit
                          </div>
                          <p className="text-white leading-snug"
                             style={{ fontSize: "clamp(9px, 0.75vw, 12px)" }}>
                            {cat.benefit}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[#0F2A44]/60"
             style={{ fontSize: "clamp(9px, 0.75vw, 12px)" }}>
          <span>Tap a row to tick it. Tap "Read" for a short description.</span>
          <span>{selected.size} selected</span>
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
