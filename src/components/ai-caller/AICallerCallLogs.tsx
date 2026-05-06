import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Phone, Clock, DollarSign, CheckCircle, XCircle, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AICallerCallLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
      <div>
        <h2 className="text-lg font-semibold text-foreground">Call Logs</h2>
        <p className="text-sm text-muted-foreground">Detailed log of every call attempt</p>
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
                        {log.ai_caller_contacts?.name || "Unknown"} — {log.ai_caller_contacts?.phone || "—"}
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
                      </div>
                    </div>
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
