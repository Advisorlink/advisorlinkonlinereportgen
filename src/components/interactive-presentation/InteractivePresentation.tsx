import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, Maximize, Minimize, X, Check, Phone, Mail,
  MapPin, ShieldCheck, Users, Star, TrendingUp, Landmark, Building2,
  Sparkles, Send, Loader2, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/settled-and-sound-wordmark-white.png.asset.json";
import jsPDF from "jspdf";

/* ============================================================ */
/*  DATA                                                         */
/* ============================================================ */

interface AdviceCategory {
  n: number;
  title: string;
  overview: string;
  benefit: string;
  section: string;
}

const CATEGORIES: AdviceCategory[] = [
  // Core planning & income strategies
  { n: 1, section: "Core Planning & Income", title: 'Retirement Readiness ("The Number")', overview: "Detailed cash flow modeling to project how long capital will last based on expected expenses, healthcare, and travel.", benefit: "Complete clarity on whether you can afford to stop working and at what age." },
  { n: 2, section: "Core Planning & Income", title: "Transition to Retirement (TTR)", overview: "Commencing a partial pension from super while still working past age 60.", benefit: "Reduce hours without dropping lifestyle income, or boost super tax free while working full time." },
  { n: 3, section: "Core Planning & Income", title: "De-risking & Sequence Protection", overview: "Shifting portfolio allocation to protect wealth from a sudden downturn right before retirement.", benefit: "Prevents forced selling of growth assets at a loss during market dips." },
  { n: 4, section: "Core Planning & Income", title: "Maximising Late-Stage Super Contributions", overview: "Utilising salary sacrifice, catch-up concessional rules, and non-concessional caps during peak earning years.", benefit: "Maximises compounding inside a low tax environment before full retirement." },
  { n: 5, section: "Core Planning & Income", title: "Tax-Efficient Withdrawal Sequencing", overview: "Planning the exact order in which you draw from cash, taxable accounts and tax sheltered super.", benefit: "Keeps personal marginal tax as close to zero as possible in retirement." },

  // Entitlements, debt & legacy
  { n: 6, section: "Entitlements, Debt & Legacy", title: "Age Pension Optimisation", overview: "Structuring assets and income streams to align with government means tests.", benefit: "Maximises state pension entitlements and healthcare concession cards." },
  { n: 7, section: "Entitlements, Debt & Legacy", title: "Pre-Retirement Debt Clearance", overview: "Directing cash flow to eliminate mortgages, personal loans and credit debts prior to leaving work.", benefit: "Drastically reduces monthly overheads, lowering required retirement income." },
  { n: 8, section: "Entitlements, Debt & Legacy", title: "Estate Planning & Beneficiaries", overview: "Updating binding nominations, testamentary trusts and ownership structures.", benefit: "Seamless, tax-minimised wealth transfer to loved ones without legal disputes." },
  { n: 9, section: "Entitlements, Debt & Legacy", title: "Healthcare & Aged Care Planning", overview: "Stress testing portfolios for longevity and setting aside contingency buffers for long-term care.", benefit: "Protects the surviving spouse from financial distress if high-level care is needed." },
  { n: 10, section: "Entitlements, Debt & Legacy", title: "Early Legacy & Gifting Strategies", overview: "Assisting adult children with home deposits or family costs using structured gifts or family loans.", benefit: "Helps children when they need it most without breaching gifting rules." },

  // Specialised execution
  { n: 11, section: "Specialised Execution", title: 'The "Three Bucket" Income Strategy', overview: "Cash for 1-3 years, defensive income, and long-term growth split into separate buckets.", benefit: "Eliminates market anxiety by funding living expenses regardless of market crashes." },
  { n: 12, section: "Specialised Execution", title: "Super Re-Contribution Strategy", overview: "Withdrawing super tax free after 60 and re-contributing as a non-concessional amount.", benefit: "Shifts balance from taxable to tax-free, saving adult children up to 17% inheritance tax." },
  { n: 13, section: "Specialised Execution", title: "Mortgage Offset to Super Recycle", overview: "Using cash in offset/redraw to make tax-deductible super contributions before age 67.", benefit: "Reduces personal taxable income while building higher tax-sheltered wealth." },
  { n: 14, section: "Specialised Execution", title: "Spouse Equalisation & Pension Shielding", overview: "Transferring super contributions to a younger or lower balance spouse.", benefit: "Shields accumulation balances from Centrelink tests and doubles tax-free pension caps." },
  { n: 15, section: "Specialised Execution", title: "Downsizer Contribution Strategy", overview: "Contributing up to $300,000 per person from the sale of a home owned for 10+ years.", benefit: "Turns home equity into a tax-free super boost without impacting contribution caps." },
];

