import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  User, Mail, Phone, MapPin, DollarSign, Tag, StickyNote,
  MessageSquare, Save, Loader2, Clock, Send, Trash2, Landmark, ArrowLeft,
  ListChecks, Check, CalendarPlus, FileText, ExternalLink, Bell, Plus,
} from "lucide-react";
import { BookAppointmentDialog } from "@/components/booking/BookAppointmentDialog";

const PROGRESS_MILESTONES: { key: string; label: string }[] = [
  { key: "email_sent", label: "Email sent" },
  { key: "report_generated", label: "Report generated" },
  { key: "report_sent", label: "Report sent" },
  { key: "presentation_booked", label: "Presentation booked" },
  { key: "presentation_completed", label: "Presentation completed" },
  { key: "atc_tpa_sent", label: "ATC & TPA sent" },
  { key: "documents_received", label: "Statement / Licence received" },
  { key: "booked_stefano", label: "Booked with Stefano" },
];
import { useNavigate } from "react-router-dom";
import { ReportStartForm } from "@/components/ReportStartForm";

type Stage = { id: string; name: string; color: string; position: number };
type Deal = {
  id: string;
  stage_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  value: number | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  client_address?: string | null;
  tags?: string[] | null;
  source?: string | null;
  age?: string | null;
  super_fund_name?: string | null;
  super_balance?: number | null;
  state?: string | null;
  had_review_before?: boolean | null;
  progress_stages?: string[] | null;
};
type DealNote = {
  id: string;
  deal_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
};
type DealTask = {
  id: string;
  deal_id: string;
  title: string;
  due_at: string;
  reminder_phone: string;
  reminder_sent_at: string | null;
  reminder_error: string | null;
  completed_at: string | null;
};

const DEFAULT_REMINDER_PHONE = "0401082755";

// Convert a `datetime-local` input value (no tz) to an ISO string in the local tz
function localInputToIso(v: string): string {
  // v like "2026-06-08T14:30"; new Date interprets as local
  return new Date(v).toISOString();
}

interface DealProfileDrawerProps {
  deal: Deal | null;
  stages: Stage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealUpdated: () => void;
  onDeleteDeal: (id: string) => void;
}

