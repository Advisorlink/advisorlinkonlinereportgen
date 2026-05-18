import logo from "@/assets/logo.svg";
import coupleTablet from "@/assets/slides/couple-tablet.jpg";
import travis from "@/assets/slides/travis.jpg";
import handsDesk from "@/assets/slides/hands-desk.jpg";
import industryLogos from "@/assets/slides/industry-logos.png";
import activelyManagedCard from "@/assets/slides/actively-managed-card.png";
import googleReviews from "@/assets/slides/google-reviews.png";
import stefanoAward from "@/assets/slides/stefano-award.jpg";
import {
  Award,
  ShieldCheck,
  UserCheck,
  Sparkles,
  Check,
  X as XIcon,
  CalendarCheck,
  ArrowUpRight,
  Quote,
  TrendingUp,
  Building2,
  Briefcase,
  Users,
  FileText,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

/* ============================================================
   DESIGN SYSTEM — premium private-wealth editorial
   ============================================================ */

const INK = "#0B1220";           // near-black headlines
const GRAPHITE = "#3a4658";      // secondary text
const MUTED = "#6b7689";         // captions
const HAIRLINE = "#E5E7EB";      // dividers
const PAPER = "#F6F4EE";         // warm off-white
const CREAM = "#EFEAE0";         // accent surface
const NAVY = "#10243F";          // brand navy
const NAVY_INK = "#08182E";
const GOLD = "#B8975A";          // accent gold
const GOLD_SOFT = "#D7BE8C";
const SAGE = "#5B7A6E";          // pro green
const RUST = "#B45A3C";          // con rust

const SERIF = '"Cormorant Garamond", "Playfair Display", Georgia, serif';
const SANS = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/* ----------------------------- Chrome ----------------------------- */

function Stage({
  bg = PAPER,
  ink = INK,
  children,
}: {
  bg?: string;
  ink?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        background: bg,
        color: ink,
        fontFamily: SANS,
      }}
    >
      {children}
    </div>
  );
}

function TopBar({ light = false, pageLabel }: { light?: boolean; pageLabel?: string }) {
  const c = light ? "rgba(255,255,255,0.92)" : INK;
  const sub = light ? "rgba(255,255,255,0.55)" : MUTED;
  const line = light ? "rgba(255,255,255,0.18)" : HAIRLINE;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 110,
        padding: "0 90px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${line}`,
      }}
    >
      <img
        src={logo}
        alt="Advisor Link Online"
        style={{ height: 44, width: "auto", filter: light ? "brightness(0) invert(1)" : undefined }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        {pageLabel && (
          <span
            style={{
              fontSize: 16,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: sub,
              fontWeight: 500,
            }}
          >
            {pageLabel}
          </span>
        )}
        <span
          style={{
            fontSize: 16,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: c,
            fontWeight: 600,
          }}
        >
          Private Superannuation Review
        </span>
      </div>
    </div>
  );
}

function BottomBar({ light = false, page, total = 15 }: { light?: boolean; page: number; total?: number }) {
  const c = light ? "rgba(255,255,255,0.7)" : MUTED;
  const line = light ? "rgba(255,255,255,0.18)" : HAIRLINE;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        padding: "0 90px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: `1px solid ${line}`,
        fontSize: 15,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: c,
      }}
    >
      <span>Advisor Link Online · Est. Australia</span>
      <span>
        {String(page).padStart(2, "0")} <span style={{ opacity: 0.4 }}>/ {total}</span>
      </span>
    </div>
  );
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        fontSize: 15,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: light ? GOLD_SOFT : GOLD,
      }}
    >
      <span style={{ width: 36, height: 1, background: light ? GOLD_SOFT : GOLD }} />
      {children}
    </div>
  );
}

function Display({
  children,
  size = 140,
  light = false,
  italic = false,
}: {
  children: React.ReactNode;
  size?: number;
  light?: boolean;
  italic?: boolean;
}) {
  return (
    <h1
      style={{
        fontFamily: SERIF,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 0.98,
        letterSpacing: "-0.02em",
        margin: 0,
        color: light ? "#fff" : INK,
        fontStyle: italic ? "italic" : "normal",
      }}
    >
      {children}
    </h1>
  );
}

