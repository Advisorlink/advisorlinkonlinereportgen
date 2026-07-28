import logo from "@/assets/logo.svg";
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
  Star,
  LineChart,
  PieChart,
  Layers,
  Trophy,
} from "lucide-react";

/* ============================================================
   DESIGN SYSTEM - premium private-wealth editorial (image-free)
   ============================================================ */

const INK = "#0B1220";
const GRAPHITE = "#3a4658";
const MUTED = "#6b7689";
const HAIRLINE = "#E5E7EB";
const PAPER = "#F6F4EE";
const CREAM = "#EFEAE0";
const NAVY = "#10243F";
const NAVY_INK = "#08182E";
const GOLD = "#B8975A";
const GOLD_SOFT = "#D7BE8C";
const SAGE = "#5B7A6E";
const RUST = "#B45A3C";

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
        alt="Settled & Sound"
        style={{ height: 44, width: "auto", filter: light ? "brightness(0) invert(1)" : undefined }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        {pageLabel && (
          <span style={{ fontSize: 16, letterSpacing: "0.22em", textTransform: "uppercase", color: sub, fontWeight: 500 }}>
            {pageLabel}
          </span>
        )}
        <span style={{ fontSize: 16, letterSpacing: "0.22em", textTransform: "uppercase", color: c, fontWeight: 600 }}>
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
      <span>Settled & Sound · Est. Australia</span>
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
   Decorative SVG art (no external images)
   ============================================================ */

function GoldFrameCorner({
  position,
}: {
  position: "tl" | "tr" | "bl" | "br";
}) {
  const styles: React.CSSProperties = {
    position: "absolute",
    width: 120,
    height: 120,
  };
  if (position === "tl") Object.assign(styles, { top: -1, left: -1, borderTop: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` });
  if (position === "tr") Object.assign(styles, { top: -1, right: -1, borderTop: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` });
  if (position === "bl") Object.assign(styles, { bottom: -1, left: -1, borderBottom: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` });
  if (position === "br") Object.assign(styles, { bottom: -1, right: -1, borderBottom: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` });
  return <div style={styles} />;
}

/** Abstract editorial composition - concentric arcs + geometric shape (cover art) */
function CoverArt() {
  return (
    <svg viewBox="0 0 680 800" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cv1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={NAVY_INK} />
          <stop offset="100%" stopColor={NAVY} />
        </linearGradient>
        <linearGradient id="cv2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD_SOFT} stopOpacity="0.95" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect width="680" height="800" fill="url(#cv1)" />
      {/* concentric arcs */}
      {Array.from({ length: 18 }).map((_, i) => (
        <circle
          key={i}
          cx="120"
          cy="800"
          r={120 + i * 70}
          fill="none"
          stroke="rgba(215,190,140,0.18)"
          strokeWidth="1"
        />
      ))}
      {/* gold disc */}
      <circle cx="470" cy="280" r="170" fill="url(#cv2)" opacity="0.95" />
      <circle cx="470" cy="280" r="170" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      {/* hairline grid */}
      <g stroke="rgba(255,255,255,0.06)">
        <line x1="0" y1="200" x2="680" y2="200" />
        <line x1="0" y1="500" x2="680" y2="500" />
        <line x1="340" y1="0" x2="340" y2="800" />
      </g>
      {/* serif monogram */}
      <text
        x="340"
        y="640"
        textAnchor="middle"
        fontFamily={SERIF}
        fontSize="200"
        fill="rgba(255,255,255,0.06)"
        fontStyle="italic"
      >
        ALO
      </text>
      {/* small caption */}
      <text x="40" y="60" fontFamily={SANS} fontSize="12" letterSpacing="6" fill="rgba(255,255,255,0.55)">
        AN INTRODUCTION
      </text>
      <text x="40" y="780" fontFamily={SERIF} fontSize="22" fill="rgba(255,255,255,0.75)" fontStyle="italic">
        Edition 01
      </text>
    </svg>
  );
}

/** Stylised analyst portrait - abstract bust illustration */
function AnalystPortrait({ name = "Travis Seckold" }: { name?: string }) {
  return (
    <svg viewBox="0 0 620 760" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="ap-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2f4d" />
          <stop offset="100%" stopColor={NAVY_INK} />
        </linearGradient>
        <linearGradient id="ap-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD_SOFT} />
          <stop offset="100%" stopColor={GOLD} />
        </linearGradient>
        <linearGradient id="ap-suit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1a2e" />
          <stop offset="100%" stopColor="#06101e" />
        </linearGradient>
      </defs>

      <rect width="620" height="760" fill="url(#ap-bg)" />
      {/* halo arcs */}
      {Array.from({ length: 10 }).map((_, i) => (
        <circle key={i} cx="310" cy="280" r={200 + i * 30} fill="none" stroke="rgba(215,190,140,0.07)" />
      ))}
      {/* gold disc behind head */}
      <circle cx="310" cy="280" r="170" fill="url(#ap-skin)" opacity="0.25" />
      {/* shoulders / suit */}
      <path d="M60 760 C 120 540, 220 470, 310 470 C 400 470, 500 540, 560 760 Z" fill="url(#ap-suit)" />
      {/* lapels */}
      <path d="M260 480 L 310 600 L 240 720 Z" fill="rgba(255,255,255,0.04)" />
      <path d="M360 480 L 310 600 L 380 720 Z" fill="rgba(255,255,255,0.04)" />
      {/* shirt triangle */}
      <path d="M295 480 L 310 560 L 325 480 Z" fill="#f2efe7" />
      {/* tie */}
      <path d="M302 480 L 318 480 L 322 580 L 310 620 L 298 580 Z" fill={GOLD} />
      {/* head silhouette */}
      <ellipse cx="310" cy="290" rx="110" ry="135" fill="#2a3a52" />
      {/* hair */}
      <path d="M200 270 C 210 170, 410 170, 420 270 C 420 220, 380 180, 310 180 C 240 180, 200 220, 200 270 Z" fill="#0a1626" />
      {/* face accent line */}
      <path d="M250 320 Q 310 360 370 320" stroke="rgba(0,0,0,0.25)" strokeWidth="2" fill="none" />
      {/* shadow under chin */}
      <ellipse cx="310" cy="430" rx="80" ry="20" fill="rgba(0,0,0,0.35)" />

      {/* gradient overlay bottom for caption */}
      <rect x="0" y="540" width="620" height="220" fill="url(#ap-grad)" />
      <defs>
        <linearGradient id="ap-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(8,24,46,0)" />
          <stop offset="100%" stopColor="rgba(8,24,46,0.95)" />
        </linearGradient>
      </defs>

      <text x="36" y="660" fontFamily={SANS} fontSize="14" letterSpacing="5" fill={GOLD_SOFT}>
        YOUR ANALYST
      </text>
      <text x="36" y="715" fontFamily={SERIF} fontSize="54" fill="#fff">
        {name}
      </text>
      <text x="36" y="744" fontFamily={SANS} fontSize="18" fill="rgba(255,255,255,0.7)">
        Senior Research Analyst · 6+ years
      </text>
    </svg>
  );
}

/** Editorial diagram of Australian super landscape (replaces logo collage) */
function IndustryLandscape() {
  const nodes = [
    { x: 200, y: 200, r: 60, label: "Industry" },
    { x: 400, y: 140, r: 50, label: "Retail" },
    { x: 580, y: 230, r: 55, label: "Profit-For-Member" },
    { x: 280, y: 400, r: 70, label: "Default MySuper" },
    { x: 520, y: 430, r: 48, label: "Public Sector" },
    { x: 400, y: 600, r: 90, label: "You" },
  ];
  return (
    <svg viewBox="0 0 760 740" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="760" height="740" fill={CREAM} />
      {/* grid */}
      <g stroke="rgba(11,18,32,0.05)">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 100} x2="760" y2={i * 100} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="740" />
        ))}
      </g>
      {/* connecting lines to "you" */}
      {nodes.slice(0, 5).map((n, i) => (
        <line
          key={i}
          x1={n.x}
          y1={n.y}
          x2={400}
          y2={600}
          stroke={GOLD}
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity="0.55"
        />
      ))}
      {nodes.map((n, i) => {
        const isYou = n.label === "You";
        return (
          <g key={i}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={isYou ? NAVY : "#fff"}
              stroke={isYou ? GOLD : INK}
              strokeWidth={isYou ? 2 : 1}
            />
            <text
              x={n.x}
              y={n.y + 5}
              textAnchor="middle"
              fontFamily={SERIF}
              fontSize={isYou ? 26 : 16}
              fontStyle="italic"
              fill={isYou ? "#fff" : INK}
            >
              {n.label}
            </text>
          </g>
        );
      })}
      <text x="40" y="44" fontFamily={SANS} fontSize="12" letterSpacing="5" fill={MUTED}>
        FIG. 01 - THE LANDSCAPE
      </text>
      <text x="40" y="710" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={GRAPHITE}>
        Industry &amp; Retail super funds
      </text>
    </svg>
  );
}

