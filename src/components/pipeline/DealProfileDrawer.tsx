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
} from "lucide-react";
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
};
type DealNote = {
  id: string;
  deal_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
};

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
      setOriginalStageId(deal.stage_id);
      fetchNotes(deal.id);
    }
  }, [deal]);

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
    onOpenChange(false);
    navigate("/sms");
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
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* Hero header */}
        <div className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(215,60%,18%)] p-6 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white/90 text-sm font-medium">Client Profile</SheetTitle>
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
          {/* Stage selector */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Pipeline Stage</Label>
            <Select value={form.stage_id} onValueChange={(v) => setForm((p) => ({ ...p, stage_id: v }))}>
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
            {form.stage_id !== originalStageId && (
              <p className="text-[11px] text-cyan-600 mt-1.5">Save to move card to top of new column.</p>
            )}
          </div>

          {/* Contact details */}
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

          {/* Generate Report form */}
          <ReportStartForm
            prefill={{
              clientName: form.client_name,
              clientEmail: form.client_email,
              clientPhone: form.client_phone,
              age: form.age,
              superFundName: form.super_fund_name,
              superBalance: form.super_balance,
            }}
          />

          {/* Save + actions */}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 gradient-accent text-white border-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> Save Changes</>}
            </Button>
            <Button variant="outline" onClick={handleSendSMS} className="gap-1.5">
              <MessageSquare className="w-4 h-4" /> SMS
            </Button>
          </div>

          {/* Notes timeline */}
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