export function DealProfileDrawer({ deal, stages, open, onOpenChange, onDealUpdated, onDeleteDeal }: DealProfileDrawerProps) {
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    client_address: "",
    value: "",
    notes: "",
    stage_id: "",
    source: "",
    age: "",
    super_fund_name: "",
    super_balance: "",
    state: "",
    had_review_before: "" as "" | "yes" | "no",
  });
  const [originalStageId, setOriginalStageId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<DealNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [progressSaving, setProgressSaving] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [rebookOpen, setRebookOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<{ id: string; reschedule_token: string; start_at: string; client_timezone: string } | null>(null);
  const [clientDocs, setClientDocs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskPhone, setNewTaskPhone] = useState(DEFAULT_REMINDER_PHONE);
  const [addingTask, setAddingTask] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (deal) {
      const d = deal as any;
      setForm({
        client_name: deal.client_name || "",
        client_email: deal.client_email || "",
        client_phone: deal.client_phone || "",
        client_address: d.client_address || "",
        value: deal.value != null ? String(deal.value) : "",
        notes: deal.notes || "",
        stage_id: deal.stage_id,
        source: d.source || "",
        age: d.age || "",
        super_fund_name: d.super_fund_name || "",
        super_balance: d.super_balance != null ? String(d.super_balance) : "",
        state: d.state || "",
        had_review_before: d.had_review_before === true ? "yes" : d.had_review_before === false ? "no" : "",
      });
      setProgress(Array.isArray(d.progress_stages) ? d.progress_stages : []);
      setOriginalStageId(deal.stage_id);
      fetchNotes(deal.id);
      fetchClientDocs(deal.client_email, deal.client_phone);
      fetchTasks(deal.id);
      fetchActiveBooking(deal.id);
    }
  }, [deal]);

  const fetchActiveBooking = useCallback(async (dealId: string) => {
    const { data } = await supabase
      .from("bookings")
      .select("id, reschedule_token, start_at, client_timezone")
      .eq("contact_id", dealId)
      .in("status", ["booked", "rescheduled"])
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(1);
    setActiveBooking(((data as any) || [])[0] || null);
  }, []);

  const fetchTasks = useCallback(async (dealId: string) => {
    const { data } = await supabase
      .from("deal_tasks" as any)
      .select("*")
      .eq("deal_id", dealId)
      .order("due_at", { ascending: true });
    setTasks((data as any) || []);
  }, []);

  const handleAddTask = async () => {
    if (!deal || !newTaskTitle.trim() || !newTaskDue || !newTaskPhone.trim()) {
      toast({ title: "Title, due time and phone are required", variant: "destructive" });
      return;
    }
    setAddingTask(true);
    const { error } = await supabase.from("deal_tasks" as any).insert({
      deal_id: deal.id,
      title: newTaskTitle.trim(),
      due_at: localInputToIso(newTaskDue),
      reminder_phone: newTaskPhone.trim(),
    });
    setAddingTask(false);
    if (error) {
      toast({ title: "Couldn't add task", description: error.message, variant: "destructive" });
    } else {
      setNewTaskTitle("");
      setNewTaskDue("");
      fetchTasks(deal.id);
      toast({ title: "Task scheduled — moved to Tasks Due" });
      // Refresh board so the deal visibly moves to the Tasks Due column
      try { window.dispatchEvent(new CustomEvent("pipeline:refresh")); } catch { /* noop */ }
    }
  };

  const handleToggleTask = async (t: DealTask) => {
    const completed = !t.completed_at;
    await supabase
      .from("deal_tasks" as any)
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (deal) fetchTasks(deal.id);
  };

  const handleDeleteTask = async (id: string) => {
    await supabase.from("deal_tasks" as any).delete().eq("id", id);
    if (deal) fetchTasks(deal.id);
  };

  const fetchClientDocs = useCallback(async (email?: string | null, phone?: string | null) => {
    const e = (email || "").trim().toLowerCase();
    const phoneDigits = (phone || "").replace(/\D+/g, "");
    if (!e && phoneDigits.length < 6) { setClientDocs([]); return; }

    const byId = new Map<string, any>();

    if (e) {
      const { data } = await supabase
        .from("client_documents")
        .select("*")
        .ilike("client_email", e)
        .order("created_at", { ascending: false })
        .limit(50);
      (data || []).forEach((r: any) => byId.set(r.id, r));
    }

    if (phoneDigits.length >= 6) {
      const tail = phoneDigits.slice(-9);
      const { data } = await supabase
        .from("client_documents")
        .select("*")
        .like("client_phone", `%${tail}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      (data || [])
        .filter((r: any) => (r.client_phone || "").replace(/\D+/g, "").endsWith(tail))
        .forEach((r: any) => byId.set(r.id, r));
    }

    const rows = Array.from(byId.values()).sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || "")
    );
    setClientDocs(rows);
  }, []);

  const openClientDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("client-documents").createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast({ title: "Couldn't open file", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const toggleMilestone = async (key: string) => {
    if (!deal) return;
    const next = progress.includes(key)
      ? progress.filter((k) => k !== key)
      : [...progress, key];
    setProgress(next);
    setProgressSaving(key);
    const { error } = await supabase
      .from("pipeline_deals")
      .update({ progress_stages: next } as any)
      .eq("id", deal.id);
    setProgressSaving(null);
    if (error) {
      toast({ title: "Couldn't update milestone", variant: "destructive" });
      setProgress(progress);
    } else {
      onDealUpdated();
    }
  };

  const fetchNotes = useCallback(async (dealId: string) => {
    const { data } = await supabase
      .from("pipeline_deal_notes")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });
    setNotes(data || []);
  }, []);

  const handleSave = async () => {
    if (!deal) return;
    setSaving(true);

    const stageChanged = form.stage_id !== originalStageId;

    // If stage changed, shift others in target stage down so this card appears at top
    if (stageChanged) {
      const { data: targetDeals } = await supabase
        .from("pipeline_deals")
        .select("id, position")
        .eq("stage_id", form.stage_id)
        .neq("id", deal.id);
      if (targetDeals?.length) {
        await Promise.all(
          targetDeals.map((d) =>
            supabase.from("pipeline_deals").update({ position: (d.position ?? 0) + 1 }).eq("id", d.id)
          )
        );
      }
    }

    const targetStage = stages.find((s) => s.id === form.stage_id);
    const wasLost = stages.find((s) => s.id === originalStageId)?.name.toLowerCase() === "lost";
    const nowLost = targetStage?.name.toLowerCase() === "lost";

    const updates: any = {
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || null,
      client_phone: form.client_phone.trim() || null,
      client_address: form.client_address.trim() || null,
      value: form.value ? parseFloat(form.value) : null,
      notes: form.notes.trim() || null,
      stage_id: form.stage_id,
      source: form.source.trim() || null,
      age: form.age.trim() || null,
      super_fund_name: form.super_fund_name.trim() || null,
      super_balance: form.super_balance ? parseFloat(form.super_balance) : null,
      state: form.state.trim() || null,
      had_review_before:
        form.had_review_before === "yes" ? true : form.had_review_before === "no" ? false : null,
    };
    if (stageChanged) updates.position = 0;
    if (wasLost && !nowLost) {
      updates.lost_reason_id = null;
      updates.lost_reason_note = null;
    }

    const { error } = await supabase.from("pipeline_deals").update(updates).eq("id", deal.id);
    setSaving(false);

    if (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    } else {
      toast({ title: stageChanged ? "Client moved & updated" : "Client updated" });
      setOriginalStageId(form.stage_id);
      onDealUpdated();
    }
  };

  const handleAddNote = async () => {
    if (!deal || !newNote.trim()) return;
    setAddingNote(true);
    const { error } = await supabase.from("pipeline_deal_notes").insert({
      deal_id: deal.id,
      content: newNote.trim(),
    });
    setAddingNote(false);
    if (!error) {
      setNewNote("");
      fetchNotes(deal.id);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    await supabase.from("pipeline_deal_notes").delete().eq("id", noteId);
    if (deal) fetchNotes(deal.id);
  };

  const handleSendSMS = () => {
    const phone = (form.client_phone || "").trim();
    if (!phone) {
      toast({ title: "No phone on file", variant: "destructive" });
      return;
    }
    onOpenChange(false);
    const params = new URLSearchParams({ phone });
    if (form.client_name) params.set("name", form.client_name);
    navigate(`/messages?${params.toString()}`);
  };

  const handleSendEmail = () => {
    if (!form.client_email.trim()) {
      toast({ title: "No email on file", variant: "destructive" });
      return;
    }
    window.location.href = `mailto:${form.client_email.trim()}`;
  };

  const handleCall = () => {
    if (!form.client_phone.trim()) {
      toast({ title: "No phone number on file", variant: "destructive" });
      return;
    }
    const num = form.client_phone.replace(/\s+/g, "").replace(/^\+61/, "0");
    window.location.href = `sip:${num}`;
  };


  const handleDelete = () => {
    if (!deal) return;
    onDeleteDeal(deal.id);
    onOpenChange(false);
  };

  const currentStage = stages.find((s) => s.id === form.stage_id);
  const createdDate = deal ? new Date(deal.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";

  const initials = (form.client_name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen h-[100dvh] max-w-none sm:max-w-2xl sm:h-full overflow-y-auto p-0 border-0 sm:border-l"
      >
        {/* Hero header */}
        <div className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(215,60%,18%)] p-6 pb-8">
          {/* Mobile back button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="sm:hidden inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium mb-4 -ml-1 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white/90 text-sm font-medium text-left">Client Profile</SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center text-xl font-bold text-white shadow-lg">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{form.client_name || "Unnamed"}</h2>
              {currentStage && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentStage.color }} />
                  <span className="text-sm text-white/70">{currentStage.name}</span>
                </div>
              )}
              <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Added {createdDate}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Stage selector - top */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Pipeline Stage</Label>
            <Select
              value={form.stage_id}
              onValueChange={async (v) => {
                if (!deal || v === form.stage_id) return;
                setForm((p) => ({ ...p, stage_id: v }));
                const { data: targetDeals } = await supabase
                  .from("pipeline_deals")
                  .select("id, position")
                  .eq("stage_id", v)
                  .neq("id", deal.id);
                if (targetDeals?.length) {
                  await Promise.all(
                    targetDeals.map((d) =>
                      supabase.from("pipeline_deals").update({ position: (d.position ?? 0) + 1 }).eq("id", d.id)
                    )
                  );
                }
                const wasLost = stages.find((s) => s.id === originalStageId)?.name.toLowerCase() === "lost";
                const nowLost = stages.find((s) => s.id === v)?.name.toLowerCase() === "lost";
                const updates: any = { stage_id: v, position: 0 };
                if (wasLost && !nowLost) {
                  updates.lost_reason_id = null;
                  updates.lost_reason_note = null;
                }
                const { error } = await supabase.from("pipeline_deals").update(updates).eq("id", deal.id);
                if (error) {
                  toast({ title: "Failed to move", variant: "destructive" });
                  setForm((p) => ({ ...p, stage_id: originalStageId }));
                  return;
                }
                setOriginalStageId(v);
                onDealUpdated();
                onOpenChange(false);
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes timeline - underneath stage */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Activity Notes
            </h3>
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note…"
                className="resize-none text-sm"
                rows={2}
              />
              <Button size="sm" onClick={handleAddNote} disabled={addingNote || !newNote.trim()} className="shrink-0 self-end">
                {addingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
            {notes.length === 0 && (
              <p className="text-xs text-muted-foreground/50 text-center py-3">No notes yet</p>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="group relative bg-muted/50 rounded-xl p-3 text-sm">
                  <p className="text-foreground whitespace-pre-wrap">{note.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {new Date(note.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tasks & reminders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Tasks & SMS Reminders
              </h3>
              <span className="text-[11px] text-muted-foreground">{tasks.filter(t => !t.completed_at).length} open</span>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder='e.g. Call Peter about super rollover'
                className="text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Due</Label>
                  <Input
                    type="datetime-local"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    className="text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">SMS to</Label>
                  <Input
                    value={newTaskPhone}
                    onChange={(e) => setNewTaskPhone(e.target.value)}
                    placeholder="0401082755"
                    className="text-sm mt-1"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleAddTask}
                disabled={addingTask || !newTaskTitle.trim() || !newTaskDue}
                className="w-full gap-1.5"
              >
                {addingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Task
              </Button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-2">No tasks yet</p>
            ) : (
              <div className="space-y-1.5">
                {tasks.map((t) => {
                  const due = new Date(t.due_at);
                  const overdue = !t.completed_at && !t.reminder_sent_at && due.getTime() < Date.now();
                  return (
                    <div
                      key={t.id}
                      className={`group flex items-start gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                        t.completed_at
                          ? "bg-muted/30 border-border opacity-60"
                          : overdue
                            ? "bg-destructive/5 border-destructive/30"
                            : "bg-background border-border"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTask(t)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          t.completed_at ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-foreground"
                        }`}
                      >
                        {t.completed_at && <Check className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${t.completed_at ? "line-through" : ""}`}>{t.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <Clock className="w-2.5 h-2.5" />
                          {due.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          <span>·</span>
                          <Bell className="w-2.5 h-2.5" />
                          {t.reminder_sent_at ? "SMS sent" : t.reminder_error ? "Send failed" : `SMS to ${t.reminder_phone}`}
                        </p>
                        {t.reminder_error && (
                          <p className="text-[10px] text-destructive mt-0.5 truncate">{t.reminder_error}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(t.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Contact Details
            </h3>
            <div>
              <Label htmlFor="prof-name" className="text-xs">Full Name</Label>
              <Input id="prof-name" value={form.client_name} onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prof-email" className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                <Input id="prof-email" type="email" value={form.client_email} onChange={(e) => setForm((p) => ({ ...p, client_email: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="prof-phone" className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
                <Input id="prof-phone" value={form.client_phone} onChange={(e) => setForm((p) => ({ ...p, client_phone: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="prof-age" className="text-xs">Age</Label>
                <Input id="prof-age" value={form.age} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="prof-state" className="text-xs">State</Label>
                <Input id="prof-state" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} className="mt-1" placeholder="NSW, VIC…" />
              </div>
            </div>
            <div>
              <Label htmlFor="prof-address" className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</Label>
              <Input id="prof-address" value={form.client_address} onChange={(e) => setForm((p) => ({ ...p, client_address: e.target.value }))} className="mt-1" />
            </div>
          </div>

          {/* Quick contact actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCall} disabled={!form.client_phone} className="flex-1 gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Call
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendSMS} disabled={!form.client_phone} className="flex-1 gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> SMS
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendEmail} disabled={!form.client_email} className="flex-1 gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email
            </Button>
          </div>

          {/* Book appointment */}
          <Button
            onClick={() => setBookOpen(true)}
            disabled={!form.client_email}
            className="w-full gap-2 gradient-accent text-white border-0 shadow-lg shadow-cyan/20 h-11"
          >
            <CalendarPlus className="w-4 h-4" /> Book Appointment / Presentation
          </Button>
          <BookAppointmentDialog
            open={bookOpen}
            onOpenChange={setBookOpen}
            prefill={{ clientName: form.client_name, clientEmail: form.client_email, clientPhone: form.client_phone }}
            dealId={deal?.id || null}
            onBooked={() => { onDealUpdated(); setBookOpen(false); if (deal) fetchActiveBooking(deal.id); }}
          />

          {activeBooking && (
            <>
              <Button
                variant="outline"
                onClick={() => setRebookOpen(true)}
                className="w-full gap-2 h-11 border-cyan/40 text-cyan hover:bg-cyan/10"
              >
                <CalendarPlus className="w-4 h-4" />
                Rebook Appointment ({new Date(activeBooking.start_at).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: activeBooking.client_timezone })})
              </Button>
              <BookAppointmentDialog
                open={rebookOpen}
                onOpenChange={setRebookOpen}
                prefill={{ clientName: form.client_name, clientEmail: form.client_email, clientPhone: form.client_phone }}
                dealId={deal?.id || null}
                rescheduleToken={activeBooking.reschedule_token}
                onBooked={() => { onDealUpdated(); setRebookOpen(false); if (deal) fetchActiveBooking(deal.id); }}
              />
            </>
          )}






          {/* Superannuation */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" /> Superannuation
            </h3>
            <div>
              <Label htmlFor="prof-fund" className="text-xs">Super Fund Name</Label>
              <Input id="prof-fund" value={form.super_fund_name} onChange={(e) => setForm((p) => ({ ...p, super_fund_name: e.target.value }))} className="mt-1" placeholder="AustralianSuper, Hostplus…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prof-balance" className="text-xs">Super Balance ($)</Label>
                <Input id="prof-balance" type="number" step="0.01" value={form.super_balance} onChange={(e) => setForm((p) => ({ ...p, super_balance: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="prof-review" className="text-xs">Reviewed Before?</Label>
                <Select value={form.had_review_before} onValueChange={(v) => setForm((p) => ({ ...p, had_review_before: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Deal info */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Deal Info
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prof-value" className="text-xs">Deal Value ($)</Label>
                <Input id="prof-value" type="number" step="0.01" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="prof-source" className="text-xs flex items-center gap-1"><Tag className="w-3 h-3" /> Source</Label>
                <Input id="prof-source" value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} className="mt-1" placeholder="Referral, Website…" />
              </div>
            </div>
            <div>
              <Label htmlFor="prof-notes" className="text-xs flex items-center gap-1"><StickyNote className="w-3 h-3" /> Quick Notes</Label>
              <Textarea id="prof-notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1 resize-none" rows={2} />
            </div>
          </div>

          {/* Client Documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Client Documents
              </h3>
              <span className="text-[11px] text-muted-foreground">{clientDocs.length}</span>
            </div>
            {clientDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-3 border border-dashed border-border rounded-lg">
                No documents yet. Signed ATCs and uploads appear here automatically.
              </p>
            ) : (
              <div className="grid gap-1.5 max-h-56 overflow-y-auto">
                {clientDocs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => openClientDoc(d.file_path)}
                    className="group flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 px-2.5 py-2 text-left transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-background flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{d.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(d.document_type || "document").replace(/_/g, " ")} · {new Date(d.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>


          {/* Generate Report form */}
          <ReportStartForm
            prefill={{
              clientName: form.client_name,
              clientEmail: form.client_email,
              clientPhone: form.client_phone,
              age: form.age,
              superFundName: form.super_fund_name,
              superBalance: form.super_balance,
              state: form.state,
              hadReviewBefore: form.had_review_before || null,
              notes: form.notes,
              leadSource: form.source,
            }}
          />

          {/* Process progress milestones - bottom */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5" /> Process Progress
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {progress.length}/{PROGRESS_MILESTONES.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROGRESS_MILESTONES.map((m) => {
                const done = progress.includes(m.key);
                const busy = progressSaving === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMilestone(m.key)}
                    disabled={busy}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-60 ${
                      done
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : done ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-current opacity-40" />
                    )}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save + actions */}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 gradient-accent text-white border-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> Save Changes</>}
            </Button>
            <Button variant="outline" onClick={handleSendSMS} className="gap-1.5">
              <MessageSquare className="w-4 h-4" /> SMS
            </Button>
          </div>

          {/* Delete deal */}
          <div className="pt-4 border-t border-border/30">
            <Button variant="ghost" onClick={handleDelete} className="w-full text-destructive hover:bg-destructive/10 gap-1.5">
              <Trash2 className="w-4 h-4" /> Delete Deal
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