/** SMSF - abstract pillar / control diagram */
function SMSFDiagram() {
  return (
    <svg viewBox="0 0 760 740" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="760" height="740" fill="#f0ebe0" />
      {/* sun */}
      <circle cx="380" cy="260" r="120" fill="none" stroke={GOLD} strokeWidth="1" />
      <circle cx="380" cy="260" r="80" fill={GOLD} opacity="0.18" />
      <circle cx="380" cy="260" r="40" fill={GOLD} />
      {/* columns / pillars */}
      {[120, 240, 360, 480, 600].map((x, i) => (
        <g key={i}>
          <rect x={x - 30} y={430} width={60} height={220} fill={NAVY} />
          <rect x={x - 40} y={420} width={80} height={14} fill={NAVY_INK} />
          <rect x={x - 40} y={650} width={80} height={14} fill={NAVY_INK} />
          <text
            x={x}
            y={690}
            textAnchor="middle"
            fontFamily={SANS}
            fontSize="11"
            letterSpacing="3"
            fill={INK}
          >
            {["PROPERTY", "SHARES", "CASH", "BONDS", "ALT"][i]}
          </text>
        </g>
      ))}
      {/* trustee label */}
      <text x="380" y="100" textAnchor="middle" fontFamily={SANS} fontSize="12" letterSpacing="5" fill={MUTED}>
        FIG. 02 - THE TRUSTEE
      </text>
      <text x="380" y="160" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="28" fill={INK}>
        You hold the keys.
      </text>
      {/* hairlines */}
      <line x1="80" y1="420" x2="680" y2="420" stroke={INK} strokeWidth="1" />
      <line x1="80" y1="664" x2="680" y2="664" stroke={INK} strokeWidth="1" />
    </svg>
  );
}

