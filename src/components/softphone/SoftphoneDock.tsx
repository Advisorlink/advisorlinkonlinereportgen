import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSoftphone } from "@/hooks/useSoftphone";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, Pause, Play, Grid3x3, ChevronDown, ChevronUp, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function SoftphoneDock() {
  const { ready, registering, callerId, incoming, incomingMatch, active, answer, reject, hangup, toggleMute, toggleHold, sendDigit } = useSoftphone();
  const [now, setNow] = useState(Date.now());
  const [showDtmf, setShowDtmf] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!active || active.status !== "in-progress") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!incoming) return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    const setViewportHeight = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--softphone-mobile-vh", `${height}px`);
    };

    setViewportHeight();
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    window.visualViewport?.addEventListener("resize", setViewportHeight);
    window.visualViewport?.addEventListener("scroll", setViewportHeight);
    window.addEventListener("resize", setViewportHeight);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      document.documentElement.style.removeProperty("--softphone-mobile-vh");
      window.visualViewport?.removeEventListener("resize", setViewportHeight);
      window.visualViewport?.removeEventListener("scroll", setViewportHeight);
      window.removeEventListener("resize", setViewportHeight);
    };
  }, [incoming]);

  if (!incoming && !active) return null;

  const callee = incoming
    ? { title: incomingMatch?.name || incoming.parameters?.From || "Unknown", sub: incoming.parameters?.From || "" }
    : active
      ? { title: active.contactName || active.to || active.from, sub: active.direction === "inbound" ? active.from : active.to }
      : null;

  // Full-screen dark-blue incoming call screen (mobile-first, centered)
  if (incoming) {
    const initials = (callee?.title || "?")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const incomingScreen = (
      <div
        className="softphone-incoming-screen fixed inset-0 z-[2147483647] flex flex-col items-center justify-between overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Incoming call"
      >
        {/* glow blobs */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-navy/40 blur-3xl" />

        {/* Top: label */}
        <div className="relative z-10 w-full flex flex-col items-center gap-2 pt-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-navy-foreground/80">
            <PhoneIncoming className="w-3.5 h-3.5 animate-pulse" />
            Incoming call
          </div>
        </div>

        {/* Center: avatar + name */}
        <div className="relative z-10 flex-1 w-full flex flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-8">
            <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" />
            <span className="absolute -inset-3 rounded-full border border-blue-300/20" />
            <span className="absolute -inset-6 rounded-full border border-blue-300/10" />
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-cyan to-primary flex items-center justify-center text-4xl font-semibold shadow-2xl shadow-primary/60 ring-4 ring-navy-foreground/10">
              {initials || <User className="w-12 h-12" />}
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight max-w-full truncate">
            {callee?.title}
          </div>
          {callee?.sub && callee.sub !== callee.title && (
            <div className="mt-2 text-sm text-navy-foreground/70 font-mono tabular-nums">
              {callee.sub}
            </div>
          )}
          <div className="mt-1 text-xs text-navy-foreground/50">
            calling {callerId || "your line"}
          </div>
        </div>

        {/* Bottom: actions */}
        <div className="relative z-10 w-full max-w-sm px-8 flex items-center justify-between">
          <button
            onClick={reject}
            className="group flex flex-col items-center gap-2"
            aria-label="Decline"
          >
            <span className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition flex items-center justify-center shadow-lg shadow-red-900/50">
              <PhoneOff className="w-7 h-7" />
            </span>
            <span className="text-xs text-navy-foreground/80">Decline</span>
          </button>
          <button
            onClick={answer}
            className="group flex flex-col items-center gap-2"
            aria-label="Answer"
          >
            <span className="relative w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition flex items-center justify-center shadow-lg shadow-emerald-900/50">
              <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
              <Phone className="relative w-7 h-7" />
            </span>
            <span className="text-xs text-navy-foreground/80">Answer</span>
          </button>
        </div>
      </div>
    );

    return typeof document === "undefined" ? incomingScreen : createPortal(incomingScreen, document.body);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[min(340px,calc(100vw-2rem))]">
      <div className="w-full rounded-2xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
        <div className={cn("px-4 py-3 flex items-center gap-3 border-b border-border/60",
          active?.status === "in-progress" ? "bg-cyan/10" : "bg-amber-500/10",
        )}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-cyan/20">
            <User className="w-5 h-5 text-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{callee?.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {active?.status === "connecting" ? "Connecting…" : active?.status === "ringing" ? "Ringing…" : callee?.sub}
            </div>
          </div>
          {active?.status === "in-progress" && (
            <div className="text-xs font-mono tabular-nums text-foreground/80">{formatDuration(now - active.startedAt)}</div>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>

        {expanded && active && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Button variant={active.isMuted ? "default" : "outline"} onClick={toggleMute} className="flex-col h-16 gap-1">
                {active.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="text-[10px] font-medium">{active.isMuted ? "Muted" : "Mute"}</span>
              </Button>
              <Button variant={active.isOnHold ? "default" : "outline"} onClick={toggleHold} className="flex-col h-16 gap-1">
                {active.isOnHold ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span className="text-[10px] font-medium">{active.isOnHold ? "Resume" : "Hold"}</span>
              </Button>
              <Button variant={showDtmf ? "default" : "outline"} onClick={() => setShowDtmf((v) => !v)} className="flex-col h-16 gap-1">
                <Grid3x3 className="w-4 h-4" />
                <span className="text-[10px] font-medium">Keypad</span>
              </Button>
            </div>

            {showDtmf && (
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {["1","2","3","4","5","6","7","8","9","*","0","#"].map((d) => (
                  <Button key={d} variant="outline" className="h-10 text-base font-medium" onClick={() => sendDigit(d)}>{d}</Button>
                ))}
              </div>
            )}

            <Button onClick={hangup} variant="destructive" className="w-full">
              <PhoneOff className="w-4 h-4" /> End call
            </Button>

            <div className="text-[10px] text-muted-foreground text-center pt-1">
              {ready ? <>Phone line • {callerId}</> : registering ? "Connecting phone…" : "Phone offline"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
