import { useEffect, useState } from "react";
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
  const { ready, registering, callerId, incoming, active, answer, reject, hangup, toggleMute, toggleHold, sendDigit } = useSoftphone();
  const [now, setNow] = useState(Date.now());
  const [showDtmf, setShowDtmf] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!active || active.status !== "in-progress") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!incoming && !active) return null;

  const callee = incoming
    ? { title: ((incoming as any).__match?.name) || incoming.parameters?.From || "Unknown", sub: incoming.parameters?.From || "" }
    : active
      ? { title: active.contactName || active.to || active.from, sub: active.direction === "inbound" ? active.from : active.to }
      : null;

  return (
    <div className={cn(
      incoming
        ? "fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-md"
        : "fixed bottom-6 right-6 z-50 w-[min(340px,calc(100vw-2rem))]",
    )}>
    <div className={cn("w-full rounded-2xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden", incoming && "max-w-[420px]")}>
      <div className={cn("px-4 py-3 flex items-center gap-3 border-b border-border/60",
        incoming ? "bg-emerald-500/10" : active?.status === "in-progress" ? "bg-cyan/10" : "bg-amber-500/10",
      )}>
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center",
          incoming ? "bg-emerald-500/20" : "bg-cyan/20")}
        >
          {incoming ? <PhoneIncoming className="w-5 h-5 text-emerald-500 animate-pulse" /> : <User className="w-5 h-5 text-cyan" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{callee?.title}</div>
          <div className="text-xs text-muted-foreground truncate">
            {incoming ? "Incoming call…" : active?.status === "connecting" ? "Connecting…" : active?.status === "ringing" ? "Ringing…" : callee?.sub}
          </div>
        </div>
        {active?.status === "in-progress" && (
          <div className="text-xs font-mono tabular-nums text-foreground/80">{formatDuration(now - active.startedAt)}</div>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          {incoming && (
            <div className="flex gap-2">
              <Button onClick={reject} variant="destructive" className="flex-1 h-14 text-base">
                <PhoneOff className="w-4 h-4" /> Decline
              </Button>
              <Button onClick={answer} className="flex-1 h-14 text-base bg-emerald-500 text-white hover:bg-emerald-600">
                <Phone className="w-4 h-4" /> Answer
              </Button>
            </div>
          )}

          {active && (
            <>
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
            </>
          )}

          <div className="text-[10px] text-muted-foreground text-center pt-1">
            {ready ? <>Phone line • {callerId}</> : registering ? "Connecting phone…" : "Phone offline"}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