/* ============================================================
   Slide 01 — Cover
   ============================================================ */
export function Slide01() {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="Cover" />

      {/* Editorial left */}
      <div style={{ position: "absolute", left: 90, top: 240, width: 1020 }}>
        <Eyebrow>A Conversation About Your Future</Eyebrow>
        <div style={{ marginTop: 50 }}>
          <Display size={170}>Hi.</Display>
          <Display size={120} italic>
            So let&rsquo;s have
          </Display>
          <Display size={120}>
            a <span style={{ color: GOLD, fontStyle: "italic" }}>chat</span>.
          </Display>
        </div>

        <p
          style={{
            marginTop: 56,
            maxWidth: 760,
            fontSize: 26,
            lineHeight: 1.55,
            color: GRAPHITE,
          }}
        >
          A clear, no-pressure look at the three paths available for your superannuation —
          and which one is most likely to take you where you want to go.
        </p>

        {/* Contact line */}
        <div
          style={{
            marginTop: 80,
            display: "flex",
            gap: 48,
            fontSize: 18,
            color: MUTED,
            letterSpacing: "0.04em",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Phone size={18} /> 07 5662 5977
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Mail size={18} /> admin@advisorlinkonline.com.au
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <MapPin size={18} /> Bundall QLD 4217
          </span>
        </div>
      </div>

      {/* Photo column */}
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 170,
          width: 680,
          height: 800,
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(8,24,46,0.18)",
        }}
      >
        <img src={coupleTablet} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {/* Gold rule corner */}
        <div
          style={{
            position: "absolute",
            top: -1,
            right: -1,
            width: 120,
            height: 120,
            borderTop: `3px solid ${GOLD}`,
            borderRight: `3px solid ${GOLD}`,
          }}
        />
      </div>

      {/* Vertical caption */}
      <div
        style={{
          position: "absolute",
          right: 50,
          top: 200,
          writingMode: "vertical-rl",
          fontSize: 14,
          letterSpacing: "0.4em",
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        Edition 01 — Your Retirement, Reconsidered
      </div>

      <BottomBar page={1} />
    </Stage>
  );
}

/* ============================================================
   Slide 02 — Disclaimer + Travis
   ============================================================ */
export function Slide02() {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="01 · Welcome" />

      {/* Left: Travis editorial portrait */}
      <div style={{ position: "absolute", left: 90, top: 170, width: 620 }}>
        <div
          style={{
            width: 620,
            height: 760,
            position: "relative",
            overflow: "hidden",
            borderRadius: 4,
            boxShadow: "0 40px 100px rgba(8,24,46,0.2)",
          }}
        >
          <img src={travis} alt="Travis Seckold" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(8,24,46,0.9) 100%)",
            }}
          />
          <div style={{ position: "absolute", left: 36, right: 36, bottom: 36, color: "#fff" }}>
            <div style={{ fontSize: 14, letterSpacing: "0.32em", textTransform: "uppercase", color: GOLD_SOFT }}>
              Your Analyst
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 54, marginTop: 8, lineHeight: 1 }}>Travis Seckold</div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.75)", marginTop: 6 }}>
              Senior Research Analyst · 6+ years
            </div>
          </div>
        </div>

        {/* Credentials strip */}
        <div
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          {[
            { icon: <Award size={18} />, label: "Experience", value: "6+ Years" },
            { icon: <ShieldCheck size={18} />, label: "Focus", value: "Super Reviews" },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                padding: "20px 22px",
                borderRadius: 4,
                borderLeft: `2px solid ${GOLD}`,
              }}
            >
              <div style={{ color: GOLD, display: "flex", alignItems: "center", gap: 10, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                {c.icon} {c.label}
              </div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 600, color: INK }}>{c.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Disclaimer */}
      <div style={{ position: "absolute", left: 800, top: 200, right: 90 }}>
        <Eyebrow>For The Record</Eyebrow>
        <div style={{ marginTop: 32 }}>
          <Display size={88}>An important</Display>
          <Display size={88} italic>
            disclaimer<span style={{ color: GOLD }}>.</span>
          </Display>
        </div>

        <div
          style={{
            marginTop: 44,
            padding: "44px 52px",
            background: "#fff",
            borderRadius: 4,
            position: "relative",
            boxShadow: "0 24px 60px rgba(8,24,46,0.08)",
          }}
        >
          <Quote
            size={56}
            style={{ position: "absolute", top: 24, left: 28, color: CREAM, transform: "scaleX(-1)" }}
          />
          <p
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 26,
              lineHeight: 1.5,
              color: INK,
              fontStyle: "italic",
              position: "relative",
            }}
          >
            Under Australian law, this call is recorded for quality and training. Today I won&rsquo;t ask you
            to make changes, and I won&rsquo;t give you personal or general advice. We&rsquo;ll review where
            you&rsquo;re currently tracking for retirement, walk through the three options for your
            superannuation, and identify any improvements you&rsquo;d like help with. At the end, we&rsquo;ll
            book a call with one of our FPA-approved advisers to share their recommendations.
          </p>
          <div style={{ marginTop: 28, height: 1, background: HAIRLINE }} />
          <div
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 14,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            <span>Recorded · Compliant · No Obligation</span>
            <span style={{ color: GOLD, fontWeight: 600 }}>FPA Approved</span>
          </div>
        </div>
      </div>

      <BottomBar page={2} />
    </Stage>
  );
}

