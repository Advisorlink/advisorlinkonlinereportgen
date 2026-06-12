import { useEffect, useState } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { useSoftphone } from "@/hooks/useSoftphone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Settings,
  Loader2,
  Delete,
  BellRing,
  Search,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoUrl from "/logo-email-white.svg";

type LogRow = {
  id: string;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  status: string;
  contact_name: string | null;
  started_at: string;
  duration_seconds: number | null;
};

const KEYS: { d: string; s?: string }[] = [
  { d: "1" }, { d: "2", s: "ABC" }, { d: "3", s: "DEF" },
  { d: "4", s: "GHI" }, { d: "5", s: "JKL" }, { d: "6", s: "MNO" },
  { d: "7", s: "PQRS" }, { d: "8", s: "TUV" }, { d: "9", s: "WXYZ" },
  { d: "*" }, { d: "0", s: "+" }, { d: "#" },
];

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function PhonePage() {
  const { ready, registering, callerId, identity, bootstrap, dial, initialize, availableNumbers, selectedCallerId, setSelectedCallerId } = useSoftphone();
  const [number, setNumber] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );

  const loadLogs = async () => {
    const { data } = await supabase
      .from("voice_call_logs")
      .select("id, direction, from_number, to_number, status, contact_name, started_at, duration_seconds")
      .order("started_at", { ascending: false })
      .limit(50);
    setLogs((data as LogRow[]) || []);
  };

  useEffect(() => { loadLogs(); }, []);

  const requestCallAlerts = async () => {
    if (!("Notification" in window)) return toast.error("Call pop-ups not supported in this browser.");
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") toast.success("Call pop-ups enabled");
    if (permission === "denied") toast.error("Call pop-ups are blocked.");
  };

  const provision = async () => {
    setProvisioning(true);
    try {
      if (notificationPermission === "default") await requestCallAlerts();
      await bootstrap();
      await initialize();
      toast.success("Phone system provisioned");
    } catch (e) {
      toast.error(`Setup failed: ${String(e)}`);
    } finally { setProvisioning(false); }
  };

  const handleDial = async () => {
    const n = number.trim();
    if (!n) return;
    try { await dial(n); } catch (e) { toast.error(`Dial failed: ${String(e)}`); }
  };

  const filtered = logs.filter((l) => {
    if (filter !== "all" && l.direction !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (l.contact_name || "").toLowerCase().includes(q) ||
      (l.from_number || "").toLowerCase().includes(q) ||
      (l.to_number || "").toLowerCase().includes(q)
    );
  });

  return (
    <CRMLayout>
      <div className="min-h-screen bg-gradient-to-br from-[hsl(215_60%_8%)] via-[hsl(215_55%_12%)] to-[hsl(192_50%_15%)] -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-10">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl border border-cyan/15 bg-gradient-to-br from-navy via-[hsl(215_60%_10%)] to-[hsl(192_70%_18%)] p-6 sm:p-8 shadow-elevated">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-cyan/20 blur-3xl" />
            <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-cyan-glow/10 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(192_95%_50%/0.12),transparent_50%)]" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan/40 rounded-2xl blur-xl animate-pulse" />
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan to-cyan-glow flex items-center justify-center shadow-lg shadow-cyan/30">
                    <Phone className="w-7 h-7 text-navy" strokeWidth={2.5} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <img src={logoUrl} alt="AdvisorLink Online" className="h-5 opacity-90" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-cyan/70 font-bold">Softphone</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-heading leading-none">
                    Your Phone Line
                  </h1>
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    {ready ? (
                      <>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-emerald-300 text-xs font-semibold">Online</span>
                        </div>
                        <span className="text-white/60 font-mono text-xs">{callerId}</span>
                      </>
                    ) : registering ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                        <Loader2 className="w-3 h-3 text-amber-300 animate-spin" />
                        <span className="text-amber-300 text-xs font-semibold">Connecting…</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                        <WifiOff className="w-3 h-3 text-white/60" />
                        <span className="text-white/60 text-xs font-semibold">Offline</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
                  <Button onClick={requestCallAlerts} variant="outline" className="gap-2 bg-white/5 border-white/15 text-white hover:bg-white/10 backdrop-blur-sm">
                    <BellRing className="w-4 h-4" /> Enable pop-ups
                  </Button>
                )}
                <Button onClick={provision} disabled={provisioning} className="gap-2 bg-gradient-to-r from-cyan to-cyan-glow text-navy hover:opacity-90 font-semibold shadow-lg shadow-cyan/20">
                  {provisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                  {ready ? "Re-provision" : "Set up phone"}
                </Button>
              </div>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-6">
            {/* Dialpad */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[hsl(215_50%_14%)] to-[hsl(215_55%_10%)] p-6 shadow-elevated">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-cyan/10 blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-cyan/80 font-bold">Dial Pad</div>
                  <Sparkles className="w-4 h-4 text-cyan/60" />
                </div>

                <div className="relative mb-5">
                  <Input
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="+61 4xx xxx xxx"
                    className="h-16 text-2xl font-mono text-center tracking-wider bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-cyan rounded-2xl"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {KEYS.map(({ d, s }) => (
                    <button
                      key={d}
                      onClick={() => setNumber((n) => n + d)}
                      className="group relative h-16 rounded-2xl bg-white/5 hover:bg-cyan/15 border border-white/10 hover:border-cyan/40 transition-all active:scale-95"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-2xl font-semibold text-white group-hover:text-cyan transition-colors">{d}</span>
                        {s && <span className="text-[9px] tracking-[0.15em] text-white/40 font-bold">{s}</span>}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNumber((n) => n.slice(0, -1))}
                    className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleDial}
                    disabled={!ready || !number.trim()}
                    className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98]"
                  >
                    <Phone className="w-5 h-5" fill="currentColor" />
                    Call
                  </button>
                </div>

                {identity && (
                  <div className="mt-5 pt-4 border-t border-white/5 text-[10px] text-white/40 font-mono text-center">
                    client: {identity}
                  </div>
                )}
              </div>
            </div>

            {/* Call history */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[hsl(215_50%_14%)] to-[hsl(215_55%_10%)] shadow-elevated">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-cyan/80 font-bold mb-1">Activity</div>
                    <h2 className="text-xl font-bold text-white font-heading">Recent calls</h2>
                  </div>
                  <Button size="sm" variant="ghost" onClick={loadLogs} className="text-white/60 hover:text-white hover:bg-white/5">
                    Refresh
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or number…"
                      className="pl-9 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-cyan"
                    />
                  </div>
                  <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
                    {(["all", "inbound", "outbound"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                          filter === f ? "bg-cyan text-navy" : "text-white/60 hover:text-white"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="py-16 text-center">
                    <div className="w-14 h-14 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-3">
                      <Phone className="w-6 h-6 text-white/30" />
                    </div>
                    <div className="text-sm text-white/50">No calls to show</div>
                  </div>
                )}
                {filtered.map((l) => {
                  const incoming = l.direction === "inbound";
                  const display = incoming ? l.from_number : l.to_number;
                  const name = l.contact_name || display || "Unknown";
                  const initial = (name[0] || "?").toUpperCase();
                  return (
                    <div key={l.id} className="group px-6 py-3 flex items-center gap-4 hover:bg-white/[0.03] transition-colors">
                      <div className="relative">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm ${
                          incoming ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-300 border border-emerald-500/20" : "bg-gradient-to-br from-cyan/20 to-cyan/5 text-cyan border border-cyan/20"
                        }`}>
                          {initial}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[hsl(215_55%_12%)] ${
                          incoming ? "bg-emerald-500" : "bg-cyan"
                        }`}>
                          {incoming ? <PhoneIncoming className="w-2 h-2 text-white" /> : <PhoneOutgoing className="w-2 h-2 text-navy" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{name}</div>
                        <div className="text-xs text-white/40 truncate font-mono">{display}</div>
                      </div>
                      <div className="hidden sm:flex flex-col items-end text-right">
                        <div className="text-xs text-white/60">{relativeTime(l.started_at)}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">
                          {l.status} · {formatDuration(l.duration_seconds)}
                        </div>
                      </div>
                      <button
                        disabled={!ready || !display}
                        onClick={() => display && dial(display)}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald-500 border border-white/10 hover:border-emerald-500 flex items-center justify-center text-white/60 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