/** Actively managed - performance arc + portfolio rings */
function ManagedDiagram() {
  return (
    <svg viewBox="0 0 760 740" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="760" height="740" fill="#fff" />
      <text x="40" y="44" fontFamily={SANS} fontSize="12" letterSpacing="5" fill={MUTED}>
        FIG. 03 - THE PORTFOLIO
      </text>
      {/* growth curve */}
      <g transform="translate(60,540)">
        <line x1="0" y1="0" x2="640" y2="0" stroke={INK} />
        <line x1="0" y1="0" x2="0" y2="-340" stroke={INK} />
        {/* gridlines */}
        {[80, 160, 240, 320].map((y, i) => (
          <line key={i} x1="0" y1={-y} x2="640" y2={-y} stroke={HAIRLINE} />
        ))}
        {/* baseline */}
        <path d="M0 -40 C 160 -60, 320 -90, 640 -140" fill="none" stroke={MUTED} strokeWidth="2" strokeDasharray="4 6" />
        {/* managed line */}
        <path d="M0 -40 C 160 -120, 320 -200, 640 -300" fill="none" stroke={GOLD} strokeWidth="4" />
        {/* fill */}
        <path d="M0 -40 C 160 -120, 320 -200, 640 -300 L 640 0 L 0 0 Z" fill={GOLD} opacity="0.1" />
        {/* end dot */}
        <circle cx="640" cy="-300" r="8" fill={GOLD} />
        <text x="640" y="-320" textAnchor="end" fontFamily={SERIF} fontStyle="italic" fontSize="22" fill={INK}>
          9–14% target
        </text>
        <text x="640" y="-130" textAnchor="end" fontFamily={SANS} fontSize="13" fill={MUTED} letterSpacing="2">
          DEFAULT FUND
        </text>
      </g>
      {/* allocation rings top right */}
      <g transform="translate(560,180)">
        <circle r="90" fill="none" stroke={HAIRLINE} strokeWidth="22" />
        <circle r="90" fill="none" stroke={NAVY} strokeWidth="22" strokeDasharray="180 565" transform="rotate(-90)" />
        <circle r="90" fill="none" stroke={GOLD} strokeWidth="22" strokeDasharray="120 565" strokeDashoffset="-180" transform="rotate(-90)" />
        <circle r="90" fill="none" stroke={SAGE} strokeWidth="22" strokeDasharray="90 565" strokeDashoffset="-300" transform="rotate(-90)" />
        <text textAnchor="middle" dy="6" fontFamily={SERIF} fontStyle="italic" fontSize="22" fill={INK}>
          Allocation
        </text>
      </g>
      {/* labels */}
      <text x="80" y="120" fontFamily={SERIF} fontStyle="italic" fontSize="32" fill={INK}>
        Active management,
      </text>
      <text x="80" y="158" fontFamily={SERIF} fontStyle="italic" fontSize="32" fill={GOLD}>
        compounded returns.
      </text>
    </svg>
  );
}

