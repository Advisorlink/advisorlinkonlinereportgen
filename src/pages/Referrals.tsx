import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CRMLayout } from "@/components/CRMLayout";
import { Input } from "@/components/ui/input";
import { Gift, Search, Filter, Users, Mail, Phone, User, MapPin, DollarSign, Building, CheckCircle } from "lucide-react";

interface ReferralResponseRow {
  id: string; lead_id: string; name: string; phone: string; email: string;
  age: string | null; state: string | null; super_balance: string | null;
  super_fund_name: string | null; had_review_before: boolean | null; created_at: string;
}
interface ReferralLeadRow {
  id: string; referrer_name: string; referrer_email: string; lead_name: string;
  lead_phone: string; lead_email: string; status: string; created_at: string;
  token: string; submission_id: string | null;
}

export default function Referrals() {
  const { profile } = useAuth();
  const [responses, setResponses] = useState<ReferralResponseRow[]>([]);
  const [leads, setLeads] = useState<ReferralLeadRow[]>([]);
  const [search, setSearch] = useState("");
  const [referrerFilter, setReferrerFilter] = useState("");

  useEffect(() => {
    if (!profile?.is_owner) return;
    (async () => {
      const [{ data: rr }, { data: rl }] = await Promise.all([
        supabase.from("referral_responses").select("*").order("created_at", { ascending: false }),
        supabase.from("referral_leads").select("*").order("created_at", { ascending: false }),
      ]);
      setResponses((rr as ReferralResponseRow[]) || []);
      setLeads((rl as ReferralLeadRow[]) || []);
    })();
  }, [profile]);

  const leadMap = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);
  const referrerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    responses.forEach(r => {
      const lead = leadMap.get(r.lead_id);
      if (lead) {
        const key = lead.referrer_email.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return counts;
  }, [responses, leadMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rf = referrerFilter.trim().toLowerCase();
    return responses.filter(r => {
      const lead = leadMap.get(r.lead_id);
      const matchesSearch = !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.phone.includes(q) || (lead?.referrer_name ?? "").toLowerCase().includes(q);
      const matchesReferrer = !rf || (lead?.referrer_name ?? "").toLowerCase().includes(rf) || (lead?.referrer_email ?? "").toLowerCase().includes(rf);
      return matchesSearch && matchesReferrer;
    });
  }, [responses, search, referrerFilter, leadMap]);

  return (
    <CRMLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan to-[hsl(170_80%_35%)] flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading text-navy">Share & Earn</h1>
              <p className="text-sm text-muted-foreground">{responses.length} responses received</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search responses..." className="pl-9" />
            </div>
            <div className="relative w-full sm:w-56">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={referrerFilter} onChange={e => setReferrerFilter(e.target.value)} placeholder="Filter by sender..." className="pl-9" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-elevated p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{search || referrerFilter ? "No responses match that filter" : "No share responses yet"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => {
                const lead = leadMap.get(r.lead_id);
                const referrerEmail = lead?.referrer_email?.toLowerCase() ?? "";
                const referrerTotal = referrerCounts.get(referrerEmail) || 0;
                return (
                  <div key={r.id} className="border border-border rounded-xl p-4 hover:shadow-md transition-shadow bg-gradient-to-r from-white to-secondary/30">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 sm:w-48 shrink-0">
                        <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold text-sm shrink-0">
                          {r.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-navy text-sm leading-tight truncate">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground flex-1 min-w-0">
                        <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate max-w-[180px]">{r.email}</span></div>
                        <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" /><span>{r.phone}</span></div>
                        {r.age && <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 shrink-0" /><span>Age: {r.age}</span></div>}
                        {r.state && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" /><span>{r.state}</span></div>}
                        {r.super_fund_name && <div className="flex items-center gap-1.5"><Building className="w-3.5 h-3.5 shrink-0" /><span className="truncate max-w-[160px]">{r.super_fund_name}</span></div>}
                        {r.super_balance && <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 shrink-0" /><span>{r.super_balance}</span></div>}
                        {r.had_review_before !== null && <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 shrink-0" /><span>Previous review: {r.had_review_before ? "Yes" : "No"}</span></div>}
                      </div>
                      {lead && (
                        <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-4 shrink-0">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shared by</p>
                            <p className="text-xs font-semibold text-navy truncate">{lead.referrer_name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{lead.referrer_email}</p>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-cyan/15 text-cyan text-[11px] font-bold whitespace-nowrap">
                            {referrerTotal} person{referrerTotal !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CRMLayout>
  );
}
