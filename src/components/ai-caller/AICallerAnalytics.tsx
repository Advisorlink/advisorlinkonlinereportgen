import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone, PhoneCall, PhoneOff, Users, TrendingUp, DollarSign, Clock,
  Sparkles, AlertTriangle, CheckCircle2, Activity, Target, Timer,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Log = {
  id: string;
  campaign_id: string | null;
  contact_id: string | null;
  status: string;
  duration_seconds: number | null;
  cost: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};
type Campaign = {
  id: string;
  name: string;
  script_id: string;
  total_contacts: number;
  calls_completed: number;
  calls_answered: number;
  leads_generated: number;
  status: string;
  created_at: string;
};
type Lead = { id: string; campaign_id: string | null; qualification_score: number | null; status: string; call_duration_seconds: number | null; created_at: string };
type Script = { id: string; name: string };

const ANSWERED_STATUSES = new Set(["completed", "answered", "in-progress", "ended"]);

const COLORS = ["hsl(195 95% 50%)", "hsl(160 80% 45%)", "hsl(45 95% 55%)", "hsl(0 75% 55%)", "hsl(270 70% 60%)", "hsl(220 90% 60%)"];

function fmtDur(seconds: number) {
  if (!seconds || seconds < 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function fmtPct(num: number, den: number) {
  if (!den) return "0%";
  return `${Math.round((num / den) * 100)}%`;
}
function fmtCost(n: number) {
  return `$${n.toFixed(2)}`;
}

export function AICallerAnalytics() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Log[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [l, c, s, ld] = await Promise.all([
      supabase.from("ai_caller_call_logs").select("id, campaign_id, contact_id, status, duration_seconds, cost, started_at, ended_at, created_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("ai_caller_campaigns").select("id, name, script_id, total_contacts, calls_completed, calls_answered, leads_generated, status, created_at"),
      supabase.from("ai_caller_scripts").select("id, name"),
      supabase.from("ai_caller_leads").select("id, campaign_id, qualification_score, status, call_duration_seconds, created_at").limit(5000),
    ]);
    setLogs((l.data as any) || []);
    setCampaigns((c.data as any) || []);
    setScripts((s.data as any) || []);
    setLeads((ld.data as any) || []);
    setLoading(false);
  }

  const filteredLogs = useMemo(() => {
    if (range === "all") return logs;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    return logs.filter(l => new Date(l.created_at).getTime() >= cutoff);
  }, [logs, range]);

  const totals = useMemo(() => {
    const total = filteredLogs.length;
    const answered = filteredLogs.filter(l => ANSWERED_STATUSES.has(l.status)).length;
    const noAnswer = filteredLogs.filter(l => /no.?answer|voicemail|busy|missed/i.test(l.status)).length;
    const failed = filteredLogs.filter(l => /fail|error/i.test(l.status)).length;
    const totalDuration = filteredLogs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
    const totalCost = filteredLogs.reduce((s, l) => s + Number(l.cost || 0), 0);
    const answeredWithDur = filteredLogs.filter(l => ANSWERED_STATUSES.has(l.status) && (l.duration_seconds || 0) > 0);
    const avgTalk = answeredWithDur.length ? answeredWithDur.reduce((s, l) => s + (l.duration_seconds || 0), 0) / answeredWithDur.length : 0;
    const leadCount = leads.length;
    return { total, answered, noAnswer, failed, totalDuration, totalCost, avgTalk, leadCount };
  }, [filteredLogs, leads]);

  // Calls by day
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; calls: number; answered: number; leads: number }>();
    filteredLogs.forEach(l => {
      const d = new Date(l.created_at).toISOString().slice(0, 10);
      const row = map.get(d) || { date: d, calls: 0, answered: 0, leads: 0 };
      row.calls += 1;
      if (ANSWERED_STATUSES.has(l.status)) row.answered += 1;
      map.set(d, row);
    });
    leads.forEach(ld => {
      const d = new Date(ld.created_at).toISOString().slice(0, 10);
      const row = map.get(d) || { date: d, calls: 0, answered: 0, leads: 0 };
      row.leads += 1;
      map.set(d, row);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  }, [filteredLogs, leads]);

  // Outcome breakdown
  const outcomeData = useMemo(() => {
    const buckets: Record<string, number> = {};
    filteredLogs.forEach(l => {
      const k = ANSWERED_STATUSES.has(l.status) ? "Answered"
        : /no.?answer|missed/i.test(l.status) ? "No Answer"
        : /voicemail/i.test(l.status) ? "Voicemail"
        : /busy/i.test(l.status) ? "Busy"
        : /fail|error/i.test(l.status) ? "Failed"
        : "Other";
      buckets[k] = (buckets[k] || 0) + 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [filteredLogs]);

  // Hourly heatmap (best time to call)
  const hourlyData = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, calls: 0, answered: 0 }));
    filteredLogs.forEach(l => {
      const h = new Date(l.started_at || l.created_at).getHours();
      arr[h].calls += 1;
      if (ANSWERED_STATUSES.has(l.status)) arr[h].answered += 1;
    });
    return arr.map(r => ({ ...r, answerRate: r.calls ? Math.round((r.answered / r.calls) * 100) : 0 }));
  }, [filteredLogs]);

  // Per-campaign A/B comparison
  const campaignStats = useMemo(() => {
    return campaigns.map(c => {
      const cLogs = filteredLogs.filter(l => l.campaign_id === c.id);
      const cLeads = leads.filter(ld => ld.campaign_id === c.id);
      const ans = cLogs.filter(l => ANSWERED_STATUSES.has(l.status)).length;
      const cost = cLogs.reduce((s, l) => s + Number(l.cost || 0), 0);
      const dur = cLogs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
      const avgDur = ans ? dur / ans : 0;
      const script = scripts.find(s => s.id === c.script_id);
      return {
        id: c.id,
        name: c.name,
        script: script?.name || "—",
        calls: cLogs.length,
        answered: ans,
        answerRate: cLogs.length ? ans / cLogs.length : 0,
        leads: cLeads.length,
        leadRate: ans ? cLeads.length / ans : 0,
        avgDur,
        cost,
        cpl: cLeads.length ? cost / cLeads.length : 0,
        status: c.status,
      };
    }).sort((a, b) => b.calls - a.calls);
  }, [campaigns, filteredLogs, leads, scripts]);

  // Per-script comparison
  const scriptStats = useMemo(() => {
    const byScript = new Map<string, { id: string; name: string; calls: number; answered: number; leads: number; cost: number }>();
    campaigns.forEach(c => {
      const cLogs = filteredLogs.filter(l => l.campaign_id === c.id);
      const cLeads = leads.filter(ld => ld.campaign_id === c.id);
      const k = c.script_id;
      const cur = byScript.get(k) || { id: k, name: scripts.find(s => s.id === k)?.name || "Unknown", calls: 0, answered: 0, leads: 0, cost: 0 };
      cur.calls += cLogs.length;
      cur.answered += cLogs.filter(l => ANSWERED_STATUSES.has(l.status)).length;
      cur.leads += cLeads.length;
      cur.cost += cLogs.reduce((s, l) => s + Number(l.cost || 0), 0);
      byScript.set(k, cur);
    });
    return Array.from(byScript.values()).map(s => ({
      ...s,
      answerRate: s.calls ? s.answered / s.calls : 0,
      leadRate: s.answered ? s.leads / s.answered : 0,
      cpl: s.leads ? s.cost / s.leads : 0,
    })).sort((a, b) => b.calls - a.calls);
  }, [campaigns, filteredLogs, leads, scripts]);

  // Recommendations
  const recommendations = useMemo(() => {
    const recs: { kind: "good" | "warn" | "tip"; title: string; body: string }[] = [];
    const answerRate = totals.total ? totals.answered / totals.total : 0;
    if (totals.total >= 20) {
      if (answerRate < 0.15) recs.push({ kind: "warn", title: "Low answer rate", body: `Only ${Math.round(answerRate*100)}% of calls were answered. Try calling at different times, switching caller ID, or reducing call volume per hour to avoid being marked as spam.` });
      else if (answerRate > 0.4) recs.push({ kind: "good", title: "Strong answer rate", body: `${Math.round(answerRate*100)}% pickup — your number reputation and timing are working. Consider scaling volume.` });
    }
    // Best hour
    const bestHour = [...hourlyData].filter(h => h.calls >= 5).sort((a, b) => b.answerRate - a.answerRate)[0];
    const worstHour = [...hourlyData].filter(h => h.calls >= 5).sort((a, b) => a.answerRate - b.answerRate)[0];
    if (bestHour && bestHour.answerRate > 0) recs.push({ kind: "tip", title: `Best calling hour: ${bestHour.hour}`, body: `Pickup rate of ${bestHour.answerRate}% at ${bestHour.hour}. Shift more calls into this window.` });
    if (worstHour && worstHour !== bestHour && worstHour.answerRate < 10) recs.push({ kind: "tip", title: `Avoid ${worstHour.hour}`, body: `Only ${worstHour.answerRate}% pickup. Pause or reduce calls during this hour.` });
    // Best script
    const withVolume = scriptStats.filter(s => s.calls >= 20);
    if (withVolume.length >= 2) {
      const sorted = [...withVolume].sort((a, b) => b.leadRate - a.leadRate);
      const best = sorted[0]; const worst = sorted[sorted.length - 1];
      if (best.leadRate > worst.leadRate * 1.4) {
        recs.push({ kind: "good", title: `Winning script: "${best.name}"`, body: `Converts ${Math.round(best.leadRate*100)}% of answered calls into leads — vs ${Math.round(worst.leadRate*100)}% for "${worst.name}". Route more volume to the winner.` });
      }
    }
    // Avg talk time
    if (totals.avgTalk > 0 && totals.avgTalk < 30) {
      recs.push({ kind: "warn", title: "Calls ending fast", body: `Average answered call is only ${fmtDur(totals.avgTalk)}. Prospects may be hanging up — review the opener and first 10 seconds.` });
    } else if (totals.avgTalk > 180) {
      recs.push({ kind: "good", title: "Solid engagement", body: `Average talk time is ${fmtDur(totals.avgTalk)} — prospects are sticking around.` });
    }
    // Cost per lead
    if (totals.totalCost > 0 && totals.leadCount > 0) {
      const cpl = totals.totalCost / totals.leadCount;
      recs.push({ kind: "tip", title: `Cost per lead: ${fmtCost(cpl)}`, body: `Across ${totals.leadCount} leads. Compare against your target CPL to decide whether to scale or refine.` });
    }
    // Failed calls
    if (totals.failed > 0 && totals.failed / Math.max(1, totals.total) > 0.05) {
      recs.push({ kind: "warn", title: "High failure rate", body: `${Math.round((totals.failed/totals.total)*100)}% of calls failed. Check number formatting and provider status.` });
    }
    if (recs.length === 0) recs.push({ kind: "tip", title: "Not enough data yet", body: "Run more calls — recommendations sharpen once you have 20+ calls and 2+ scripts in rotation." });
    return recs;
  }, [totals, hourlyData, scriptStats]);

  const statCards = [
    { label: "Total Calls", value: totals.total.toLocaleString(), icon: Phone, color: "text-blue-400", bg: "from-blue-500/20 to-cyan-500/20" },
    { label: "Answered", value: totals.answered.toLocaleString(), sub: fmtPct(totals.answered, totals.total), icon: PhoneCall, color: "text-emerald-400", bg: "from-emerald-500/20 to-green-500/20" },
    { label: "No Answer", value: totals.noAnswer.toLocaleString(), sub: fmtPct(totals.noAnswer, totals.total), icon: PhoneOff, color: "text-amber-400", bg: "from-amber-500/20 to-orange-500/20" },
    { label: "Leads", value: totals.leadCount.toLocaleString(), sub: totals.answered ? `${fmtPct(totals.leadCount, totals.answered)} of answered` : undefined, icon: Users, color: "text-violet-400", bg: "from-violet-500/20 to-purple-500/20" },
    { label: "Avg Talk Time", value: fmtDur(totals.avgTalk), icon: Timer, color: "text-cyan-400", bg: "from-cyan-500/20 to-blue-500/20" },
    { label: "Total Cost", value: fmtCost(totals.totalCost), sub: totals.leadCount ? `${fmtCost(totals.totalCost / totals.leadCount)} / lead` : undefined, icon: DollarSign, color: "text-pink-400", bg: "from-pink-500/20 to-rose-500/20" },
  ];

  if (loading) return <div className="text-muted-foreground p-8 text-center">Loading analytics…</div>;

  return (
    <div className="space-y-6">
      {/* Range filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Call Analytics</h2>
          <p className="text-sm text-muted-foreground">Performance, A/B testing, and recommendations</p>
        </div>
        <Select value={range} onValueChange={(v: any) => setRange(v)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {statCards.map(s => (
          <Card key={s.label} className="bg-card border">
            <CardContent className="pt-5 pb-4 px-4">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              {s.sub && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recommendations */}
      <Card className="bg-card border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-amber-400" /> Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          {recommendations.map((r, i) => {
            const Icon = r.kind === "good" ? CheckCircle2 : r.kind === "warn" ? AlertTriangle : Target;
            const color = r.kind === "good" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
              : r.kind === "warn" ? "text-amber-400 border-amber-500/30 bg-amber-500/5"
              : "text-cyan-400 border-cyan-500/30 bg-cyan-500/5";
            return (
              <div key={i} className={`p-3 rounded-lg border ${color}`}>
                <div className="flex items-start gap-2">
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
          <TabsTrigger value="timing">Best Time</TabsTrigger>
          <TabsTrigger value="ab">A/B Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="trends">
          <Card className="bg-card border">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Calls Over Time</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="calls" stroke={COLORS[0]} strokeWidth={2} />
                  <Line type="monotone" dataKey="answered" stroke={COLORS[1]} strokeWidth={2} />
                  <Line type="monotone" dataKey="leads" stroke={COLORS[2]} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outcomes">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Call Outcomes</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={outcomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>
                      {outcomeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-card border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {outcomeData.map((o, i) => (
                    <div key={o.name} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-foreground">{o.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-foreground">{o.value}</span>
                        <span className="text-xs text-muted-foreground w-12 text-right">{fmtPct(o.value, totals.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timing">
          <Card className="bg-card border">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Pickup Rate by Hour</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="calls" fill={COLORS[0]} name="Calls" />
                  <Bar dataKey="answered" fill={COLORS[1]} name="Answered" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ab" className="space-y-4">
          <Card className="bg-card border">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Per-Campaign Performance</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left p-3">Campaign</th>
                      <th className="text-left p-3">Script</th>
                      <th className="text-right p-3">Calls</th>
                      <th className="text-right p-3">Answered</th>
                      <th className="text-right p-3">Ans %</th>
                      <th className="text-right p-3">Leads</th>
                      <th className="text-right p-3">Conv %</th>
                      <th className="text-right p-3">Avg Talk</th>
                      <th className="text-right p-3">Cost</th>
                      <th className="text-right p-3">CPL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignStats.length === 0 && (
                      <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No campaign data yet</td></tr>
                    )}
                    {campaignStats.map(c => (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                        <td className="p-3 text-foreground font-medium">{c.name}</td>
                        <td className="p-3 text-muted-foreground">{c.script}</td>
                        <td className="p-3 text-right">{c.calls}</td>
                        <td className="p-3 text-right">{c.answered}</td>
                        <td className="p-3 text-right">{Math.round(c.answerRate * 100)}%</td>
                        <td className="p-3 text-right">{c.leads}</td>
                        <td className="p-3 text-right">{Math.round(c.leadRate * 100)}%</td>
                        <td className="p-3 text-right">{fmtDur(c.avgDur)}</td>
                        <td className="p-3 text-right">{fmtCost(c.cost)}</td>
                        <td className="p-3 text-right">{c.leads ? fmtCost(c.cpl) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-card border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Per-Script Comparison</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Script</th>
                    <th className="text-right p-3">Calls</th>
                    <th className="text-right p-3">Ans %</th>
                    <th className="text-right p-3">Leads</th>
                    <th className="text-right p-3">Conv %</th>
                    <th className="text-right p-3">CPL</th>
                    <th className="text-right p-3">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {scriptStats.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No script data yet</td></tr>
                  )}
                  {scriptStats.map((s, i) => {
                    const isWinner = scriptStats.length >= 2 && i === 0 && s.calls >= 20;
                    const isLoser = scriptStats.length >= 2 && i === scriptStats.length - 1 && s.calls >= 20 && scriptStats[0].leadRate > s.leadRate * 1.4;
                    return (
                      <tr key={s.id} className="border-t border-border">
                        <td className="p-3 text-foreground font-medium">{s.name}</td>
                        <td className="p-3 text-right">{s.calls}</td>
                        <td className="p-3 text-right">{Math.round(s.answerRate * 100)}%</td>
                        <td className="p-3 text-right">{s.leads}</td>
                        <td className="p-3 text-right">{Math.round(s.leadRate * 100)}%</td>
                        <td className="p-3 text-right">{s.leads ? fmtCost(s.cpl) : "—"}</td>
                        <td className="p-3 text-right">
                          {isWinner && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Winner</Badge>}
                          {isLoser && <Badge className="bg-destructive/15 text-destructive border-destructive/30">Underperforming</Badge>}
                          {!isWinner && !isLoser && s.calls < 20 && <span className="text-xs text-muted-foreground">Needs volume</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
