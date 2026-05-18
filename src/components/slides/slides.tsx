import logo from "@/assets/logo.svg";
import coupleTablet from "@/assets/slides/couple-tablet.jpg";
import travis from "@/assets/slides/travis.jpg";
import handsDesk from "@/assets/slides/hands-desk.jpg";
import industryLogos from "@/assets/slides/industry-logos.png";
import activelyManagedCard from "@/assets/slides/actively-managed-card.png";
import chooseSeal from "@/assets/slides/choose-seal.png";
import googleReviews from "@/assets/slides/google-reviews.png";
import stefanoAward from "@/assets/slides/stefano-award.jpg";
import setupMeeting from "@/assets/slides/setup-meeting.jpg";
import {
  Award,
  Heart,
  ShieldCheck,
  UserCheck,
  DollarSign,
  Clock,
  CheckCircle2,
  Star,
  Check,
  X as XIcon,
  CalendarCheck,
} from "lucide-react";

/* ============================================================
   Shared design tokens / chrome
   ============================================================ */

const NAVY = "#0a2a5c";
const NAVY_DEEP = "#06173a";
const ACCENT = "#3ee0d0"; // cyan
const ACCENT_BLUE = "#1e90ff";
const TEXT_DARK = "#0f172a";

/** Logo block (used everywhere) */
function Logo({ light = false, size = "lg" }: { light?: boolean; size?: "sm" | "lg" }) {
  const w = size === "lg" ? 260 : 180;
  return (
    <img
      src={logo}
      alt="Advisor Link Online"
      style={{ width: w, height: "auto", filter: light ? "brightness(0) invert(1)" : undefined }}
    />
  );
}

/** Diagonal split chrome used on slides 1-7. White top-left, navy bottom-right. */
function DiagonalFrame({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div style={{ width: 1920, height: 1080, position: "relative", overflow: "hidden", background: "#fff" }}>
      {/* Navy diagonal */}
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="navyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0a2a5c" />
            <stop offset="100%" stopColor="#1656b8" />
          </linearGradient>
        </defs>
        <polygon points="1920,0 1920,1080 0,1080 920,0" fill="url(#navyGrad)" />
        {/* thin navy slab top-left for logo backing */}
        <polygon points="0,0 380,0 0,400" fill="#06173a" />
      </svg>

      {/* Logo */}
      <div style={{ position: "absolute", top: 70, left: 90, zIndex: 10 }}>
        <Logo />
      </div>

      {children}

      {footer && (
        <div style={{ position: "absolute", bottom: 40, left: 90, color: "#fff", fontSize: 22, lineHeight: 1.5 }}>
          {footer}
        </div>
      )}
    </div>
  );
}

/** Navy header chrome used on slides 9-14 (rounded navy bar across top). */
function HeaderFrame({ children, light = true }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        background: light ? "#f8fafc" : "#fff",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          background: "linear-gradient(180deg, #06173a 0%, #0a2a5c 100%)",
          borderBottomLeftRadius: 48,
          borderBottomRightRadius: 48,
        }}
      />
      <div style={{ position: "absolute", top: 50, left: 90, zIndex: 10 }}>
        <Logo light />
      </div>
      {children}
    </div>
  );
}

/* ============================================================
   Slide 1 — Hi 👋 So let's have a chat
   ============================================================ */
