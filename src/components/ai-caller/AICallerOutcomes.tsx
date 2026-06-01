import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhoneOff, PhoneMissed, CheckCircle2, RefreshCw, Phone } from "lucide-react";
import { toast } from "sonner";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  call_status: string;
  call_attempts: number;
  last_called_at: string | null;
  campaign_id: string;
};

type Campaign = { id: string; name: string };

const BUCKETS = [
  {
    id: "no_answer",
    label: "Did Not Answer",
    desc: "Calls that rang out, hit voicemail, were busy, or failed to connect. Safe to re-dial later.",
    icon: PhoneMissed,
    tone: "text-amber-400 bg-amber-500/15 border-amber-500/20",
  },
  {
    id: "not_interested",
    label: "Do Not Contact",
    desc: "Spoke to the person but they declined to share details or weren't interested. Do not re-dial.",
    icon: PhoneOff,
    tone: "text-rose-400 bg-rose-500/15 border-rose-500/20",
  },
  {
    id: "qualified",
    label: "Qualified Leads",
    desc: "Answered, interested, and consented to contact. These also appear in your main pipeline as New Leads.",
    icon: CheckCircle2,
    tone: "text-emerald-400 bg-emerald-500/15 border-emerald-500/20",
  },
] as const;

export function AICallerOutcomes() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Record<string, Campaign>>({});
  const [active, setActive] = useState<(typeof BUCKETS)[number]["id"]>("no_answer");
  const [loading, setLoading] = useState(true);
  const [redialing, setRedialing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: cs }, { data: cps }] = await Promise.all([
      supabase
        .from("ai_caller_contacts")
        .select("id, name, phone, email, call_status, call_attempts, last_called_at, campaign_id")
        .in("call_status", ["no_answer", "not_interested", "qualified"])
        .order("last_called_at", { ascending: false, nullsFirst: false })
        .limit(1000),
      supabase.from("ai_caller_campaigns").select("id, name"),
    ]);
    setContacts((cs || []) as Contact[]);
    const map: Record<string, Campaign> = {};
    (cps || []).forEach((c: any) => { map[c.id] = c; });
    setCampaigns(map);
    setLoading(false);
  }

  const counts = BUCKETS.reduce<Record<string, number>>((acc, b) => {
    acc[b.id] = contacts.filter(c => c.call_status === b.id).length;
    return acc;
  }, {});

  const filtered = contacts.filter(c => c.call_status === active);

  async function redialDidNotAnswer() {
    const targets = contacts.filter(c => c.call_status === "no_answer");
    if (targets.length === 0) {
      toast.error("Nothing to re-dial");
      return;
    }
    setRedialing(true);
    try {
      // Reset their status to pending so the paced ticker picks them up again
      // on their original campaign.
      const ids = targets.map(t => t.id);
      const { error } = await supabase
        .from("ai_caller_contacts")
        .update({ call_status: "pending" })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} contact${ids.length === 1 ? "" : "s"} queued for re-dial`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Re-dial failed");
    } finally {
      setRedialing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {BUCKETS.map(b => {
          const isActive = active === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setActive(b.id)}
              className={`text-left rounded-2xl border p-5 transition-all ${
                isActive
                  ? "border-primary/40 bg-primary/5 shadow-md"
                  : "border-border bg-card hover:border-primary/20"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${b.tone}`}>
                <b.icon className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold tracking-tight">{counts[b.id] || 0}</p>
              <p className="text-sm font-semibold mt-1">{b.label}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{b.desc}</p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-semibold">{BUCKETS.find(b => b.id === active)?.label}</h3>
              <p className="text-xs text-muted-foreground">{filtered.length} contact{filtered.length === 1 ? "" : "s"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {active === "no_answer" && (
                <Button size="sm" onClick={redialDidNotAnswer} disabled={redialing || filtered.length === 0}>
                  <Phone className="w-4 h-4 mr-2" />
                  Re-dial all ({filtered.length})
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nothing here yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left font-medium py-2 pr-4">Name</th>
                    <th className="text-left font-medium py-2 pr-4">Phone</th>
                    <th className="text-left font-medium py-2 pr-4">Campaign</th>
                    <th className="text-left font-medium py-2 pr-4">Attempts</th>
                    <th className="text-left font-medium py-2">Last called</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-border/40 hover:bg-muted/40">
                      <td className="py-2.5 pr-4 font-medium">{c.name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{c.phone}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="secondary" className="font-normal">
                          {campaigns[c.campaign_id]?.name || "—"}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{c.call_attempts}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {c.last_called_at ? new Date(c.last_called_at).toLocaleString("en-AU") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
