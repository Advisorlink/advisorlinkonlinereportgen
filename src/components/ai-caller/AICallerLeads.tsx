import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Users, Phone, Mail, Clock, FileText, ChevronLeft, Plus, Send, Play, Pause, Volume2, SkipBack, SkipForward, Star, MessageSquare } from "lucide-react";
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

  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    new: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
    contacted: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    qualified: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
    converted: { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-400" },
    lost: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  };

  async function updateStatus(id: string, status: string) {
    await supabase.from("ai_caller_leads").update({ status } as any).eq("id", id);
    setLeads(leads.map(l => l.id === id ? { ...l, status } : l));
    if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, status });
  }

  // Audio controls
  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
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

  function selectLead(lead: any) {
    // Stop any playing audio
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSelectedLead(lead);
    setNewNote("");
  }

  // Lead detail view
  if (selectedLead) {
    const sc = statusConfig[selectedLead.status] || statusConfig.new;
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        {/* Back button + header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setSelectedLead(null); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-lg font-bold text-foreground shadow-sm">
                {selectedLead.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground tracking-tight">{selectedLead.name}</h2>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {selectedLead.phone}
                  </span>
                  {selectedLead.email && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> {selectedLead.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {selectedLead.qualification_score != null && (
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-2xl font-bold text-foreground">{selectedLead.qualification_score}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">QUALIFICATION</p>
            </div>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(statusConfig).map(([status, config]) => (
            <button
              key={status}
              onClick={() => updateStatus(selectedLead.id, status)}
              className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all ${
                selectedLead.status === status
                  ? `${config.bg} ${config.text} ring-2 ring-current/20 shadow-sm`
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${selectedLead.status === status ? config.dot : "bg-muted-foreground/40"}`} />
              {status}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Extracted Data + Call Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Extracted Fields */}
            {selectedLead.extracted_fields && Object.keys(selectedLead.extracted_fields).length > 0 && (
              <Card className="bg-card border-border overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" /> Client Details
                  </h3>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {Object.entries(selectedLead.extracted_fields as Record<string, string>).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                        <span className="text-sm text-muted-foreground capitalize font-medium">{key.replace(/_/g, " ")}</span>
                        <span className="text-sm font-semibold text-foreground">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Call Summary */}
            {selectedLead.transcript_summary && (
              <Card className="bg-card border-border">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-accent" /> Call Summary
                  </h3>
                </div>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedLead.transcript_summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Audio Player */}
            {selectedLead.recording_url && (
              <Card className="bg-card border-border overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-accent" /> Call Recording
                  </h3>
                </div>
                <CardContent className="pt-0 pb-5">
                  <audio
                    ref={audioRef}
                    src={selectedLead.recording_url}
                    onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
                    onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
                    onEnded={() => setIsPlaying(false)}
                    preload="metadata"
                  />
                  <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                    {/* Progress bar */}
                    <div className="relative group cursor-pointer" onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      seekTo(pct * duration);
                    }}>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all duration-150"
                          style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                        />
                      </div>
                    </div>
                    {/* Controls */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">{formatTime(currentTime)}</span>
                      <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => seekTo(Math.max(0, currentTime - 10))}>
                          <SkipBack className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                          onClick={togglePlay}
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => seekTo(Math.min(duration, currentTime + 10))}>
                          <SkipForward className="w-4 h-4" />
                        </Button>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">{formatTime(duration)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Full Transcript */}
            {selectedLead.full_transcript && (
              <Card className="bg-card border-border">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" /> Full Transcript
                  </h3>
                </div>
                <CardContent className="pt-0">
                  <pre className="text-xs text-muted-foreground bg-muted/40 p-4 rounded-xl whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed font-sans">
                    {selectedLead.full_transcript}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Notes */}
          <div className="space-y-4">
            <Card className="bg-card border-border overflow-hidden sticky top-4">
              <div className="px-5 pt-5 pb-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-accent" /> Notes
                  <span className="ml-auto text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-semibold">{notes.length}</span>
                </h3>
              </div>
              <CardContent className="p-4 space-y-4">
                {/* Add note */}
                <div className="flex gap-2">
                  <Textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="min-h-[72px] text-sm resize-none"
                    onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addNote(); }}
                  />
                </div>
                <Button
                  onClick={addNote}
                  disabled={!newNote.trim() || addingNote}
                  size="sm"
                  className="w-full gap-2"
                >
                  <Send className="w-3.5 h-3.5" /> Add Note
                </Button>

                {/* Notes list */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {notesLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Loading notes...</p>
                  ) : notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No notes yet. Add one above.</p>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="bg-muted/40 rounded-lg p-3 space-y-1.5">
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

            {/* Call Info Sidebar */}
            {selectedLead.call_duration_seconds != null && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Call Duration</p>
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
          className="pl-10 h-11 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-muted-foreground" />
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
            return (
              <Card
                key={lead.id}
                className="bg-card border-border hover:border-accent/30 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => selectLead(lead)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center text-sm font-bold text-foreground shrink-0 group-hover:scale-105 transition-transform">
                      {lead.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="font-semibold text-foreground text-sm truncate">{lead.name}</h3>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${sc.bg} ${sc.text} flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {lead.status}
                        </span>
                        {lead.qualification_score != null && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400" /> {lead.qualification_score}%
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
                    {lead.extracted_fields && Object.keys(lead.extracted_fields).length > 0 && (
                      <div className="hidden md:flex flex-wrap gap-1.5 max-w-[240px] justify-end">
                        {Object.entries(lead.extracted_fields as Record<string, string>).slice(0, 3).map(([key, val]) => (
                          <span key={key} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-foreground truncate max-w-[100px]">
                            {String(val)}
                          </span>
                        ))}
                      </div>
                    )}
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