/* ============================================================
   Slide 03 — Why Choose Us
   ============================================================ */
export function Slide03() {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="02 · The Promise" />

      <div style={{ position: "absolute", top: 200, left: 90, right: 90 }}>
        <Eyebrow>Why So Many Choose Us</Eyebrow>
        <div style={{ marginTop: 36 }}>
          <Display size={120}>
            A higher <span style={{ fontStyle: "italic", color: GOLD }}>standard</span>
          </Display>
          <Display size={120}>of care.</Display>
        </div>
      </div>

      {/* Two-card editorial layout */}
      <div
        style={{
          position: "absolute",
          top: 600,
          left: 90,
          right: 90,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 40,
        }}
      >
        {[
          {
            num: "01",
            kicker: "The Matching Guarantee",
            title: "Vetted, accredited, hand-picked.",
            body:
              "Every adviser on our approved list is 100% FPA-accredited, fully vetted, and has passed our strict qualification process — so you only meet professionals worth your time.",
          },
          {
            num: "02",
            kicker: "Genuinely Free",
            title: "No fee, no catch — really.",
            body:
              "Advisory firms pay us a linking fee when we connect you, whether you proceed with their advice or not. You pay nothing out-of-pocket for the consultation, ever.",
          },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              padding: "44px 48px",
              borderRadius: 4,
              boxShadow: "0 24px 60px rgba(8,24,46,0.08)",
              position: "relative",
              minHeight: 360,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 36,
                right: 44,
                fontFamily: SERIF,
                fontSize: 96,
                lineHeight: 1,
                color: CREAM,
                fontStyle: "italic",
              }}
            >
              {c.num}
            </div>
            <div style={{ color: GOLD, fontSize: 14, letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 600 }}>
              {c.kicker}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 1.1, color: INK, marginTop: 18, maxWidth: 560 }}>
              {c.title}
            </div>
            <div style={{ height: 1, background: HAIRLINE, margin: "24px 0" }} />
            <p style={{ margin: 0, fontSize: 19, lineHeight: 1.6, color: GRAPHITE }}>{c.body}</p>
          </div>
        ))}
      </div>

      {/* Reviews badge bottom-right */}
      <div
        style={{
          position: "absolute",
          right: 100,
          top: 230,
          display: "flex",
          alignItems: "center",
          gap: 18,
          background: "#fff",
          padding: "14px 22px",
          borderRadius: 999,
          boxShadow: "0 12px 30px rgba(8,24,46,0.08)",
        }}
      >
        <img src={googleReviews} alt="Google reviews" style={{ height: 44, width: "auto" }} />
      </div>

      <BottomBar page={3} />
    </Stage>
  );
}