export function Slide01() {
  return (
    <DiagonalFrame
      footer={
        <>
          <div style={{ fontWeight: 700 }}>ABN 99 671 139 923</div>
          <div>admin@advisorlinkonline.com.au</div>
          <div>07 5662 5977</div>
          <div>2/21 Upton Street, Bundall QLD 4217</div>
        </>
      }
    >
      {/* Couple photo card */}
      <div
        style={{
          position: "absolute",
          left: 280,
          top: 230,
          width: 720,
          height: 820,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
        }}
      >
        <img src={coupleTablet} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {/* Chat bubble floating */}
      <div
        style={{
          position: "absolute",
          left: 760,
          top: 760,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: ACCENT_BLUE,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 20px 50px rgba(30,144,255,0.5)",
        }}
      >
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
          <path
            d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"
            fill="#fff"
          />
          <circle cx="9" cy="12" r="1.2" fill={ACCENT_BLUE} />
          <circle cx="12" cy="12" r="1.2" fill={ACCENT_BLUE} />
          <circle cx="15" cy="12" r="1.2" fill={ACCENT_BLUE} />
        </svg>
      </div>

      {/* Headline */}
      <div style={{ position: "absolute", right: 110, top: 340, color: "#fff", fontWeight: 800, letterSpacing: "-0.02em" }}>
        <div style={{ fontSize: 130, color: ACCENT, lineHeight: 1 }}>
          Hi <span style={{ fontSize: 110 }}>👋</span>
        </div>
        <div style={{ fontSize: 130, lineHeight: 1.05, marginTop: 20 }}>
          So let's have
        </div>
        <div style={{ fontSize: 130, lineHeight: 1.05 }}>
          a <span style={{ color: ACCENT }}>chat..</span>
        </div>
      </div>
    </DiagonalFrame>
  );
}

/* ============================================================
   Slide 2 — Important Disclaimer + Travis profile
   ============================================================ */
export function Slide02() {
  return (
    <DiagonalFrame>
      {/* Travis card */}
      <div
        style={{
          position: "absolute",
          left: 200,
          top: 230,
          width: 560,
          height: 760,
          borderRadius: 22,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 30px 70px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ position: "relative", width: "100%", height: 620 }}>
          <img src={travis} alt="Travis Seckold" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.75) 100%)",
            }}
          />
          <div style={{ position: "absolute", left: 28, bottom: 24, color: "#fff" }}>
            <div style={{ fontSize: 38, fontWeight: 700 }}>Travis Seckold</div>
            <div style={{ fontSize: 22, color: "#7dd3fc" }}>Senior Research Analyst</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "22px 28px", color: "#0a2a5c", fontSize: 22 }}>
          <Award color={ACCENT_BLUE} size={28} />
          <span>Over 6 years</span>
        </div>
      </div>

      {/* Disclaimer card */}
      <div
        style={{
          position: "absolute",
          right: 110,
          top: 230,
          width: 970,
          padding: "40px 48px",
          borderRadius: 22,
          background: "linear-gradient(135deg, #06173a, #1656b8)",
          color: "#fff",
          boxShadow: "0 20px 50px rgba(6,23,58,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 700, marginBottom: 20 }}>
          <ShieldCheck size={36} /> Important Disclaimer
        </div>
        <p style={{ fontSize: 22, lineHeight: 1.55, margin: 0 }}>
          Under Australian law, it is my duty of care to inform you that this call is being recorded for
          quality and training purposes. Today I won't be asking you to make any changes or giving you any
          personal or general advice. Today we will have a look at what you are currently on track for
          regarding your retirement, examine the three options available for your superannuation, and help you
          identify any improvements that you feel you would like assistance with. At the end of this call, we
          will book in a call with one of our FPA-approved advisors to go through the results and their
          recommendations with you.
        </p>
      </div>

      {/* Professional profile card */}
      <div
        style={{
          position: "absolute",
          right: 110,
          top: 720,
          width: 970,
          padding: "32px 48px",
          borderRadius: 22,
          background: "#fff",
          color: TEXT_DARK,
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 18, color: NAVY }}>Professional Profile</div>
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { icon: <Award color="#fff" size={22} />, title: "Professional Experience", text: "Over 6 years in the industry with specialised focus on superannuation reviews." },
            { icon: <Heart color="#fff" size={22} />, title: "Client-Focused Approach", text: "Combines technical expertise with genuine concern for clients' financial wellbeing and long-term security." },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: ACCENT_BLUE, display: "grid", placeItems: "center", flexShrink: 0 }}>
                {row.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 22 }}>{row.title}</div>
                <div style={{ fontSize: 20, color: "#475569", marginTop: 4 }}>{row.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DiagonalFrame>
  );
}

/* ============================================================
   Slide 3 — Why So Many People Choose Us
   ============================================================ */
