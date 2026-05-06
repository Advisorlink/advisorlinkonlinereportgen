import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Users, Phone, Mail, Clock, FileText } from "lucide-react";

export function AICallerLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);

  useEffect(() => { loadLeads(); }, []);

  async function loadLeads() {
    setLoading(true);
    const { data } = await supabase
      .from("ai_caller_leads")
      .select("*")
      .order("created_at", { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }

  const filtered = leads.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
  );

  const statusColor: Record<string, string> = {
    new: "bg-cyan/20 text-cyan",
    contacted: "bg-amber-500/20 text-amber-400",
    qualified: "bg-emerald-500/20 text-emerald-400",
    converted: "bg-violet-500/20 text-violet-400",
    lost: "bg-destructive/20 text-destructive",
  };

  async function updateStatus(id: string, status: string) {
    await supabase.from("ai_caller_leads").update({ status } as any).eq("id", id);
    setLeads(leads.map(l => l.id === id ? { ...l, status } : l));
    if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, status });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Leads</h2>
          <p className="text-sm text-muted-foreground">{leads.length} leads generated from AI calls</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search leads by name or phone..."
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No leads match your search" : "No leads yet. Start a campaign to generate leads."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <Card
              key={lead.id}
              className="bg-card border-border hover:border-cyan/30 transition-colors cursor-pointer"
              onClick={() => setSelectedLead(lead)}
            >
              <CardContent className="py-3 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-foreground text-sm">{lead.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[lead.status] || statusColor.new}`}>
                        {lead.status}
                      </span>
                      {lead.qualification_score && (
                        <span className="text-[10px] text-muted-foreground">
                          Score: {lead.qualification_score}%
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                      {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                      {lead.call_duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{Math.floor(lead.call_duration_seconds / 60)}:{(lead.call_duration_seconds % 60).toString().padStart(2, "0")}
                        </span>
                      )}
                    </div>
                    {lead.extracted_fields && Object.keys(lead.extracted_fields).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(lead.extracted_fields as Record<string, string>).map(([key, val]) => (
                          <span key={key} className="text-[10px] px-2 py-0.5 rounded bg-muted text-foreground">
                            <span className="text-muted-foreground">{key}:</span> {String(val)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedLead} onOpenChange={(o) => !o && setSelectedLead(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedLead.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Phone:</span> {selectedLead.phone}</div>
                  <div><span className="text-muted-foreground">Email:</span> {selectedLead.email || "—"}</div>
                  <div><span className="text-muted-foreground">Score:</span> {selectedLead.qualification_score || 0}%</div>
                  <div><span className="text-muted-foreground">Duration:</span> {selectedLead.call_duration_seconds ? `${Math.floor(selectedLead.call_duration_seconds / 60)}m ${selectedLead.call_duration_seconds % 60}s` : "—"}</div>
                </div>

                <div className="flex gap-2">
                  {["new", "contacted", "qualified", "converted", "lost"].map(s => (
                    <Button
                      key={s}
                      variant={selectedLead.status === s ? "default" : "outline"}
                      size="sm"
                      className="text-xs capitalize"
                      onClick={() => updateStatus(selectedLead.id, s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>

                {selectedLead.extracted_fields && Object.keys(selectedLead.extracted_fields).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Extracted Data</h4>
                    <div className="space-y-1.5">
                      {Object.entries(selectedLead.extracted_fields as Record<string, string>).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-sm py-1.5 px-3 rounded bg-muted/50">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="font-medium text-foreground">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLead.transcript_summary && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Call Summary</h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">{selectedLead.transcript_summary}</p>
                  </div>
                )}

                {selectedLead.full_transcript && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Full Transcript
                    </h4>
                    <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {selectedLead.full_transcript}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