/* ============================================================
   Slides 4 / 5 / 6 — Options
   ============================================================ */
function OptionSlide({
  page,
  optionNumber,
  optionTitle,
  subtitle,
  visual,
  bullets,
  showShareReport = false,
}: {
  page: number;
  optionNumber: string;
  optionTitle: string;
  subtitle: string;
  visual: React.ReactNode;
  bullets: { type: "pro" | "con"; text: string }[];
  showShareReport?: boolean;
}) {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel={`Option ${optionNumber}`} />

      {/* Visual left */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 180,
          width: 800,
          height: 780,
          borderRadius: 4,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 40px 100px rgba(8,24,46,0.15)",
        }}
      >
        {visual}
        <div
          style={{
            position: "absolute",
            top: -1,
            left: -1,
            width: 120,
            height: 120,
            borderTop: `3px solid ${GOLD}`,
            borderLeft: `3px solid ${GOLD}`,
          }}
        />
      </div>

      {/* Text right */}
      <div style={{ position: "absolute", left: 960, top: 200, right: 90 }}>
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 64,
            color: GOLD,
            lineHeight: 1,
          }}
        >
          Option {optionNumber}
        </div>
        <div style={{ marginTop: 18 }}>
          <Display size={84}>{optionTitle}</Display>
        </div>
        <p style={{ marginTop: 22, fontSize: 22, color: MUTED, maxWidth: 800, lineHeight: 1.5 }}>{subtitle}</p>

        <div style={{ height: 1, background: HAIRLINE, margin: "40px 0 32px" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: b.type === "pro" ? SAGE : RUST,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  marginTop: 6,
                }}
              >
                {b.type === "pro" ? <Check color="#fff" size={18} strokeWidth={3} /> : <XIcon color="#fff" size={18} strokeWidth={3} />}
              </div>
              <div style={{ fontSize: 22, lineHeight: 1.45, color: INK, maxWidth: 780 }}>
                <span
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: b.type === "pro" ? SAGE : RUST,
                    fontWeight: 700,
                    marginRight: 12,
                  }}
                >
                  {b.type === "pro" ? "Pro" : "Con"}
                </span>
                {b.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showShareReport && (
        <div
          style={{
            position: "absolute",
            right: 90,
            bottom: 110,
            background: NAVY,
            color: "#fff",
            padding: "18px 36px",
            borderRadius: 4,
            fontSize: 18,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 16px 40px rgba(8,24,46,0.3)",
          }}
        >
          Share Report <ArrowUpRight size={20} />
        </div>
      )}

      <BottomBar page={page} />
    </Stage>
  );
}

export function Slide04() {
  return (
    <OptionSlide
      page={4}
      optionNumber="I"
      optionTitle={<>Industry &amp; Retail<br/><span style={{ fontStyle: "italic", color: GOLD }}>Super Funds</span></>}
      subtitle="The default for most Australians — low-cost, hands-off, with limited control."
      visual={
        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", padding: 60 }}>
          <img src={industryLogos} alt="Industry funds" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      }
      bullets={[
        { type: "pro", text: "Members can choose from a variety of investment options — balanced, growth, conservative, high-growth and more." },
        { type: "pro", text: "Typically lower setup and maintenance costs." },
        { type: "pro", text: "Requires less time and effort, freeing you up to focus on other priorities." },
        { type: "con", text: "Tend to deliver lower long-term returns than some actively managed funds or SMSFs." },
        { type: "con", text: "Limited control over how your money is actually invested." },
      ]}
    />
  );
}