export function Slide03() {
  return (
    <DiagonalFrame>
      <img src={chooseSeal} alt="" style={{ position: "absolute", right: 90, top: 230, width: 280, height: 280 }} />
      <img src={googleReviews} alt="" style={{ position: "absolute", right: 60, top: 580, width: 240, height: "auto", borderRadius: 12 }} />

      <h1
        style={{
          position: "absolute",
          left: 380,
          top: 320,
          fontSize: 80,
          color: "#fff",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
          margin: 0,
        }}
      >
        Why So Many People <span style={{ color: ACCENT }}>Choose Us</span>
        <br />
        To Help
      </h1>

      {[
        {
          title: "Our Matching Process",
          accent: "GUARANTEE!",
          body:
            "We understand how important your financial future is and how tricky it can be to find the right advisor. That's why our GUARANTEE ensures that every financial advisor on our approved list is 100% FPA-accredited, fully vetted by us, and has undergone our strict qualification process.",
          cta: "Check List",
          left: 380,
        },
        {
          title: "Our Service is 100% FREE—And",
          accent: "We Mean FREE!",
          body:
            "You might be wondering, \"How on earth can they offer their services for free?\" And we don't blame you for asking! When we link you up with one of our accredited, licensed advisors, we charge them a linking fee whether you choose to accept their advice or not.",
          cta: "Read More",
          left: 1010,
        },
      ].map((card, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 600,
            left: card.left,
            width: 560,
            height: 440,
            borderRadius: 22,
            padding: "32px 36px",
            background: "linear-gradient(160deg, #06173a 0%, #0a2a5c 100%)",
            color: "#fff",
            boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {Array.from({ length: 5 }).map((_, j) => (
              <Star key={j} size={18} fill={ACCENT} color={ACCENT} />
            ))}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{card.title}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: ACCENT, marginBottom: 14 }}>{card.accent}</div>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: "rgba(255,255,255,0.85)", margin: 0 }}>{card.body}</p>
          <div
            style={{
              position: "absolute",
              left: 36,
              bottom: 28,
              background: ACCENT,
              color: "#06173a",
              fontWeight: 700,
              padding: "10px 22px",
              borderRadius: 999,
              fontSize: 16,
            }}
          >
            {card.cta}
          </div>
        </div>
      ))}
    </DiagonalFrame>
  );
}

/* ============================================================
   Slides 4, 5, 6 — Options (shared layout)
   ============================================================ */
function OptionSlide({
  optionLabel,
  titleHighlight,
  titleRest,
  left,
  bullets,
  showShareReport = false,
}: {
  optionLabel: string;
  titleHighlight: string;
  titleRest: string;
  left: React.ReactNode;
  bullets: { type: "pro" | "con"; highlight: string; text: string }[];
  showShareReport?: boolean;
}) {
  return (
    <DiagonalFrame>
      {/* Left column content */}
      <div style={{ position: "absolute", left: 200, top: 240, width: 760, height: 780 }}>{left}</div>

      {/* Right column text */}
      <div style={{ position: "absolute", right: 110, top: 230, width: 920 }}>
        <div style={{ color: "#fff", fontSize: 52, fontWeight: 800 }}>{optionLabel}</div>
        <h2 style={{ color: ACCENT, fontSize: 70, fontWeight: 800, lineHeight: 1.05, margin: "16px 0 0", letterSpacing: "-0.02em" }}>
          {titleHighlight}
          <span style={{ color: "#fff" }}> {titleRest}</span>
        </h2>

        <ul style={{ listStyle: "none", padding: 0, margin: "36px 0 0", display: "flex", flexDirection: "column", gap: 16 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", color: "#fff", fontSize: 24, lineHeight: 1.35 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: b.type === "pro" ? "#10b981" : "#ef4444",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  marginTop: 4,
                }}
              >
                {b.type === "pro" ? <Check color="#fff" size={20} /> : <XIcon color="#fff" size={20} />}
              </div>
              <div>
                <span style={{ color: ACCENT, fontWeight: 600 }}>{b.highlight}</span>{" "}
                <span>{b.text}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showShareReport && (
        <div
          style={{
            position: "absolute",
            right: 90,
            bottom: 60,
            background: "#fff",
            color: TEXT_DARK,
            padding: "14px 36px",
            borderRadius: 10,
            fontSize: 22,
            fontWeight: 600,
            boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
          }}
        >
          Share Report
        </div>
      )}
    </DiagonalFrame>
  );
}