const SECTIONS = [
  "Core Planning & Income",
  "Entitlements, Debt & Legacy",
  "Specialised Execution",
];

/* ============================================================ */
/*  LAYOUT PRIMITIVES                                            */
/* ============================================================ */

const NAVY = "#0F2A44";
const TEAL = "#4FB3B3";
const GOLD = "#E8B840";

function SlideShell({ children, className = "", dark = true }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col ${className}`}
      style={{
        background: dark
          ? `linear-gradient(140deg, ${NAVY} 0%, #123252 60%, #0a1e34 100%)`
          : "linear-gradient(140deg, #f8fafb 0%, #eef4f5 100%)",
        color: dark ? "white" : NAVY,
      }}
    >
      {children}
    </div>
  );
}

function SlideKicker({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[13px] font-bold uppercase tracking-[0.32em] mb-4"
      style={{ color: TEAL }}
    >
      {children}
    </div>
  );
}

function SlideTitle({ children, dark = true }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <h1
      className="font-heading font-bold leading-[1.05] tracking-tight"
      style={{
        fontSize: "clamp(40px, 5.2vw, 84px)",
        color: dark ? "white" : NAVY,
      }}
    >
      {children}
    </h1>
  );
}

function SlidePad({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col px-[6vw] py-[5vh] overflow-hidden">{children}</div>;
}

/* ============================================================ */
/*  SLIDES                                                       */
/* ============================================================ */

function CoverSlide({ clientName }: { clientName: string }) {
  return (
    <SlideShell>
      <SlidePad>
        <div className="flex items-center gap-4">
          <img src={logoAsset.url} alt="Settled & Sound" className="h-14" />
        </div>
        <div className="flex-1 flex flex-col justify-center max-w-4xl">
          <SlideKicker>Your Retirement Presentation</SlideKicker>
          <SlideTitle>
            A clearer path to <span style={{ color: TEAL }}>your retirement</span>.
          </SlideTitle>
          <p className="mt-8 text-white/70 max-w-2xl" style={{ fontSize: "clamp(18px, 1.6vw, 26px)" }}>
            {clientName ? `Prepared for ${clientName}.` : "Prepared for you."} A guided walk-through of your
            options, our fees, and what happens next.
          </p>
          <div className="mt-12 flex items-center gap-3 text-white/50 text-sm uppercase tracking-[0.24em]">
            <span className="h-px w-16" style={{ background: TEAL }} />
            Press → to begin
          </div>
        </div>
      </SlidePad>
    </SlideShell>
  );
}

function OpportunitiesOverviewSlide() {
  const tiles = [
    { title: "Superannuation", icon: TrendingUp, color: TEAL },
    { title: "Investments", icon: Landmark, color: GOLD },
    { title: "Insurance", icon: ShieldCheck, color: TEAL },
    { title: "Retirement Planning", icon: Star, color: GOLD },
    { title: "Debt Management", icon: Building2, color: TEAL },
    { title: "Tax Optimisation", icon: Sparkles, color: GOLD },
  ];
  return (
    <SlideShell dark={false}>
      <SlidePad>
        <SlideKicker>Where advice pays off</SlideKicker>
        <SlideTitle dark={false}>
          Some other opportunities <span style={{ color: TEAL }}>for advice</span>
        </SlideTitle>
        <div className="mt-10 grid grid-cols-3 gap-6 flex-1">
          {tiles.map((t) => (
            <div
              key={t.title}
              className="rounded-2xl border p-8 flex flex-col justify-between"
              style={{ borderColor: `${NAVY}1a`, background: "white" }}
            >
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center"
                style={{ background: `${t.color}20`, color: t.color }}
              >
                <t.icon className="h-7 w-7" />
              </div>
              <div
                className="font-heading font-bold leading-tight mt-6"
                style={{ fontSize: "clamp(22px, 1.8vw, 32px)", color: NAVY }}
              >
                {t.title}
              </div>
            </div>
          ))}
        </div>
      </SlidePad>
    </SlideShell>
  );
}

function AdviceSelectionSlide({
  selected, toggle,
}: {
  selected: Set<number>;
  toggle: (n: number) => void;
}) {
  const [openInfo, setOpenInfo] = useState<number | null>(null);
  return (
    <SlideShell dark={false}>
      <div className="flex-1 flex flex-col px-[4vw] py-[3.5vh] overflow-hidden">
        <div className="flex items-end justify-between">
          <div>
            <SlideKicker>What matters to you</SlideKicker>
            <h1
              className="font-heading font-bold leading-[1.05] tracking-tight"
              style={{ fontSize: "clamp(32px, 3.4vw, 54px)", color: NAVY }}
            >
              Tap the areas you'd like <span style={{ color: TEAL }}>advice on</span>
            </h1>
          </div>
          <div
            className="rounded-full px-5 py-2 text-sm font-bold"
            style={{ background: `${TEAL}20`, color: TEAL }}
          >
            {selected.size} selected
          </div>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto pr-2 space-y-6">
          {SECTIONS.map((sec) => (
            <div key={sec}>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.24em] mb-3"
                style={{ color: TEAL }}
              >
                {sec}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {CATEGORIES.filter((c) => c.section === sec).map((c) => {
                  const isOn = selected.has(c.n);
                  const isOpen = openInfo === c.n;
                  return (
                    <div
                      key={c.n}
                      className="rounded-2xl border-2 transition-all cursor-pointer bg-white"
                      style={{
                        borderColor: isOn ? "#7c5cff" : `${NAVY}1a`,
                        boxShadow: isOn ? "0 0 0 4px rgba(124,92,255,0.15)" : "none",
                        background: isOn ? "linear-gradient(135deg, #f0ecff 0%, #eaf3ff 100%)" : "white",
                      }}
                      onClick={() => toggle(c.n)}
                    >
                      <div className="p-4 flex items-start gap-3">
                        <div
                          className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                          style={{
                            background: isOn ? "#7c5cff" : `${TEAL}20`,
                            color: isOn ? "white" : TEAL,
                          }}
                        >
                          {isOn ? <Check className="h-4 w-4" /> : c.n}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-heading font-bold leading-tight"
                            style={{ fontSize: "15px", color: NAVY }}
                          >
                            {c.title}
                          </div>
                          <button
                            className="mt-2 text-[11px] font-semibold uppercase tracking-wider hover:underline"
                            style={{ color: TEAL }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenInfo(isOpen ? null : c.n);
                            }}
                          >
                            {isOpen ? "Hide" : "Read more"}
                          </button>
                          {isOpen && (
                            <div className="mt-2 pl-2 border-l-2 space-y-1.5" style={{ borderColor: `${TEAL}80` }}>
                              <div className="text-[12px] leading-snug text-slate-600">
                                <span className="font-semibold" style={{ color: NAVY }}>Overview: </span>
                                {c.overview}
                              </div>
                              <div className="text-[12px] leading-snug text-slate-600">
                                <span className="font-semibold" style={{ color: NAVY }}>Benefit: </span>
                                {c.benefit}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function SubmitSlide({
  selected,
  onSubmit,
  submitting,
}: {
  selected: Set<number>;
  onSubmit: (name: string, email: string, phone: string) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const selectedList = CATEGORIES.filter((c) => selected.has(c.n));

  return (
    <SlideShell>
      <SlidePad>
        <SlideKicker>Almost there</SlideKicker>
        <SlideTitle>Send us your <span style={{ color: TEAL }}>selections</span></SlideTitle>
        <p className="mt-4 text-white/70 max-w-2xl text-lg">
          Add your details and we'll follow up with a plan tailored to the areas you picked.
        </p>

        <div className="mt-8 grid grid-cols-[1.1fr_1fr] gap-10 flex-1 min-h-0">
          {/* Form */}
          <div className="rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur p-8 space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Full name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="mt-2 bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Phone (optional)</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0400 000 000"
                className="mt-2 bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
              />
            </div>
            <Button
              className="w-full h-14 text-base font-bold mt-4"
              style={{ background: TEAL, color: NAVY }}
              disabled={submitting || !name.trim() || !email.trim()}
              onClick={() => onSubmit(name.trim(), email.trim(), phone.trim())}
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…</>
              ) : (
                <><Send className="w-5 h-5 mr-2" /> Submit</>
              )}
            </Button>
          </div>

          {/* Selection summary */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-6 overflow-hidden flex flex-col">
            <div className="text-xs font-bold uppercase tracking-[0.24em] mb-4" style={{ color: TEAL }}>
              Your selections ({selectedList.length})
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {selectedList.length === 0 && (
                <div className="text-white/50 text-sm">No areas selected yet — go back and tap a few.</div>
              )}
              {selectedList.map((c) => (
                <div key={c.n} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: TEAL, color: NAVY }}>
                    {c.n}
                  </div>
                  <div className="text-sm text-white/90 font-semibold">{c.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SlidePad>
    </SlideShell>
  );
}

function NextStepsSlide() {
  const steps = [
    { n: 1, title: "Book your call", body: "Lock in a time that suits — we'll confirm by email." },
    { n: 2, title: "Upload documents", body: "Secure upload link so we can review your position." },
    { n: 3, title: "Sign your ATC / TPA", body: "One digital signature and you're set. Simple." },
  ];
  return (
    <SlideShell>
      <SlidePad>
        <SlideKicker>Super easy next steps</SlideKicker>
        <SlideTitle>Three steps and <span style={{ color: TEAL }}>you're moving</span></SlideTitle>
        <div className="mt-12 grid grid-cols-3 gap-8 flex-1">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl bg-white/[0.06] border border-white/15 p-8 flex flex-col">
              <div className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: TEAL, color: NAVY }}>
                {s.n}
              </div>
              <div className="mt-6 font-heading font-bold text-3xl">{s.title}</div>
              <div className="mt-3 text-white/70 text-lg leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </SlidePad>
    </SlideShell>
  );
}

function ClarityCheckSlide() {
  const points = [
    "Fees explained in plain English",
    "Options laid out side-by-side",
    "You know exactly what happens next",
    "No pressure, ever",
  ];
  return (
    <SlideShell dark={false}>
      <SlidePad>
        <SlideKicker>Quick check</SlideKicker>
        <SlideTitle dark={false}>Was everything explained <span style={{ color: TEAL }}>to you clearly?</span></SlideTitle>
        <div className="mt-10 grid grid-cols-2 gap-6 flex-1">
          {points.map((p) => (
            <div key={p} className="rounded-2xl border bg-white p-8 flex items-center gap-5" style={{ borderColor: `${NAVY}1a` }}>
              <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0" style={{ background: TEAL }}>
                <Check className="h-7 w-7 text-white" />
              </div>
              <div className="font-heading font-bold text-2xl leading-tight" style={{ color: NAVY }}>{p}</div>
            </div>
          ))}
        </div>
      </SlidePad>
    </SlideShell>
  );
}

function FeesSlide() {
  return (
    <SlideShell dark={false}>
      <SlidePad>
        <SlideKicker>Transparent pricing</SlideKicker>
        <SlideTitle dark={false}>Fees and costs <span style={{ color: TEAL }}>for advice</span></SlideTitle>
        <div className="mt-10 grid grid-cols-2 gap-8 flex-1">
          <div className="rounded-2xl border p-8 bg-white" style={{ borderColor: `${NAVY}1a` }}>
            <div className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: TEAL }}>Implementation fee</div>
            <div className="mt-3 font-heading font-bold" style={{ fontSize: 56, color: NAVY }}>$6,500<span className="text-2xl text-slate-500"> cap</span></div>
            <div className="mt-4 text-slate-600 text-lg leading-relaxed">
              One-off fee to prepare and implement your Statement of Advice. Deducted from super where possible.
            </div>
          </div>
          <div className="rounded-2xl border p-8 bg-white" style={{ borderColor: `${NAVY}1a` }}>
            <div className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: TEAL }}>Ongoing advice</div>
            <div className="mt-3 font-heading font-bold" style={{ fontSize: 56, color: NAVY }}>1.76%<span className="text-2xl text-slate-500"> p.a.</span></div>
            <div className="mt-4 text-slate-600 text-lg leading-relaxed">
              Annual advisory fee covering reviews, rebalancing, market updates and unlimited access to your adviser.
            </div>
          </div>
        </div>
        <p className="mt-6 text-sm text-slate-500 max-w-4xl">
          Our philosophy: fees should always be clear, and the value of advice should be greater than the cost.
        </p>
      </SlidePad>
    </SlideShell>
  );
}

function OptionSlide({
  num, title, subtitle, pros, cons,
}: { num: number; title: string; subtitle: string; pros: string[]; cons: string[] }) {
  return (
    <SlideShell dark={false}>
      <SlidePad>
        <SlideKicker>Option {num}</SlideKicker>
        <SlideTitle dark={false}>{title}</SlideTitle>
        <p className="mt-3 text-slate-600 text-xl max-w-3xl">{subtitle}</p>
        <div className="mt-10 grid grid-cols-2 gap-8 flex-1">
          <div className="rounded-2xl border p-8 bg-white" style={{ borderColor: `${TEAL}40` }}>
            <div className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: TEAL }}>Benefits</div>
            <ul className="mt-4 space-y-3">
              {pros.map((p) => (
                <li key={p} className="flex items-start gap-3 text-lg" style={{ color: NAVY }}>
                  <Check className="h-5 w-5 mt-1 shrink-0" style={{ color: TEAL }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border p-8 bg-white" style={{ borderColor: `${NAVY}1a` }}>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Drawbacks</div>
            <ul className="mt-4 space-y-3">
              {cons.map((p) => (
                <li key={p} className="flex items-start gap-3 text-lg text-slate-600">
                  <X className="h-5 w-5 mt-1 shrink-0 text-slate-400" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SlidePad>
    </SlideShell>
  );
}

function WhyChooseUsSlide() {
  return (
    <SlideShell>
      <SlidePad>
        <SlideKicker>Why choose us</SlideKicker>
        <SlideTitle>Why so many people <span style={{ color: TEAL }}>choose Settled &amp; Sound</span></SlideTitle>
        <div className="mt-12 grid grid-cols-3 gap-6 flex-1">
          {[
            { icon: Users, title: "Matched to the right adviser", body: "You get an adviser who actually fits your situation, not a random assignment." },
            { icon: ShieldCheck, title: "Free Statement of Advice", body: "You only pay if you decide to move forward. No surprise fees." },
            { icon: Star, title: "5-star client ratings", body: "Real reviews from real Australians who've been where you are." },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl bg-white/[0.06] border border-white/15 p-8">
              <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: TEAL }}>
                <c.icon className="h-7 w-7" style={{ color: NAVY }} />
              </div>
              <div className="mt-5 font-heading font-bold text-2xl">{c.title}</div>
              <div className="mt-2 text-white/70 text-base leading-relaxed">{c.body}</div>
            </div>
          ))}
        </div>
      </SlidePad>
    </SlideShell>
  );
}

function ProfessionalProfileSlide() {
  return (
    <SlideShell dark={false}>
      <SlidePad>
        <SlideKicker>Meet your adviser</SlideKicker>
        <SlideTitle dark={false}>Travis Seckold</SlideTitle>
        <p className="mt-3 text-xl font-semibold" style={{ color: TEAL }}>Senior Financial Adviser · Settled &amp; Sound</p>
        <div className="mt-8 grid grid-cols-[1fr_1.4fr] gap-10 flex-1">
          <div className="rounded-2xl border bg-white p-8" style={{ borderColor: `${NAVY}1a` }}>
            <div className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: TEAL }}>Experience</div>
            <div className="mt-3 font-heading font-bold text-5xl" style={{ color: NAVY }}>15+ yrs</div>
            <div className="mt-6 text-xs font-bold uppercase tracking-[0.24em]" style={{ color: TEAL }}>Specialisation</div>
            <div className="mt-2 text-slate-700 text-lg">Retirement, super optimisation, income strategies for pre-retirees.</div>
          </div>
          <div className="rounded-2xl border bg-white p-8" style={{ borderColor: `${NAVY}1a` }}>
            <div className="text-lg leading-relaxed text-slate-700">
              Travis works with Australians who are 5-10 years out from retirement and want a calm, structured plan.
              He's known for cutting through the jargon and giving straight answers, and for making sure clients
              actually understand what's happening with their money.
            </div>
            <div className="mt-6 text-xs italic text-slate-500">
              Advice provided under an Australian Financial Services Licence. Fees and terms provided in your SOA.
            </div>
          </div>
        </div>
      </SlidePad>
    </SlideShell>
  );
}

function ContactSlide() {
  return (
    <SlideShell>
      <SlidePad>
        <SlideKicker>Let's have a chat</SlideKicker>
        <SlideTitle>Hi. <span style={{ color: TEAL }}>Let's talk it through.</span></SlideTitle>
        <p className="mt-4 text-white/70 max-w-2xl text-xl">
          No pressure, no obligation. A friendly conversation about your options and what could actually make a difference.
        </p>
        <div className="mt-12 grid grid-cols-3 gap-6 flex-1">
          <div className="rounded-2xl bg-white/[0.06] border border-white/15 p-8">
            <Phone className="h-8 w-8" style={{ color: TEAL }} />
            <div className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-white/60">Phone</div>
            <a href="tel:0485991688" className="mt-2 block font-heading font-bold text-3xl tabular-nums">0485 991 688</a>
          </div>
          <div className="rounded-2xl bg-white/[0.06] border border-white/15 p-8">
            <Mail className="h-8 w-8" style={{ color: TEAL }} />
            <div className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-white/60">Email</div>
            <a href="mailto:admin@settledandsound.com.au" className="mt-2 block font-heading font-bold text-xl break-all">admin@settledandsound.com.au</a>
          </div>
          <div className="rounded-2xl bg-white/[0.06] border border-white/15 p-8">
            <MapPin className="h-8 w-8" style={{ color: TEAL }} />
            <div className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-white/60">Office</div>
            <div className="mt-2 font-heading font-bold text-xl leading-snug">Brisbane, Queensland<br />Australia</div>
          </div>
        </div>
      </SlidePad>
    </SlideShell>
  );
}

/* ============================================================ */
/*  ROOT PRESENTER                                               */
/* ============================================================ */

interface Props {
  clientName?: string;
  onClose?: () => void;
  shareable?: boolean; // when true, hide close (used by public route)
}

export function InteractivePresentation({ clientName = "", onClose, shareable = false }: Props) {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const toggleCat = useCallback((n: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async (name: string, email: string, phone: string) => {
    if (selected.size === 0) {
      toast.error("Please select at least one advice area first");
      return;
    }
    setSubmitting(true);
    try {
      // Build a PDF client-side
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      let y = 60;
      doc.setFillColor(15, 42, 68);
      doc.rect(0, 0, W, 90, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Settled & Sound", 40, 55);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Advice Interest Submission", 40, 74);
      y = 130;
      doc.setTextColor(15, 42, 68);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Client details", 40, y); y += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Name:  ${name}`, 40, y); y += 16;
      doc.text(`Email: ${email}`, 40, y); y += 16;
      if (phone) { doc.text(`Phone: ${phone}`, 40, y); y += 16; }
      doc.text(`Date:  ${new Date().toLocaleString("en-AU")}`, 40, y); y += 28;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`Selected advice areas (${selected.size})`, 40, y); y += 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      for (const c of CATEGORIES.filter((c) => selected.has(c.n))) {
        if (y > 780) { doc.addPage(); y = 60; }
        doc.setFont("helvetica", "bold");
        doc.text(`${c.n}. ${c.title}`, 40, y); y += 14;
        doc.setFont("helvetica", "normal");
        const overviewLines = doc.splitTextToSize(`Overview: ${c.overview}`, W - 80);
        doc.text(overviewLines, 40, y); y += overviewLines.length * 13;
        const benefitLines = doc.splitTextToSize(`Benefit: ${c.benefit}`, W - 80);
        doc.text(benefitLines, 40, y); y += benefitLines.length * 13 + 8;
      }

      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const filename = `Advice-Request-${name.replace(/[^A-Za-z0-9]+/g, "_")}-${Date.now()}.pdf`;

      const { error } = await supabase.functions.invoke("submit-advice-request", {
        body: {
          name, email, phone,
          selected: Array.from(selected),
          selected_titles: CATEGORIES.filter((c) => selected.has(c.n)).map((c) => c.title),
          filename,
          pdf_base64: pdfBase64,
        },
      });
      if (error) throw error;
      toast.success("Sent! We'll be in touch shortly.");
      setSelected(new Set());
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      if (onClose) onClose();
      else navigate("/");
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [selected, navigate, onClose]);

  const slides = useMemo(() => [
    { key: "cover", render: () => <CoverSlide clientName={clientName} /> },
    { key: "opportunities", render: () => <OpportunitiesOverviewSlide /> },
    { key: "selection", render: () => <AdviceSelectionSlide selected={selected} toggle={toggleCat} /> },
    { key: "next-steps", render: () => <NextStepsSlide /> },
    { key: "clarity", render: () => <ClarityCheckSlide /> },
    { key: "fees", render: () => <FeesSlide /> },
    { key: "option1", render: () => <OptionSlide num={1} title="Industry / Retail Super Funds" subtitle="The starting point for most Australians. Low fees but limited flexibility." pros={["Low fees", "Simple to use", "Default insurance cover", "APRA regulated"]} cons={["Limited investment choice", "Generic strategy", "No personalised advice", "Locked into their model"]} /> },
    { key: "option2", render: () => <OptionSlide num={2} title="Self Managed Super Fund" subtitle="Maximum control, but comes with responsibility and ongoing compliance." pros={["Full investment control", "Direct property possible", "Tax planning flexibility", "Multi-member family fund"]} cons={["Setup and ongoing costs", "Trustee responsibility", "Compliance obligations", "Not suited to small balances"]} /> },
    { key: "option3", render: () => <OptionSlide num={3} title="Adviser Driven Platforms" subtitle="The sweet spot for most pre-retirees. Personalised strategy without SMSF admin." pros={["Personalised investment mix", "Adviser reviews and rebalancing", "Wide platform choice", "Ongoing strategy support"]} cons={["Higher than industry fees", "Requires adviser relationship", "Ongoing advice fee applies"]} /> },
    { key: "why-us", render: () => <WhyChooseUsSlide /> },
    { key: "profile", render: () => <ProfessionalProfileSlide /> },
    { key: "contact", render: () => <ContactSlide /> },
    { key: "submit", render: () => <SubmitSlide selected={selected} onSubmit={handleSubmit} submitting={submitting} /> },
  ], [clientName, selected, toggleCat, handleSubmit, submitting]);

  const total = slides.length;
  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent((c) => Math.min(total - 1, c + 1)), [total]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault(); next();
      } else if (e.key === "Escape" && !document.fullscreenElement && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose]);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // Auto full-screen on mount
  useEffect(() => {
    const t = setTimeout(() => {
      if (containerRef.current && !document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }, 150);
    return () => clearTimeout(t);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await containerRef.current.requestFullscreen();
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/present`;
    navigator.clipboard.writeText(url);
    toast.success("Public link copied");
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      {/* Slide viewport */}
      <div className="absolute inset-0">
        {slides[current].render()}
      </div>

      {/* Top control bar - hover reveal */}
      <div className="absolute top-0 left-0 right-0 z-20 opacity-0 hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between px-5 py-3 bg-black/70 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-3 text-white/80 text-sm">
            <span className="font-mono">{current + 1} / {total}</span>
            <span className="text-white/40">·</span>
            <span className="uppercase tracking-wider text-xs">{slides[current].key}</span>
          </div>
          <div className="flex items-center gap-2">
            {!shareable && (
              <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 h-8" onClick={copyShareLink}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy share link
              </Button>
            )}
            <Button size="icon" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8" onClick={toggleFullscreen} title="Fullscreen">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
            {onClose && !shareable && (
              <Button size="icon" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Arrows */}
      {current > 0 && (
        <button
          onClick={prev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition"
          aria-label="Previous"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}
      {current < total - 1 && (
        <button
          onClick={next}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition"
          aria-label="Next"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      {/* Progress dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === current ? 28 : 8,
              background: i === current ? TEAL : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