export function Slide05() {
  return (
    <OptionSlide
      page={5}
      optionNumber="II"
      optionTitle={<>Self Managed<br/><span style={{ fontStyle: "italic", color: GOLD }}>Super Fund</span></>}
      subtitle="Maximum control and flexibility — for those who have the time, expertise, and appetite for it."
      visual={<img src={handsDesk} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      bullets={[
        { type: "pro", text: "Trustees have greater control over investment choices." },
        { type: "pro", text: "Diversify into a wide range of assets — property, shares, collectibles." },
        { type: "pro", text: "When run well, can outperform an industry or retail fund." },
        { type: "con", text: "Setting up and maintaining an SMSF can be expensive and extremely time-consuming." },
        { type: "con", text: "Demands ongoing time, attention, and trustee responsibility." },
      ]}
    />
  );
}

export function Slide06() {
  return (
    <OptionSlide
      page={6}
      optionNumber="III"
      optionTitle={<>Actively Managed<br/><span style={{ fontStyle: "italic", color: GOLD }}>Super Funds</span></>}
      subtitle="Professional management, broad investment universe, and a licensed adviser walking alongside you."
      showShareReport
      visual={
        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", padding: 60 }}>
          <img src={activelyManagedCard} alt="Actively managed platforms" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      }
      bullets={[
        { type: "pro", text: "Access to a licensed Financial Adviser keeping you on track for a healthy retirement." },
        { type: "pro", text: "Thousands of investment options to spread risk and pursue stronger returns." },
        { type: "pro", text: "Generally target annual returns between 9% and 14%, backed by professional management." },
        { type: "con", text: "Typically a set-up cost, and sometimes higher fees, due to being actively managed." },
        { type: "con", text: "Performance depends on the skill of the fund managers." },
      ]}
    />
  );
}

/* ============================================================
   Slide 07 — Fees
   ============================================================ */
export function Slide07() {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="03 · Fees" />

      <div style={{ position: "absolute", top: 190, left: 90, right: 90 }}>
        <Eyebrow>Fees &amp; Costs For Advice</Eyebrow>
        <div style={{ marginTop: 32, display: "flex", alignItems: "baseline", gap: 32 }}>
          <Display size={110}>Fair pricing,</Display>
        </div>
        <Display size={110} italic>
          <span style={{ color: GOLD }}>transparent</span> structure.
        </Display>
      </div>

      {/* Philosophy column */}
      <div style={{ position: "absolute", top: 600, left: 90, width: 760 }}>
        <div style={{ color: GOLD, fontSize: 13, letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 700 }}>
          Our Philosophy
        </div>
        <p style={{ marginTop: 18, fontFamily: SERIF, fontSize: 28, lineHeight: 1.45, color: INK, fontStyle: "italic" }}>
          Financial advice should be accessible, transparent, and genuinely valuable. Our fee structure is designed so
          you get a meaningful return on your investment in advice.
        </p>
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { icon: <ShieldCheck size={18} />, text: "No conflicts — advisers don’t take commissions from product issuers." },
            { icon: <UserCheck size={18} />, text: "Annual opt-in keeps you in control of ongoing services." },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 19, color: GRAPHITE }}>
              <span style={{ color: GOLD }}>{r.icon}</span>
              {r.text}
            </div>
          ))}
        </div>
      </div>

      {/* Fee table right */}
      <div style={{ position: "absolute", top: 600, right: 90, width: 880 }}>
        {[
          {
            label: "One-Time Setup",
            tag: "Initial Advice Fee",
            pct: "3.3 – 4.4%",
            sub: "Paid from super, based on portfolio complexity",
          },
          {
            label: "Ongoing (Optional)",
            tag: "Annual Management",
            pct: "1.1 – 2.2%",
            sub: "For ongoing portfolio management and advice",
          },
          {
            label: "Out-of-Pocket",
            tag: "Initial Consultation",
            pct: "Nil",
            sub: "We are paid by the advisory firm — you pay nothing",
            highlight: true,
          },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr 200px",
              alignItems: "center",
              padding: "30px 0",
              borderTop: i === 0 ? `1px solid ${INK}` : `1px solid ${HAIRLINE}`,
              borderBottom: i === 2 ? `1px solid ${INK}` : "none",
            }}
          >
            <div style={{ fontSize: 13, letterSpacing: "0.28em", textTransform: "uppercase", color: row.highlight ? GOLD : MUTED, fontWeight: 700 }}>
              {row.label}
            </div>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 30, color: INK }}>{row.tag}</div>
              <div style={{ fontSize: 16, color: MUTED, marginTop: 4 }}>{row.sub}</div>
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 48,
                fontWeight: 500,
                textAlign: "right",
                color: row.highlight ? GOLD : INK,
              }}
            >
              {row.pct}
            </div>
          </div>
        ))}
      </div>

      <BottomBar page={7} />
    </Stage>
  );
}