export function Slide04() {
  return (
    <OptionSlide
      optionLabel="Option 1:"
      titleHighlight="INDUSTRY/RETAIL"
      titleRest="SUPER FUNDS"
      left={
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 32,
            background: "#fff",
            boxShadow: "0 30px 70px rgba(0,0,0,0.2)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          <img src={industryLogos} alt="Industry funds" style={{ width: "92%", height: "92%", objectFit: "contain" }} />
        </div>
      }
      bullets={[
        { type: "pro", highlight: "Industry retail fund members can choose from a variety of investment options,", text: "including balanced, growth, conservative, High Growth funds etc" },
        { type: "pro", highlight: "Typically have lower setup and maintenance costs.", text: "" },
        { type: "pro", highlight: "Industry retail funds require less time and effort", text: "from members, allowing them to focus on other priorities" },
        { type: "con", highlight: "Typically see lower returns", text: "over the long run compared to some actively managed funds or SMSFs." },
        { type: "con", highlight: "Not as much control", text: "over the investments" },
      ]}
    />
  );
}

export function Slide05() {
  return (
    <OptionSlide
      optionLabel="Option 2:"
      titleHighlight="SELF MANAGED"
      titleRest="SUPER FUND"
      left={
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 30px 70px rgba(0,0,0,0.25)",
          }}
        >
          <img src={handsDesk} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      }
      bullets={[
        { type: "pro", highlight: "SMSF members have greater control", text: "over their investment choices." },
        { type: "pro", highlight: "They can diversify their portfolio by investing in various assets, including property,", text: "shares, and collectibles." },
        { type: "pro", highlight: "When done correctly", text: "can see higher returns than an industry/retail fund." },
        { type: "con", highlight: "Setting up and maintaining an SMSF can be expensive,", text: "and extremely time consuming." },
        { type: "con", highlight: "Running an SMSF demands considerable time", text: "and effort from the trustees." },
      ]}
    />
  );
}

export function Slide06() {
  return (
    <OptionSlide
      optionLabel="Option 3:"
      titleHighlight="ACTIVELY MANAGED"
      titleRest="SUPER FUNDS"
      showShareReport
      left={
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 32,
            background: "#fff",
            boxShadow: "0 30px 70px rgba(0,0,0,0.2)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          <img src={activelyManagedCard} alt="Actively managed platforms" style={{ width: "94%", height: "94%", objectFit: "contain" }} />
        </div>
      }
      bullets={[
        { type: "pro", highlight: "Access to a licensed Financial Advisor", text: "helps ensure you are on the right track for a healthy retirement." },
        { type: "pro", highlight: "1000's of investment options", text: "help to spread risk and potentially increase returns." },
        { type: "pro", highlight: "Actively managed funds generally target annual returns between 9% and 14%,", text: "backed by professional investment management." },
        { type: "con", highlight: "Generally have a set-up cost and sometimes higher fees", text: "due to being actively managed." },
        { type: "con", highlight: "Performance dependent on fund managers.", text: "" },
      ]}
    />
  );
}

/* ============================================================
   Slide 7 — Fees And Costs For Advice
   ============================================================ */
