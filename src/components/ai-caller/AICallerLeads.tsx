import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search, Users, Phone, Mail, Clock, FileText, ChevronLeft, ChevronDown,
  Send, Play, Pause, SkipBack, SkipForward, Star, MessageSquare,
  DollarSign, User, Building, ShieldCheck, Volume2, Loader2, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function AICallerLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [extractingLeadId, setExtractingLeadId] = useState<string | null>(null);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => { loadLeads(); }, []);

  useEffect(() => {
    if (selectedLead) loadNotes(selectedLead.id);
  }, [selectedLead?.id]);

  async function loadLeads() {
    setLoading(true);
    const { data } = await supabase
      .from("ai_caller_leads")
      .select("*")
      .order("created_at", { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }

  async function loadNotes(leadId: string) {
    setNotesLoading(true);
    const { data } = await supabase
      .from("ai_caller_lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setNotes(data || []);
    setNotesLoading(false);
  }

  async function addNote() {
    if (!newNote.trim() || !selectedLead) return;
    setAddingNote(true);
    const { error } = await supabase.from("ai_caller_lead_notes").insert({
      lead_id: selectedLead.id,
      content: newNote.trim(),
      created_by: user?.id || null,
    } as any);
    if (error) { toast.error("Failed to add note"); }
    else {
      setNewNote("");
      loadNotes(selectedLead.id);
      toast.success("Note added");
    }
    setAddingNote(false);
  }

  const filtered = leads.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
  );

  const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    new: { bg: "bg-cyan/10", text: "text-cyan", dot: "bg-cyan", label: "New" },
    contacted: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400", label: "Contacted" },
    qualified: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", label: "Qualified" },
    converted: { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-400", label: "Converted" },
    lost: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400", label: "Lost" },
  };

  async function updateStatus(id: string, status: string) {
    await supabase.from("ai_caller_leads").update({ status } as any).eq("id", id);
    setLeads(leads.map(l => l.id === id ? { ...l, status } : l));
    if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, status });
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  }

  function seekTo(time: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  async function selectLead(lead: any) {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setTranscriptOpen(false);
    setNewNote("");

    let enrichedLead = { ...lead };
    setSelectedLead(enrichedLead);

    const hasExtractedFields = enrichedLead.extracted_fields && Object.values(enrichedLead.extracted_fields).some(Boolean);
    const needsReprocess = !hasExtractedFields || !enrichedLead.recording_url;
    if (needsReprocess) {
      setExtractingLeadId(lead.id);
      try {
        const { data, error } = await supabase.functions.invoke("vapi-manage", {
          body: { action: "reprocess-lead", leadId: lead.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.lead) {
          enrichedLead = data.lead;
          setSelectedLead(enrichedLead);
          setLeads(prev => prev.map(l => l.id === lead.id ? enrichedLead : l));
        }
      } catch (e: any) {
        toast.error(e.message || "Could not extract lead answers from this call");
      } finally {
        setExtractingLeadId(null);
      }
    }
  }

  // Extract field helpers
  const ef = selectedLead?.extracted_fields || {};
  const fieldCards = [
    { label: "Super Fund", value: ef.super_fund_name || ef.super_fund || ef.fund_name || ef.fund, icon: Building, color: "text-cyan" },
    { label: "Balance", value: ef.balance || ef.super_balance, icon: DollarSign, color: "text-emerald-400" },
    { label: "Age", value: ef.age, icon: User, color: "text-amber-400" },
    { label: "Previous Review", value: ef.had_review_before || ef.previous_review || ef.review, icon: ShieldCheck, color: "text-violet-400" },
  ];

  // Lead detail view
  if (selectedLead) {
    const sc = statusConfig[selectedLead.status] || statusConfig.new;
    const recordingUrl = selectedLead.recording_url;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="rounded-full mt-1 shrink-0 hover:bg-navy/10" onClick={() => { setSelectedLead(null); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-navy to-cyan/30 flex items-center justify-center text-xl font-black text-white shadow-md border border-cyan/20">
                {selectedLead.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground tracking-tight truncate">{selectedLead.name}</h2>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-cyan" /> {selectedLead.phone}
                  </span>
                  {selectedLead.email && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-cyan" /> {selectedLead.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {selectedLead.qualification_score != null && (
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span className="text-2xl font-black text-foreground">{selectedLead.qualification_score}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">Score</p>
            </div>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(statusConfig).map(([status, config]) => (
            <button
              key={status}
              onClick={() => updateStatus(selectedLead.id, status)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                selectedLead.status === status
                  ? `${config.bg} ${config.text} ring-1 ring-current/30 shadow-sm`
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
              }`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${selectedLead.status === status ? config.dot : "bg-muted-foreground/30"}`} />
              {config.label}
            </button>
          ))}
        </div>

        {/* Fund Details Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {fieldCards.map(fc => (
            <Card key={fc.label} className="bg-card border-border hover:border-cyan/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <fc.icon className={`w-4 h-4 ${fc.color}`} />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{fc.label}</span>
                </div>
                <p className="text-sm font-bold text-foreground truncate">
                  {fc.value || <span className="text-muted-foreground/50 font-normal italic">—</span>}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        {extractingLeadId === selectedLead.id && (
          <div className="flex items-center gap-2 rounded-xl border border-cyan/15 bg-cyan/5 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-cyan" />
            <span>Reading the call transcript and filling the client’s answers…</span>
          </div>
        )}

        {/* Additional extracted fields */}
        {(() => {
          const knownKeys = ["super_fund_name", "super_fund", "fund_name", "fund", "balance", "super_balance", "age", "had_review_before", "previous_review", "review"];
          const extra = Object.entries(ef).filter(([k]) => !knownKeys.includes(k));
          if (extra.length === 0) return null;
          return (
            <Card className="bg-card border-border">
              <div className="px-5 pt-4 pb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Additional Details</h3>
              </div>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {extra.map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                      <span className="text-sm text-muted-foreground capitalize font-medium">{key.replace(/_/g, " ")}</span>
                      <span className="text-sm font-semibold text-foreground">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Call Summary */}
            {selectedLead.transcript_summary && (
              <Card className="bg-card border-border">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-cyan" /> Call Summary
                  </h3>
                </div>
                <CardContent className="pt-0">
                  <p className="text-sm text-foreground/80 leading-relaxed">{selectedLead.transcript_summary}</p>
                </CardContent>
              </Card>
            )}
            {!selectedLead.transcript_summary && extractingLeadId !== selectedLead.id && (
              <Card className="bg-card border-border">
                <CardContent className="p-5 flex items-center gap-3 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-cyan" />
                  <span>No summary was found in this call yet.</span>
                </CardContent>
              </Card>
            )}

            {/* Recording Player */}
            {recordingUrl && (
              <Card className="bg-gradient-to-br from-navy/5 to-cyan/5 border-cyan/15 overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-cyan" /> Call Recording
                  </h3>
                </div>
                <CardContent className="pt-0 pb-5">
                  <audio
                    ref={audioRef}
                    src={recordingUrl}
                    onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
                    onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
                    onEnded={() => setIsPlaying(false)}
                    preload="metadata"
                  />
                  <div className="rounded-xl bg-card border border-border p-4 space-y-3">
                    {/* Progress bar */}
                    <div className="relative group cursor-pointer" onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      seekTo(pct * duration);
                    }}>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan to-accent transition-all duration-150"
                          style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                        />
                      </div>
                    </div>
                    {/* Controls */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono tabular-nums w-10">{formatTime(currentTime)}</span>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => seekTo(Math.max(0, currentTime - 10))}>
                          <SkipBack className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          className="h-11 w-11 rounded-full bg-cyan text-white hover:bg-cyan/90 shadow-lg shadow-cyan/20"
                          onClick={togglePlay}
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => seekTo(Math.min(duration, currentTime + 10))}>
                          <SkipForward className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums w-10 text-right">{formatTime(duration)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {!recordingUrl && (
              <Card className="bg-card border-border">
                <CardContent className="p-5 flex items-center gap-3 text-sm text-muted-foreground">
                  <Volume2 className="w-4 h-4 text-cyan" />
                  <span>{extractingLeadId === selectedLead.id ? "Checking the call log for the recording…" : "No browser-playable recording was saved for this lead."}</span>
                </CardContent>
              </Card>
            )}

            {/* Full Transcript - Collapsible */}
            {selectedLead.full_transcript && (
              <Collapsible open={transcriptOpen} onOpenChange={setTranscriptOpen}>
                <Card className="bg-card border-border overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan" /> Full Transcript
                      </h3>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${transcriptOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-5">
                      <pre className="text-xs text-muted-foreground bg-muted/30 p-4 rounded-xl whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed font-sans border border-border">
                        {selectedLead.full_transcript}
                      </pre>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>

          {/* Right: Notes */}
          <div className="space-y-4">
            <Card className="bg-card border-border overflow-hidden sticky top-4">
              <div className="px-5 pt-5 pb-3 border-b border-border bg-gradient-to-r from-navy/5 to-transparent">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan" /> Notes
                  <span className="ml-auto text-[10px] bg-cyan/10 text-cyan px-2 py-0.5 rounded-full font-bold">{notes.length}</span>
                </h3>
              </div>
              <CardContent className="p-4 space-y-3">
                <Textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  className="min-h-[72px] text-sm resize-none border-border focus:border-cyan/40"
                  onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addNote(); }}
                />
                <Button
                  onClick={addNote}
                  disabled={!newNote.trim() || addingNote}
                  size="sm"
                  className="w-full gap-2 bg-cyan text-white hover:bg-cyan/90"
                >
                  <Send className="w-3.5 h-3.5" /> Add Note
                </Button>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {notesLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Loading notes...</p>
                  ) : notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6 opacity-60">No notes yet</p>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="bg-muted/30 rounded-lg p-3 space-y-1 border border-border/50">
                        <p className="text-sm text-foreground leading-relaxed">{note.content}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(note.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {selectedLead.call_duration_seconds != null && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-cyan" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Call Duration</p>
                      <p className="text-sm font-bold text-foreground">
                        {Math.floor(selectedLead.call_duration_seconds / 60)}m {selectedLead.call_duration_seconds % 60}s
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Leads</h2>
          <p className="text-sm text-muted-foreground">{leads.length} leads generated from AI calls</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search leads by name or phone..."
          className="pl-10 h-11 rounded-xl border-border focus:border-cyan/40"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-cyan" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {search ? "No leads match your search" : "No leads yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {search ? "Try a different search term" : "Start a campaign to generate leads."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const sc = statusConfig[lead.status] || statusConfig.new;
            const lef = lead.extracted_fields || {};
            return (
              <Card
                key={lead.id}
                className="bg-card border-border hover:border-cyan/25 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => selectLead(lead)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy/20 to-cyan/15 flex items-center justify-center text-sm font-bold text-foreground shrink-0 group-hover:scale-105 transition-transform border border-cyan/10">
                      {lead.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="font-semibold text-foreground text-sm truncate">{lead.name}</h3>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${sc.bg} ${sc.text} flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                        {lead.qualification_score != null && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {lead.qualification_score}%
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                        {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                        {lead.call_duration_seconds != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{Math.floor(lead.call_duration_seconds / 60)}:{(lead.call_duration_seconds % 60).toString().padStart(2, "0")}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Preview extracted data */}
                    <div className="hidden md:flex flex-wrap gap-1.5 max-w-[260px] justify-end">
                      {(lef.super_fund_name || lef.super_fund || lef.fund_name) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan/8 text-cyan border border-cyan/15 truncate max-w-[120px]">
                          {lef.super_fund_name || lef.super_fund || lef.fund_name}
                        </span>
                      )}
                      {(lef.balance || lef.super_balance) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/8 text-emerald-500 border border-emerald-500/15 truncate max-w-[100px]">
                          ${lef.balance || lef.super_balance}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
