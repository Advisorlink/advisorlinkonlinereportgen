import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Ban, CheckCircle, Trash2, RefreshCw } from "lucide-react";

interface ProfileRow {
  id: string;
  email: string;
  is_owner: boolean;
  is_blocked: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface LogRow {
  id: string;
  user_id: string | null;
  email: string | null;
  event_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export default function Admin() {
  const nav = useNavigate();
  const { profile, loading } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !profile?.is_owner) {
      toast.error("Owner access required");
      nav("/", { replace: true });
    }
  }, [profile, loading, nav]);

  const refresh = async () => {
    setBusy(true);
    const [{ data: u }, { data: l }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setUsers((u as ProfileRow[]) || []);
    setLogs((l as LogRow[]) || []);
    setBusy(false);
  };

  useEffect(() => {
    if (profile?.is_owner) refresh();
  }, [profile]);

  const toggleBlock = async (u: ProfileRow) => {
    const { error } = await supabase.from("profiles").update({ is_blocked: !u.is_blocked }).eq("id", u.id);
    if (error) toast.error(error.message);
    else {
      toast.success(u.is_blocked ? "User unblocked" : "User blocked");
      refresh();
    }
  };

  const deleteUser = async (u: ProfileRow) => {
    if (u.is_owner) { toast.error("Cannot delete the owner"); return; }
    if (!confirm(`Permanently delete ${u.email}?`)) return;
    const { error } = await supabase.from("profiles").delete().eq("id", u.id);
    if (error) toast.error(error.message);
    else { toast.success("User deleted"); refresh(); }
  };

  const clearLogs = async () => {
    if (!confirm("Clear all activity logs?")) return;
    const { error } = await supabase.from("activity_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message);
    else { toast.success("Logs cleared"); refresh(); }
  };

  if (loading || !profile?.is_owner) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Verifying…</div>;
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="sticky top-0 z-40 bg-navy text-navy-foreground shadow-elevated">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-navy-foreground hover:bg-white/10" onClick={() => nav("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <span className="px-2.5 py-1 rounded-md bg-cyan text-cyan-foreground text-[10px] font-bold tracking-wide">Admin</span>
            <span className="text-xs font-semibold opacity-70">Owner Control Panel</span>
          </div>
          <Button size="sm" onClick={refresh} disabled={busy} className="bg-cyan text-cyan-foreground hover:bg-cyan/90">
            <RefreshCw className={`w-4 h-4 mr-1 ${busy ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        <section className="bg-white rounded-xl shadow-elevated p-6">
          <h2 className="text-lg font-bold font-heading text-navy mb-4">Users ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-4 font-semibold text-muted-foreground">Email</th>
                  <th className="py-2 pr-4 font-semibold text-muted-foreground">Role</th>
                  <th className="py-2 pr-4 font-semibold text-muted-foreground">Status</th>
                  <th className="py-2 pr-4 font-semibold text-muted-foreground">Last Login</th>
                  <th className="py-2 pr-4 font-semibold text-muted-foreground">Created</th>
                  <th className="py-2 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">
                      {u.is_owner
                        ? <span className="px-2 py-0.5 rounded bg-cyan/20 text-cyan text-xs font-semibold">OWNER</span>
                        : <span className="text-xs text-muted-foreground">user</span>}
                    </td>
                    <td className="py-2 pr-4">
                      {u.is_blocked
                        ? <span className="text-xs font-semibold text-destructive">BLOCKED</span>
                        : <span className="text-xs font-semibold text-[hsl(145_70%_35%)]">active</span>}
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-2 flex gap-2">
                      {!u.is_owner && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => toggleBlock(u)}>
                            {u.is_blocked ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <Ban className="w-3.5 h-3.5 mr-1" />}
                            {u.is_blocked ? "Unblock" : "Block"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteUser(u)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">No users</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold font-heading text-navy">Activity Log ({logs.length})</h2>
            <Button size="sm" variant="outline" onClick={clearLogs}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-4 font-semibold text-muted-foreground">When</th>
                  <th className="py-2 pr-4 font-semibold text-muted-foreground">Email</th>
                  <th className="py-2 pr-4 font-semibold text-muted-foreground">Event</th>
                  <th className="py-2 font-semibold text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-xs">{l.email || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        l.event_type === "login" ? "bg-[hsl(145_70%_45%/0.15)] text-[hsl(145_70%_30%)]" :
                        l.event_type === "access_denied" || l.event_type === "signup_blocked" ? "bg-destructive/15 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>{l.event_type}</span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{l.details ? JSON.stringify(l.details) : "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-xs">No activity yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