/* ============================================================
   Slide 08 — Stefano Duro feature
   ============================================================ */
export function Slide08() {
  return (
    <Stage bg={NAVY_INK} ink="#fff">
      {/* Full-bleed image left */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1100, height: 1080 }}>
        <img src={stefanoAward} alt="Stefano Duro" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(8,24,46,0) 50%, rgba(8,24,46,0.95) 100%)",
          }}
        />
      </div>

      <TopBar light pageLabel="04 · Recognition" />

      {/* Right editorial */}
      <div style={{ position: "absolute", left: 1080, top: 240, right: 90 }}>
        <Eyebrow light>IFA Excellence Awards 2025</Eyebrow>
        <div style={{ marginTop: 36 }}>
          <Display size={100} light>
            Stefano
          </Display>
          <Display size={100} light italic>
            <span style={{ color: GOLD_SOFT }}>Duro</span>
          </Display>
        </div>
        <div style={{ marginTop: 24, fontSize: 26, color: "rgba(255,255,255,0.7)", fontStyle: "italic", fontFamily: SERIF }}>
          Official Judge — Independent Financial Adviser of the Year, 2025
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.18)", margin: "44px 0" }} />

        <p style={{ fontSize: 22, lineHeight: 1.6, color: "rgba(255,255,255,0.82)", maxWidth: 700 }}>
          Recognised by the industry’s peak body as a leading voice in independent financial advice — and a
          trusted set of eyes on the practices we recommend to our clients.
        </p>

        <div
          style={{
            marginTop: 56,
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            background: GOLD,
            color: NAVY_INK,
            padding: "20px 36px",
            borderRadius: 4,
            fontSize: 18,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          <CalendarCheck size={20} /> Book A Time
        </div>
      </div>

      <BottomBar light page={8} />
    </Stage>
  );
}

/* ============================================================
   Slides 9–13 — Was Everything Explained Clearly?
   ============================================================ */
const CLARITY = [
  { n: "I",   t: "The difference between the three options" },
  { n: "II",  t: "What the next steps are with the adviser’s SOA" },
  { n: "III", t: "What the fees are and how they appear in the SOA" },
  { n: "IV",  t: "If we can show better alternatives — are you open to change?" },
];

export function SlideClipboards() {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="05 · Confirmation" />

      <div style={{ position: "absolute", top: 200, left: 90, right: 90 }}>
        <Eyebrow>A Quick Check-In</Eyebrow>
        <div style={{ marginTop: 32 }}>
          <Display size={108}>Was everything</Display>
          <Display size={108} italic>
            explained <span style={{ color: GOLD }}>clearly?</span>
          </Display>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 640,
          left: 90,
          right: 90,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 28,
        }}
      >
        {CLARITY.map((c, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              borderRadius: 4,
              padding: "40px 32px 44px",
              minHeight: 280,
              boxShadow: "0 24px 60px rgba(8,24,46,0.08)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: 56,
                color: GOLD,
                lineHeight: 1,
              }}
            >
              {c.n}
            </div>
            <div style={{ fontSize: 22, lineHeight: 1.4, color: INK, marginTop: 28 }}>{c.t}</div>
            <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 10, color: SAGE, fontSize: 13, letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 700 }}>
              <Check size={16} strokeWidth={3} /> Confirmed
            </div>
          </div>
        ))}
      </div>

      <BottomBar page={9} />
    </Stage>
  );
}

/* ============================================================
   Slide 14 — Review Completed
   ============================================================ */