export function Slide07() {
  return (
    <DiagonalFrame>
      <h1 style={{ position: "absolute", left: 200, top: 290, fontSize: 56, color: NAVY, fontWeight: 700, margin: 0 }}>
        Fees And Costs For Advice
      </h1>

      {/* Fee philosophy card */}
      <div
        style={{
          position: "absolute",
          left: 200,
          top: 410,
          width: 820,
          padding: "36px 42px",
          borderRadius: 22,
          background: "linear-gradient(140deg, #06173a, #1656b8)",
          color: "#fff",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, display: "flex", alignItems: "center", gap: 12 }}>
          <DollarSign size={32} /> Fee Philosophy
        </div>
        <div style={{ fontSize: 20, opacity: 0.85, marginTop: 4 }}>Fair pricing for quality advice</div>
        <p style={{ fontSize: 20, lineHeight: 1.55, marginTop: 22 }}>
          Financial advice should be accessible, transparent, and valuable. The fee structure is designed to
          ensure you get meaningful return on your investment in advisory services.
        </p>
        {[
          { icon: <ShieldCheck size={22} />, text: "No conflicts of interest — your adviser doesn't receive commissions from product issuers" },
          { icon: <UserCheck size={22} />, text: "Annual opt-in process gives you control over ongoing services" },
        ].map((r, i) => (
          <div key={i} style={{ marginTop: 14, padding: "16px 20px", background: "rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", alignItems: "center", gap: 14, fontSize: 18 }}>
            <div style={{ color: ACCENT }}>{r.icon}</div>
            {r.text}
          </div>
        ))}
      </div>

      {/* Setup fee card */}
      <FeeCard
        top={410}
        accentColor="#f59e0b"
        accentBg="#fef3c7"
        icon={<DollarSign size={26} color="#b45309" />}
        title="One-Time Setup Fees"
        tag="From Super"
        pct="3.3% - 4.4%"
        feeTitle="Initial Advice Fee"
        feeSub="One-time setup fee based on portfolio complexity and requirements"
      />
      <FeeCard
        top={710}
        accentColor="#3b82f6"
        accentBg="#dbeafe"
        icon={<Clock size={26} color="#1d4ed8" />}
        title="Optional Ongoing Fees"
        titleExtra="(Optional)"
        tag="From Super"
        pct="1.1% - 2.2%"
        feeTitle="Annual Management Fee"
        feeSub="For ongoing portfolio management and advice"
      />

      {/* No out-of-pocket strip */}
      <div
        style={{
          position: "absolute",
          left: 200,
          bottom: 80,
          right: 110,
          padding: "28px 36px",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 12px 35px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, display: "flex", alignItems: "center", gap: 12 }}>
          <DollarSign color="#10b981" size={28} /> No Out-of-Pocket Cost
        </div>
        <p style={{ fontSize: 19, color: "#475569", margin: "10px 0 0", lineHeight: 1.5 }}>
          Our consultation service has no out-of-pocket cost to you. We are paid by the advisory firm whether
          you choose to take their advice or not. Making sure that we are truly working in your best interest.
        </p>
      </div>
    </DiagonalFrame>
  );
}

function FeeCard({
  top,
  accentColor,
  accentBg,
  icon,
  title,
  titleExtra,
  tag,
  pct,
  feeTitle,
  feeSub,
}: {
  top: number;
  accentColor: string;
  accentBg: string;
  icon: React.ReactNode;
  title: string;
  titleExtra?: string;
  tag: string;
  pct: string;
  feeTitle: string;
  feeSub: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 110,
        top,
        width: 720,
        background: "#fff",
        borderRadius: 18,
        boxShadow: "0 14px 40px rgba(0,0,0,0.15)",
        overflow: "hidden",
      }}
    >
      <div style={{ background: accentBg, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 700, color: TEXT_DARK }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fff", display: "grid", placeItems: "center" }}>
            {icon}
          </div>
          {title}
          {titleExtra && <span style={{ fontSize: 18, color: "#64748b", fontWeight: 500 }}>{titleExtra}</span>}
        </div>
        <div style={{ background: "#fff", padding: "6px 18px", borderRadius: 999, fontSize: 16, fontWeight: 600, color: TEXT_DARK }}>{tag}</div>
      </div>
      <div style={{ padding: "20px 28px", display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ background: accentBg, color: accentColor, padding: "8px 18px", borderRadius: 999, fontWeight: 700, fontSize: 18 }}>
          {pct}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEXT_DARK }}>{feeTitle}</div>
          <div style={{ fontSize: 16, color: "#64748b" }}>{feeSub}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Slide 8 — Stefano Duro IFA Award (full-bleed image)
   ============================================================ */
export function Slide08() {
  return (
    <div style={{ width: 1920, height: 1080, position: "relative", overflow: "hidden", background: "#000" }}>
      <img src={stefanoAward} alt="Stefano Duro — IFA Excellence Awards 2025" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div
        style={{
          position: "absolute",
          right: 70,
          bottom: 70,
          background: "#fff",
          padding: "16px 44px",
          borderRadius: 12,
          fontSize: 24,
          fontWeight: 600,
          color: TEXT_DARK,
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        }}
      >
        Book A Time
      </div>
    </div>
  );
}

/* ============================================================
   Slides 9-13 — Was Everything Explained To You Clearly?
   ============================================================ */
