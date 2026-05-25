import { useEffect, useState } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { useSoftphone } from "@/hooks/useSoftphone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Settings, Loader2, Delete, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const KEYS = ["1","2","3","4","5","6","7","8","9","*","0","#"];

export default function PhonePage() {
  const { ready, registering, callerId, identity, bootstrap, dial, initialize } = useSoftphone();
  const [number, setNumber] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );

  const loadLogs = async () => {
    const { data } = await supabase
      .from("voice_call_logs")
      .select("id, direction, from_number, to_number, status, contact_name, started_at, duration_seconds")
      .order("started_at", { ascending: false })
      .limit(30);
    setLogs((data as LogRow[]) || []);
  };

  useEffect(() => { loadLogs(); }, []);

  const requestCallAlerts = async () => {
    if (!("Notification" in window)) {
      toast.error("Call pop-ups are not supported in this browser.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") toast.success("Call pop-ups enabled");
    if (permission === "denied") toast.error("Call pop-ups are blocked in browser settings.");
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

  return (
    <CRMLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-navy to-cyan/20 p-6 sm:p-8 border border-cyan/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(195_95%_50%/0.08),transparent_60%)]" />
          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan/15 backdrop-blur-sm flex items-center justify-center border border-cyan/20">
                <Phone className="w-5 h-5 text-cyan" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading">Phone</h1>
                <p className="text-sm text-white/50 mt-0.5">
                  {ready ? <>Online · {callerId} · client: {identity}</> : registering ? "Connecting…" : "Offline"}
                </p>
              </div>
            </div>
            <Button onClick={provision} disabled={provisioning} variant="secondary" className="gap-2">
              {provisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
              {ready ? "Re-provision" : "Set up phone system"}
            </Button>
            {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
              <Button onClick={requestCallAlerts} variant="outline" className="gap-2 bg-transparent border-white/20 text-white hover:bg-white/10">
                <BellRing className="w-4 h-4" /> Enable call pop-ups
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          <Card className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Dial pad</div>
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="+61 4xx xxx xxx"
              className="h-14 text-2xl font-mono text-center tracking-wider"
            />
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((d) => (
                <Button
                  key={d}
                  variant="outline"
                  className="h-14 text-xl font-medium"
                  onClick={() => setNumber((n) => n + d)}
                >
                  {d}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNumber((n) => n.slice(0, -1))}>
                <Delete className="w-4 h-4" /> Backspace
              </Button>
              <Button
                onClick={handleDial}
                disabled={!ready || !number.trim()}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Phone className="w-4 h-4" /> Call
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Recent calls</div>
              <Button size="sm" variant="ghost" onClick={loadLogs}>Refresh</Button>
            </div>
            <div className="divide-y divide-border">
              {logs.length === 0 && (
                <div className="text-sm text-muted-foreground py-8 text-center">No calls yet</div>
              )}
              {logs.map((l) => {
                const incoming = l.direction === "inbound";
                const display = incoming ? l.from_number : l.to_number;
                return (
                  <div key={l.id} className="py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${incoming ? "bg-emerald-500/10 text-emerald-500" : "bg-cyan/10 text-cyan"}`}>
                      {incoming ? <PhoneIncoming className="w-4 h-4" /> : <PhoneOutgoing className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{l.contact_name || display || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground truncate">{display} · {new Date(l.started_at).toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{l.status}</div>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!ready || !display} onClick={() => display && dial(display)}>
                      <Phone className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </CRMLayout>
  );
}