/** Award medal SVG (replaces Stefano photo background) */
function MedalArt() {
  return (
    <svg viewBox="0 0 1100 1080" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="md-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a1a30" />
          <stop offset="100%" stopColor={NAVY_INK} />
        </linearGradient>
        <radialGradient id="md-gold" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#f0d78c" />
          <stop offset="60%" stopColor={GOLD} />
          <stop offset="100%" stopColor="#8a6a3a" />
        </radialGradient>
      </defs>
      <rect width="1100" height="1080" fill="url(#md-bg)" />
      {/* radiating lines */}
      <g transform="translate(550,520)" stroke="rgba(215,190,140,0.12)">
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const x = Math.cos(a) * 700;
          const y = Math.sin(a) * 700;
          return <line key={i} x1="0" y1="0" x2={x} y2={y} />;
        })}
      </g>
      {/* halo rings */}
      {[260, 320, 400, 500].map((r, i) => (
        <circle key={i} cx="550" cy="520" r={r} fill="none" stroke="rgba(215,190,140,0.18)" />
      ))}
      {/* ribbon */}
      <path d="M460 200 L 550 460 L 640 200 Z" fill="#7a1f2b" />
      <path d="M510 200 L 550 320 L 590 200 Z" fill="#5a1620" />
      {/* medal */}
      <circle cx="550" cy="540" r="190" fill="url(#md-gold)" />
      <circle cx="550" cy="540" r="160" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="3" />
      <circle cx="550" cy="540" r="140" fill="none" stroke="rgba(255,255,255,0.35)" />
      {/* star */}
      <g transform="translate(550,540)" fill="#fff" opacity="0.95">
        <polygon points="0,-70 18,-22 70,-22 28,8 44,60 0,30 -44,60 -28,8 -70,-22 -18,-22" />
      </g>
      <text x="550" y="780" textAnchor="middle" fontFamily={SANS} fontSize="14" letterSpacing="7" fill={GOLD_SOFT}>
        IFA EXCELLENCE · 2025
      </text>
      <text x="550" y="830" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="38" fill="#fff">
        Independent Adviser of the Year
      </text>
    </svg>
  );
}

/** Inline reviews block (replaces google reviews png) */
function ReviewsBadge() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 16,
        background: "#fff",
        padding: "14px 22px",
        borderRadius: 999,
        boxShadow: "0 12px 30px rgba(8,24,46,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={20} fill={GOLD} color={GOLD} strokeWidth={0} />
        ))}
      </div>
      <div style={{ width: 1, height: 28, background: HAIRLINE }} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontFamily: SERIF, fontSize: 22, color: INK, fontWeight: 600 }}>4.9 / 5.0</span>
        <span style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: MUTED }}>
          Verified Client Reviews
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   Slide 01 - Cover
   ============================================================ */