const CLIPBOARD_ITEMS = [
  "The difference between the 3 options",
  "What the next steps are with the advisor's SOA",
  "What the fees are and how they must be included in the SOA",
  "If you are able to be shown better alternatives, are you open to change?",
];

export function SlideClipboards() {
  return (
    <HeaderFrame>
      <h1
        style={{
          position: "absolute",
          top: 290,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 64,
          fontWeight: 600,
          color: TEXT_DARK,
          margin: 0,
        }}
      >
        Was <span style={{ color: ACCENT_BLUE }}>Everything Explained</span> To You Clearly?
      </h1>

      <div
        style={{
          position: "absolute",
          top: 480,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 80,
          padding: "0 140px",
        }}
      >
        {CLIPBOARD_ITEMS.map((text, i) => (
          <div key={i} style={{ width: 320, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: -38,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 5,
              }}
            >
              <BadgeCheck />
            </div>
            <div
              style={{
                background: NAVY_DEEP,
                height: 70,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              }}
            />
            <div
              style={{
                background: "#fff",
                minHeight: 340,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                padding: "40px 28px",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                fontSize: 26,
                lineHeight: 1.3,
                color: TEXT_DARK,
                boxShadow: "0 16px 40px rgba(0,0,0,0.12)",
              }}
            >
              {text}
            </div>
          </div>
        ))}
      </div>
    </HeaderFrame>
  );
}

function BadgeCheck() {
  return (
    <div
      style={{
        width: 72,
        height: 72,
        background: "#22c55e",
        clipPath:
          "polygon(50% 0%, 65% 8%, 80% 5%, 88% 18%, 100% 25%, 96% 40%, 100% 55%, 88% 65%, 85% 80%, 70% 85%, 60% 100%, 45% 92%, 30% 100%, 22% 85%, 8% 80%, 5% 65%, 0% 50%, 8% 35%, 5% 20%, 22% 15%)",
        display: "grid",
        placeItems: "center",
        boxShadow: "0 6px 16px rgba(34,197,94,0.4)",
      }}
    >
      <Check color="#fff" size={36} strokeWidth={4} />
    </div>
  );
}

/* ============================================================
   Slide 14 — Review Completed!
   ============================================================ */
export function Slide14() {
  return (
    <HeaderFrame>
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center" }}>
        <h1 style={{ fontSize: 84, fontWeight: 700, color: TEXT_DARK, margin: 0 }}>Review Completed!</h1>
        <div
          style={{
            width: 200,
            height: 200,
            margin: "70px auto 0",
            borderRadius: 36,
            background: "linear-gradient(160deg, #34d399, #10b981)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 20px 50px rgba(16,185,129,0.4)",
          }}
        >
          <Check color="#fff" size={120} strokeWidth={3} />
        </div>
        <div
          style={{
            marginTop: 80,
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: ACCENT_BLUE,
            color: "#fff",
            padding: "20px 44px",
            borderRadius: 12,
            fontSize: 32,
            fontWeight: 600,
            boxShadow: "0 14px 35px rgba(30,144,255,0.4)",
          }}
        >
          <CalendarCheck size={36} /> Book A Time for Advisor
        </div>
      </div>
    </HeaderFrame>
  );
}

/* ============================================================
   Slide 15 — Setting Up Your Adviser Meeting (full bleed)
   ============================================================ */
export function Slide15() {
  return (
    <div style={{ width: 1920, height: 1080, position: "relative", overflow: "hidden", background: "#fff" }}>
      <img src={setupMeeting} alt="Setting up your adviser meeting" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

/* ============================================================
   Slide map — 15 entries, with the "Everything Explained"
   slide repeated 9-13 to preserve the original index mapping.
   ============================================================ */
export const SLIDES: React.ComponentType[] = [
  Slide01,
  Slide02,
  Slide03,
  Slide04,
  Slide05,
  Slide06,
  Slide07,
  Slide08,
  SlideClipboards, // 9
  SlideClipboards, // 10
  SlideClipboards, // 11
  SlideClipboards, // 12
  SlideClipboards, // 13
  Slide14,
  Slide15,
];

export const TOTAL_SLIDES = SLIDES.length;
