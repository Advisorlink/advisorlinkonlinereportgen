import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CRMLayout } from "@/components/CRMLayout";
import { FileText, Gift, Monitor, Users, TrendingUp, ArrowRight, Sparkles, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookAppointmentDialog } from "@/components/booking/BookAppointmentDialog";

export default function Dashboard() {
  const nav = useNavigate();
  const { profile, loading } = useAuth();
  const [stats, setStats] = useState({ reports: 0, referrals: 0, meetings: 0, leads: 0 });
  const [recentReports, setRecentReports] = useState<Array<{ id: string; client_name: string; created_at: string }>>([]);
  const [bookOpen, setBookOpen] = useState(false);

  useEffect(() => {
    if (!profile?.is_owner) return;
    (async () => {
      const [{ count: rc }, { count: rfc }, { count: mc }, { count: lc }, { data: recent }] = await Promise.all([
        supabase.from("reports").select("*", { count: "exact", head: true }),
        supabase.from("referral_responses").select("*", { count: "exact", head: true }),
        supabase.from("meetings").select("*", { count: "exact", head: true }),
        supabase.from("referral_leads").select("*", { count: "exact", head: true }),
        supabase.from("reports").select("id, client_name, created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({ reports: rc || 0, referrals: rfc || 0, meetings: mc || 0, leads: lc || 0 });
      setRecentReports(recent || []);
    })();
  }, [profile]);

  if (loading) return <CRMLayout><div className="grid place-items-center h-full text-muted-foreground text-sm">Loading…</div></CRMLayout>;

  const cards = [
    { label: "Total Reports", value: stats.reports, icon: FileText, gradient: "from-cyan/10 to-cyan/5", iconBg: "bg-cyan/15 text-cyan", link: "/admin" },
    { label: "Referral Responses", value: stats.referrals, icon: Gift, gradient: "from-emerald-500/10 to-emerald-500/5", iconBg: "bg-emerald-500/15 text-emerald-600", link: "/referrals" },
    { label: "Meetings Held", value: stats.meetings, icon: Monitor, gradient: "from-violet-500/10 to-violet-500/5", iconBg: "bg-violet-500/15 text-violet-600", link: "/presentations" },
    { label: "Referral Leads", value: stats.leads, icon: Users, gradient: "from-amber-500/10 to-amber-500/5", iconBg: "bg-amber-500/15 text-amber-600", link: "/referrals" },
  ];

  return (
    <CRMLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Welcome header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-heading text-foreground tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Welcome back to Settled & Sound</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan/10 text-cyan text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            All systems online
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <button
              key={c.label}
              onClick={() => nav(c.link)}
              className={`group relative bg-card rounded-2xl shadow-card hover:shadow-elevated p-5 flex flex-col gap-4 transition-all duration-300 text-left overflow-hidden border border-border/60 hover:border-border`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative flex items-center justify-between">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.iconBg}`}>
                  <c.icon className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all -translate-x-2 group-hover:translate-x-0" />
              </div>
              <div className="relative">
                <p className="text-3xl font-bold text-foreground tracking-tight">{c.value}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">{c.label}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick actions */}
          <div className="bg-card rounded-2xl shadow-card border border-border/60 p-6">
            <h2 className="text-lg font-bold font-heading text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-2.5">
              <Button
                className="w-full justify-between h-12 gradient-accent text-white border-0 shadow-lg shadow-cyan/20 hover:shadow-cyan/30 transition-all"
                onClick={() => nav("/presentations")}
              >
                <span className="flex items-center gap-2.5"><Monitor className="w-4 h-4" /> Start Presentation</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                className="w-full justify-between h-12 bg-cyan text-navy hover:bg-cyan-glow border-0 shadow-lg shadow-cyan/20 transition-all"
                onClick={() => setBookOpen(true)}
              >
                <span className="flex items-center gap-2.5"><CalendarPlus className="w-4 h-4" /> Book a Call</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between h-11 hover:bg-muted/50" onClick={() => nav("/")}>
                <span className="flex items-center gap-2.5"><FileText className="w-4 h-4" /> Generate Report</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between h-11 hover:bg-muted/50" onClick={() => nav("/referrals")}>
                <span className="flex items-center gap-2.5"><Gift className="w-4 h-4" /> View Referrals</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Recent reports */}
          <div className="bg-card rounded-2xl shadow-card border border-border/60 p-6">
            <h2 className="text-lg font-bold font-heading text-foreground mb-4">Recent Reports</h2>
            {recentReports.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No reports yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentReports.map((r) => {
                  const ageMs = Date.now() - new Date(r.created_at).getTime();
                  const isNew = ageMs < 24 * 60 * 60 * 1000;
                  const mins = Math.floor(ageMs / 60000);
                  const hours = Math.floor(mins / 60);
                  const days = Math.floor(hours / 24);
                  const rel = mins < 1 ? "Just now"
                    : mins < 60 ? `${mins} min${mins === 1 ? "" : "s"} ago`
                    : hours < 24 ? `${hours} hour${hours === 1 ? "" : "s"} ago`
                    : `${days} day${days === 1 ? "" : "s"} ago`;
                  return (
                  <div key={r.id} className="flex items-center justify-between py-3 px-3 -mx-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-cyan/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-cyan" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <span>{r.client_name}</span>
                          {isNew && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-cyan text-white">
                              New
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground" title={new Date(r.created_at).toLocaleString()}>{rel}</p>
                      </div>
                    </div>
                    <TrendingUp className="w-4 h-4 text-cyan" />
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <BookAppointmentDialog open={bookOpen} onOpenChange={setBookOpen} />
    </CRMLayout>
  );
}
