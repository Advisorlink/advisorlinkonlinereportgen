import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CRMLayout } from "@/components/CRMLayout";
import { FileText, Gift, Monitor, Users, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const nav = useNavigate();
  const { profile, loading } = useAuth();
  const [stats, setStats] = useState({ reports: 0, referrals: 0, meetings: 0, leads: 0 });
  const [recentReports, setRecentReports] = useState<Array<{ id: string; client_name: string; created_at: string }>>([]);

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
    { label: "Total Reports", value: stats.reports, icon: FileText, color: "bg-cyan/15 text-cyan", link: "/admin" },
    { label: "Referral Responses", value: stats.referrals, icon: Gift, color: "bg-emerald-100 text-emerald-600", link: "/referrals" },
    { label: "Meetings Held", value: stats.meetings, icon: Monitor, color: "bg-violet-100 text-violet-600", link: "/presentations" },
    { label: "Referral Leads", value: stats.leads, icon: Users, color: "bg-amber-100 text-amber-600", link: "/referrals" },
  ];

  return (
    <CRMLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold font-heading text-navy">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back to Advisor Link Online</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <button
              key={c.label}
              onClick={() => nav(c.link)}
              className="bg-white rounded-xl shadow-elevated p-5 flex items-center gap-4 hover:shadow-lg transition-shadow text-left"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.color}`}>
                <c.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-navy">{c.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick actions */}
          <div className="bg-white rounded-xl shadow-elevated p-6">
            <h2 className="text-lg font-bold font-heading text-navy mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Button className="w-full justify-between bg-navy text-navy-foreground hover:bg-navy/90" onClick={() => nav("/presentations")}>
                <span className="flex items-center gap-2"><Monitor className="w-4 h-4" /> Start Presentation</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between" onClick={() => nav("/")}>
                <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Generate Report</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between" onClick={() => nav("/referrals")}>
                <span className="flex items-center gap-2"><Gift className="w-4 h-4" /> View Referrals</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Recent reports */}
          <div className="bg-white rounded-xl shadow-elevated p-6">
            <h2 className="text-lg font-bold font-heading text-navy mb-4">Recent Reports</h2>
            {recentReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet</p>
            ) : (
              <div className="space-y-2">
                {recentReports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-navy">{r.client_name}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <TrendingUp className="w-4 h-4 text-cyan" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
