import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Users, TrendingUp, PhoneCall, ArrowRight, Zap } from "lucide-react";

interface Stats {
  totalCalls: number;
  answered: number;
  leads: number;
  activeCampaigns: number;
}

export function AICallerDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState<Stats>({ totalCalls: 0, answered: 0, leads: 0, activeCampaigns: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    const [campaigns, leads, logs] = await Promise.all([
      supabase.from("ai_caller_campaigns").select("*").eq("status", "active"),
      supabase.from("ai_caller_leads").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("ai_caller_call_logs").select("status"),
    ]);
    setStats({
      totalCalls: logs.data?.length || 0,
      answered: logs.data?.filter(l => l.status === "completed").length || 0,
      leads: leads.data?.length || 0,
      activeCampaigns: campaigns.data?.length || 0,
    });
    setRecentLeads(leads.data || []);
  }

  const statCards = [
    { label: "Total Calls", value: stats.totalCalls, icon: Phone, gradient: "from-blue-500/20 to-cyan-500/20", iconColor: "text-blue-400", border: "border-blue-500/20" },
    { label: "Answered", value: stats.answered, icon: PhoneCall, gradient: "from-emerald-500/20 to-green-500/20", iconColor: "text-emerald-400", border: "border-emerald-500/20" },
    { label: "Leads Generated", value: stats.leads, icon: Users, gradient: "from-amber-500/20 to-orange-500/20", iconColor: "text-amber-400", border: "border-amber-500/20" },
    { label: "Active Campaigns", value: stats.activeCampaigns, icon: TrendingUp, gradient: "from-violet-500/20 to-purple-500/20", iconColor: "text-violet-400", border: "border-violet-500/20" },
  ];

  const statusColor: Record<string, string> = {
    new: "bg-blue-500/15 text-blue-400",
    contacted: "bg-amber-500/15 text-amber-400",
    qualified: "bg-emerald-500/15 text-emerald-400",
    converted: "bg-violet-500/15 text-violet-400",
    lost: "bg-destructive/15 text-destructive",
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className={`bg-card border ${s.border} hover:shadow-lg transition-all duration-300 group`}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <s.icon className={`w-5 h-5 ${s.iconColor}`} />
              </div>
              <p className="text-3xl font-bold text-foreground tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-foreground text-sm">Quick Actions</h3>
            </div>
            <p className="text-xs text-muted-foreground">Jump straight into what you need</p>
          </div>
          <CardContent className="space-y-2 pb-5">
            {[
              { label: "Create New Script", tab: "scripts", icon: Phone, desc: "Define your AI caller's personality & questions" },
              { label: "Start Campaign", tab: "campaigns", icon: TrendingUp, desc: "Upload contacts and start calling" },
              { label: "View Leads", tab: "leads", icon: Users, desc: "See all leads generated from calls" },
            ].map(a => (
              <button
                key={a.tab}
                onClick={() => onNavigate(a.tab)}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-muted/60 transition-colors group text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <a.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-foreground text-sm">Recent Leads</h3>
              </div>
              {recentLeads.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => onNavigate("leads")}>
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          <CardContent className="pb-5">
            {recentLeads.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No leads yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start a campaign to generate leads</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => onNavigate("leads")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xs font-bold text-foreground">
                        {lead.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${statusColor[lead.status] || statusColor.new}`}>
                      {lead.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
