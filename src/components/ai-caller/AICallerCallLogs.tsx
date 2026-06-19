import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Phone, Clock, DollarSign, CheckCircle, XCircle, Loader2, Download, Trash2, Square, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AICallerCallLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stopping, setStopping] = useState<string | null>(null);

  useEffect(() => { loadLogs(); }, []);

  async function loadLogs() {
    setLoading(true);
    const { data } = await supabase
      .from("ai_caller_call_logs")
      .select("*, ai_caller_contacts(name, phone)")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs(data || []);
    setLoading(false);
  }

  async function stopCall(vapiCallId: string) {
    setStopping(vapiCallId);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "stop-call", callId: vapiCallId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Call stopped");
      loadLogs();
    } catch (e: any) {
      toast.error(e.message || "Failed to stop call");
    } finally {
      setStopping(null);
    }
  }

  async function deleteLog(logId: string) {
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "delete-call-log", logId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Call log deleted");
      setLogs(logs.filter(l => l.id !== logId));
    } catch (e: any) {
      toast.error(e.message || "Failed to delete log");
    }
  }

  async function clearAllLogs() {
    if (!confirm("Delete ALL call logs? This cannot be undone.")) return;
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "clear-call-logs" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("All call logs cleared");
      setLogs([]);
    } catch (e: any) {
      toast.error(e.message || "Failed to clear logs");
    }
  }

  const statusIcon: Record<string, any> = {
    completed: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    failed: <XCircle className="w-4 h-4 text-destructive" />,
    initiated: <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />,
  };

  const filtered = logs.filter(l =>
    !search || l.ai_caller_contacts?.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.ai_caller_contacts?.phone?.includes(search) ||
    l.vapi_call_id?.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Call Logs</h2>
          <p className="text-sm text-muted-foreground">Detailed log of every call attempt</p>
        </div>
        {logs.length > 0 && (
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={clearAllLogs}>
            <Trash2 className="w-3.5 h-3.5" /> Clear All
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..." className="pl-10" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Phone className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No call logs yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <Card key={log.id} className="bg-card border-border">
              <CardContent className="py-3 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcon[log.status] || statusIcon.initiated}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {log.ai_caller_contacts?.name || "Unknown"} - {log.ai_caller_contacts?.phone || "-"}
                      </p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="capitalize">{log.status}</span>
                        {log.duration_seconds != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.floor(log.duration_seconds / 60)}:{(log.duration_seconds % 60).toString().padStart(2, "0")}
                          </span>
                        )}
                        {log.cost != null && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />${Number(log.cost).toFixed(4)}
                          </span>
                        )}
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                        {log.error_message && (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="w-3 h-3" /> {log.error_message}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    {log.status === "initiated" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1 text-xs"
                        disabled={stopping === log.vapi_call_id}
                        onClick={() => stopCall(log.vapi_call_id)}
                      >
                        {stopping === log.vapi_call_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                        Stop
                      </Button>
                    )}
                    {log.recording_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => window.open(log.recording_url, "_blank")}
                      >
                        <Download className="w-3.5 h-3.5" /> Recording
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        if (confirm("Delete this call log?")) deleteLog(log.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
