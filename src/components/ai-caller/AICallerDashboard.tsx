import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Users, TrendingUp, Clock, PhoneCall, PhoneOff } from "lucide-react";

interface Stats {
  totalCalls: number;
  answered: number;
  leads: number;
  activeCampaigns: number;
}

export function AICallerDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState<Stats>({ totalCalls: 0, answered: 0, leads: 0, activeCampaigns: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

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
    { label: "Total Calls", value: stats.totalCalls, icon: Phone, color: "text-cyan" },
    { label: "Answered", value: stats.answered, icon: PhoneCall, color: "text-emerald-400" },
    { label: "Leads Generated", value: stats.leads, icon: Users, color: "text-amber-400" },
    { label: "Active Campaigns", value: stats.activeCampaigns, icon: TrendingUp, color: "text-violet-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => onNavigate("scripts")} variant="outline" className="w-full justify-start gap-2">
              <Phone className="w-4 h-4" /> Create New Script
            </Button>
            <Button onClick={() => onNavigate("campaigns")} variant="outline" className="w-full justify-start gap-2">
              <TrendingUp className="w-4 h-4" /> Start Campaign
            </Button>
            <Button onClick={() => onNavigate("leads")} variant="outline" className="w-full justify-start gap-2">
              <Users className="w-4 h-4" /> View Leads
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No leads yet. Start a campaign to generate leads.</p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
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