export function Slide01() {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="Cover" />

      <div style={{ position: "absolute", left: 90, top: 240, width: 1020 }}>
        <Eyebrow>A Conversation About Your Future</Eyebrow>
        <div style={{ marginTop: 50 }}>
          <Display size={170}>Hi.</Display>
          <Display size={120} italic>So let&rsquo;s have</Display>
          <Display size={120}>
            a <span style={{ color: GOLD, fontStyle: "italic" }}>chat</span>.
          </Display>
        </div>

        <p style={{ marginTop: 56, maxWidth: 760, fontSize: 26, lineHeight: 1.55, color: GRAPHITE }}>
          A clear, no-pressure look at the three paths available for your superannuation -
          and which one is most likely to take you where you want to go.
        </p>

        <div style={{ marginTop: 80, display: "flex", gap: 48, fontSize: 18, color: MUTED, letterSpacing: "0.04em" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Phone size={18} /> 07 5662 5977
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Mail size={18} /> admin@settledandsound.com.au
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <MapPin size={18} /> Bundall QLD 4217
          </span>
        </div>
      </div>

      {/* Editorial art column */}
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
        <CoverArt />
        <GoldFrameCorner position="tr" />
      </div>

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
        Edition 01 - Your Retirement, Reconsidered
      </div>

      <BottomBar page={1} />
    </Stage>
  );
}

/* ============================================================
   Slide 02 - Disclaimer + Analyst
   ============================================================ */
export function Slide02() {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="01 · Welcome" />

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
          <AnalystPortrait name="Travis Seckold" />
        </div>

        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { icon: <Award size={18} />, label: "Experience", value: "6+ Years" },
            { icon: <ShieldCheck size={18} />, label: "Focus", value: "Super Reviews" },
          ].map((c, i) => (
            <div key={i} style={{ background: "#fff", padding: "20px 22px", borderRadius: 4, borderLeft: `2px solid ${GOLD}` }}>
              <div style={{ color: GOLD, display: "flex", alignItems: "center", gap: 10, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                {c.icon} {c.label}
              </div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 600, color: INK }}>{c.value}</div>
            </div>
          ))}
        </div>
      </div>

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
          <Quote size={56} style={{ position: "absolute", top: 24, left: 28, color: CREAM, transform: "scaleX(-1)" }} />
          <p style={{ margin: 0, fontFamily: SERIF, fontSize: 26, lineHeight: 1.5, color: INK, fontStyle: "italic", position: "relative" }}>
            Under Australian law, this call is recorded for quality and training. Today I won&rsquo;t ask you
            to make changes, and I won&rsquo;t give you personal or general advice. We&rsquo;ll review where
            you&rsquo;re currently tracking for retirement, walk through the three options for your
            superannuation, and identify any improvements you&rsquo;d like help with. At the end, we&rsquo;ll
            book a call with one of our FPA-approved advisers to share their recommendations.
          </p>
          <div style={{ marginTop: 28, height: 1, background: HAIRLINE }} />
          <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED }}>
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
   Slide 03 - Why Choose Us
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
              "Every adviser on our approved list is 100% FPA-accredited, fully vetted, and has passed our strict qualification process - so you only meet professionals worth your time.",
          },
          {
            num: "02",
            kicker: "Genuinely Free",
            title: "No fee, no catch - really.",
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
            <div style={{ position: "absolute", top: 36, right: 44, fontFamily: SERIF, fontSize: 96, lineHeight: 1, color: CREAM, fontStyle: "italic" }}>
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

      <div style={{ position: "absolute", right: 100, top: 230 }}>
        <ReviewsBadge />
      </div>

      <BottomBar page={3} />
    </Stage>
  );
}

/* ============================================================
   Slides 4 / 5 / 6 - Options
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
  optionTitle: React.ReactNode;
  subtitle: string;
  visual: React.ReactNode;
  bullets: { type: "pro" | "con"; text: string }[];
  showShareReport?: boolean;
}) {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel={`Option ${optionNumber}`} />

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
        <GoldFrameCorner position="tl" />
      </div>

      <div style={{ position: "absolute", left: 960, top: 200, right: 90 }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 64, color: GOLD, lineHeight: 1 }}>
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
      subtitle="The default for most Australians - low-cost, hands-off, with limited control."
      visual={<IndustryLandscape />}
      bullets={[
        { type: "pro", text: "Members can choose from a variety of investment options - balanced, growth, conservative, high-growth and more." },
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
      subtitle="Maximum control and flexibility - for those who have the time, expertise, and appetite for it."
      visual={<SMSFDiagram />}
      bullets={[
        { type: "pro", text: "Trustees have greater control over investment choices." },
        { type: "pro", text: "Diversify into a wide range of assets - property, shares, collectibles." },
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
      visual={<ManagedDiagram />}
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
   Slide 07 - Fees
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
            { icon: <ShieldCheck size={18} />, text: "No conflicts - advisers don’t take commissions from product issuers." },
            { icon: <UserCheck size={18} />, text: "Annual opt-in keeps you in control of ongoing services." },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 19, color: GRAPHITE }}>
              <span style={{ color: GOLD }}>{r.icon}</span>
              {r.text}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", top: 600, right: 90, width: 880 }}>
        {[
          { label: "One-Time Setup", tag: "Initial Advice Fee", pct: "3.3 – 4.4%", sub: "Paid from super, based on portfolio complexity" },
          { label: "Ongoing (Optional)", tag: "Annual Management", pct: "1.1 – 2.2%", sub: "For ongoing portfolio management and advice" },
          { label: "Out-of-Pocket", tag: "Initial Consultation", pct: "Nil", sub: "We are paid by the advisory firm - you pay nothing", highlight: true },
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
            <div style={{ fontFamily: SERIF, fontSize: 48, fontWeight: 500, textAlign: "right", color: row.highlight ? GOLD : INK }}>
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
   Slide 08 - Recognition (medal art, no photo)
   ============================================================ */