export function Slide14() {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="06 · Next Step" />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 200px",
        }}
      >
        <Eyebrow>Review Completed</Eyebrow>
        <div style={{ marginTop: 36 }}>
          <Display size={150}>
            Let&rsquo;s book
          </Display>
          <Display size={150} italic>
            your <span style={{ color: GOLD }}>adviser</span>.
          </Display>
        </div>

        <p style={{ marginTop: 44, fontSize: 26, color: GRAPHITE, maxWidth: 880, lineHeight: 1.5 }}>
          A licensed adviser will walk you through the recommendations, answer every question, and put
          together a written Statement of Advice tailored to you.
        </p>

        <div
          style={{
            marginTop: 60,
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            background: NAVY,
            color: "#fff",
            padding: "22px 44px",
            borderRadius: 4,
            fontSize: 18,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
            boxShadow: "0 20px 50px rgba(8,24,46,0.25)",
          }}
        >
          <CalendarCheck size={22} /> Book A Time For Advice
        </div>
      </div>

      <BottomBar page={14} />
    </Stage>
  );
}

/* ============================================================
   Slide 15 — Setting Up Your Adviser Meeting (document checklist)
   ============================================================ */
export function Slide15() {
  const items = [
    { icon: <FileText size={22} />, t: "Most recent superannuation statement" },
    { icon: <TrendingUp size={22} />, t: "Current investment balance screenshot" },
    { icon: <Briefcase size={22} />, t: "Employment & income summary" },
    { icon: <Users size={22} />, t: "Spouse / partner details (if applicable)" },
    { icon: <Building2 size={22} />, t: "Any existing insurance documentation" },
    { icon: <Sparkles size={22} />, t: "Goals & questions for your adviser" },
  ];
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="07 · Preparation" />

      <div style={{ position: "absolute", top: 200, left: 90, width: 820 }}>
        <Eyebrow>Setting Up Your Meeting</Eyebrow>
        <div style={{ marginTop: 32 }}>
          <Display size={96}>What to</Display>
          <Display size={96} italic>
            bring <span style={{ color: GOLD }}>along.</span>
          </Display>
        </div>
        <p style={{ marginTop: 32, fontSize: 22, color: GRAPHITE, lineHeight: 1.55, maxWidth: 700 }}>
          A short checklist to make your adviser meeting as productive as possible. Don&rsquo;t worry if you&rsquo;re
          missing something — we&rsquo;ll help you track it down.
        </p>

        <div
          style={{
            marginTop: 48,
            padding: "28px 36px",
            background: "#fff",
            borderLeft: `3px solid ${GOLD}`,
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 13, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>
            Reminder
          </div>
          <div style={{ marginTop: 10, fontFamily: SERIF, fontSize: 26, color: INK, fontStyle: "italic", lineHeight: 1.4 }}>
            Everything you share is confidential, secure, and used only to prepare your Statement of Advice.
          </div>
        </div>
      </div>

      {/* Checklist right */}
      <div
        style={{
          position: "absolute",
          top: 200,
          right: 90,
          width: 880,
          background: "#fff",
          borderRadius: 4,
          padding: "20px 0",
          boxShadow: "0 30px 80px rgba(8,24,46,0.1)",
        }}
      >
        <div style={{ padding: "20px 44px 24px", borderBottom: `1px solid ${HAIRLINE}` }}>
          <div style={{ fontSize: 13, letterSpacing: "0.3em", textTransform: "uppercase", color: MUTED, fontWeight: 600 }}>
            Pre-Meeting Checklist
          </div>
          <div style={{ marginTop: 8, fontFamily: SERIF, fontSize: 36, color: INK }}>
            Six things, ten minutes.
          </div>
        </div>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "22px 44px",
              borderBottom: i < items.length - 1 ? `1px solid ${HAIRLINE}` : "none",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: `1.5px solid ${INK}`,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Check size={18} color={INK} strokeWidth={3} />
            </div>
            <div style={{ color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", width: 44 }}>
              {it.icon}
            </div>
            <div style={{ fontSize: 22, color: INK, lineHeight: 1.3 }}>{it.t}</div>
            <div style={{ marginLeft: "auto", fontFamily: SERIF, fontStyle: "italic", color: MUTED, fontSize: 22 }}>
              {String(i + 1).padStart(2, "0")}
            </div>
          </div>
        ))}
      </div>

      <BottomBar page={15} />
    </Stage>
  );
}

/* ============================================================
   Map — preserve 15-slide indexing (9–13 share clipboard slide)
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