export function Slide08() {
  return (
    <Stage bg={NAVY_INK} ink="#fff">
      <div style={{ position: "absolute", left: 0, top: 0, width: 1100, height: 1080 }}>
        <MedalArt />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(8,24,46,0) 55%, rgba(8,24,46,0.95) 100%)",
          }}
        />
      </div>

      <TopBar light pageLabel="04 · Recognition" />

      <div style={{ position: "absolute", left: 1080, top: 240, right: 90 }}>
        <Eyebrow light>IFA Excellence Awards 2025</Eyebrow>
        <div style={{ marginTop: 36 }}>
          <Display size={100} light>Stefano</Display>
          <Display size={100} light italic>
            <span style={{ color: GOLD_SOFT }}>Duro</span>
          </Display>
        </div>
        <div style={{ marginTop: 24, fontSize: 26, color: "rgba(255,255,255,0.7)", fontStyle: "italic", fontFamily: SERIF }}>
          Official Judge - Independent Financial Adviser of the Year, 2025
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.18)", margin: "44px 0" }} />

        <p style={{ fontSize: 22, lineHeight: 1.6, color: "rgba(255,255,255,0.82)", maxWidth: 700 }}>
          Recognised by the industry’s peak body as a leading voice in independent financial advice - and a
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
          <Trophy size={20} /> Trusted Judging Panel
        </div>
      </div>

      <BottomBar light page={8} />
    </Stage>
  );
}

/* ============================================================
   Slides 9–13 - Clarity Check
   ============================================================ */
const CLARITY = [
  { n: "I",   t: "The difference between the three options" },
  { n: "II",  t: "What the next steps are with the adviser’s SOA" },
  { n: "III", t: "What the fees are and how they appear in the SOA" },
  { n: "IV",  t: "If we can show better alternatives - are you open to change?" },
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
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 56, color: GOLD, lineHeight: 1 }}>
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
   Slide 14 - Review Completed
   ============================================================ */
export function Slide14() {
  return (
    <Stage bg={PAPER}>
      <TopBar pageLabel="06 · Next Step" />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 200px" }}>
        <Eyebrow>Review Completed</Eyebrow>
        <div style={{ marginTop: 36 }}>
          <Display size={150}>Let&rsquo;s book</Display>
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
   Slide 15 - Pre-meeting checklist
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
          missing something - we&rsquo;ll help you track it down.
        </p>

        <div style={{ marginTop: 48, padding: "28px 36px", background: "#fff", borderLeft: `3px solid ${GOLD}`, borderRadius: 4 }}>
          <div style={{ fontSize: 13, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>
            Reminder
          </div>
          <div style={{ marginTop: 10, fontFamily: SERIF, fontSize: 26, color: INK, fontStyle: "italic", lineHeight: 1.4 }}>
            Everything you share is confidential, secure, and used only to prepare your Statement of Advice.
          </div>
        </div>
      </div>

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
   Map - preserve 15-slide indexing
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
  SlideClipboards,
  SlideClipboards,
  SlideClipboards,
  SlideClipboards,
  SlideClipboards,
  Slide14,
  Slide15,
];

export const TOTAL_SLIDES = SLIDES.length;
