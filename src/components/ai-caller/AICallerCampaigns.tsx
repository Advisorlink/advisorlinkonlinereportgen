import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Upload, Play, Trash2, Users, Loader2, Pencil, Square, Pause, RotateCcw, Clock, Gauge } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AICallerCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [scripts, setScripts] = useState<any[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [name, setName] = useState("");
  const [scriptId, setScriptId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [contacts, setContacts] = useState<{ name: string; phone: string; email: string }[]>([]);
  const [starting, setStarting] = useState<string | null>(null);

  // Pacing settings (per campaign)
  const [callsPerHour, setCallsPerHour] = useState(50);
  const [minGapSeconds, setMinGapSeconds] = useState(180);
  const [dailyStart, setDailyStart] = useState("09:00");
  const [dailyEnd, setDailyEnd] = useState("17:00");
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  // Auto-refresh while any campaign is active or paused, so the
  // progress counters and pacing info stay live.
  useEffect(() => {
    const hasLive = campaigns.some(c => c.status === "active" || c.status === "paused");
    if (!hasLive) return;
    const id = setInterval(() => { void load(); }, 15000);
    return () => clearInterval(id);
  }, [campaigns]);

  async function load() {
    setLoading(true);
    const [c, s, p] = await Promise.all([
      supabase.from("ai_caller_campaigns").select("*, ai_caller_scripts(name)").order("created_at", { ascending: false }),
      supabase.from("ai_caller_scripts").select("id, name"),
      supabase.functions.invoke("vapi-manage", { body: { action: "list-phone-numbers" } }),
    ]);
    setCampaigns(c.data || []);
    setScripts(s.data || []);
    const nums = (p.data?.phoneNumbers || []).map((n: any) => ({
      id: n.id,
      number: n.number || n.twilioPhoneNumber || "Unknown",
    }));
    setPhoneNumbers(nums);
    setLoading(false);
  }

  function handleCSV(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      const parsed: { name: string; phone: string; email: string }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        if (cols.length >= 2) {
          parsed.push({ name: cols[0] || "Unknown", phone: cols[1] || "", email: cols[2] || "" });
        }
      }
      setContacts(parsed);
      toast.success(`Parsed ${parsed.length} contacts from CSV`);
    };
    reader.readAsText(file);
  }

  function addManualContact() {
    setContacts([...contacts, { name: "", phone: "", email: "" }]);
  }

  function toggleDay(day: number) {
    setActiveDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  }

  function pacingPayload() {
    return {
      calls_per_hour: callsPerHour,
      min_gap_seconds: minGapSeconds,
      daily_start_time: dailyStart,
      daily_end_time: dailyEnd,
      active_days: activeDays,
    };
  }

  async function createCampaign() {
    if (!name.trim() || !scriptId) { toast.error("Name and script are required"); return; }
    if (!phoneNumberId) { toast.error("Select a phone number to call from"); return; }
    if (contacts.length === 0) { toast.error("Add at least one contact"); return; }
    if (activeDays.length === 0) { toast.error("Pick at least one active day"); return; }
    if (!user) return;

    const validContacts = contacts.filter(c => c.phone.trim());
    if (validContacts.length === 0) { toast.error("Contacts need phone numbers"); return; }

    const { data: campaign, error } = await supabase.from("ai_caller_campaigns").insert({
      user_id: user.id,
      name: name.trim(),
      script_id: scriptId,
      phone_number_id: phoneNumberId,
      total_contacts: validContacts.length,
      ...pacingPayload(),
    } as any).select().single();

    if (error) { toast.error(error.message); return; }

    const contactRows = validContacts.map(c => ({
      campaign_id: campaign.id,
      name: c.name || "Unknown",
      phone: c.phone.trim(),
      email: c.email || null,
    }));

    const { error: contactError } = await supabase.from("ai_caller_contacts").insert(contactRows as any);
    if (contactError) { toast.error(contactError.message); return; }

    toast.success(`Campaign created with ${validContacts.length} contacts`);
    resetDialog();
    load();
  }

  function resetDialog() {
    setDialogOpen(false);
    setEditingCampaign(null);
    setName("");
    setScriptId("");
    setPhoneNumberId("");
    setContacts([]);
    setCallsPerHour(50);
    setMinGapSeconds(180);
    setDailyStart("09:00");
    setDailyEnd("17:00");
    setActiveDays([1, 2, 3, 4, 5]);
  }

  async function openEditDialog(campaign: any) {
    setEditingCampaign(campaign);
    setName(campaign.name);
    setScriptId(campaign.script_id);
    setPhoneNumberId(campaign.phone_number_id || "");
    setCallsPerHour(campaign.calls_per_hour ?? 50);
    setMinGapSeconds(campaign.min_gap_seconds ?? 180);
    setDailyStart((campaign.daily_start_time || "09:00").slice(0, 5));
    setDailyEnd((campaign.daily_end_time || "17:00").slice(0, 5));
    setActiveDays(campaign.active_days || [1, 2, 3, 4, 5]);
    const { data } = await supabase.from("ai_caller_contacts").select("*").eq("campaign_id", campaign.id);
    setContacts((data || []).map((c: any) => ({ name: c.name, phone: c.phone, email: c.email || "" })));
    setDialogOpen(true);
  }

  async function updateCampaign() {
    if (!editingCampaign) return;
    if (!name.trim() || !scriptId) { toast.error("Name and script are required"); return; }
    if (!phoneNumberId) { toast.error("Select a phone number to call from"); return; }

    const { error } = await supabase.from("ai_caller_campaigns").update({
      name: name.trim(),
      script_id: scriptId,
      phone_number_id: phoneNumberId,
      ...pacingPayload(),
    } as any).eq("id", editingCampaign.id);

    if (error) { toast.error(error.message); return; }
    toast.success("Campaign updated");
    resetDialog();
    load();
  }

  async function deleteCampaign(id: string) {
    await supabase.from("ai_caller_campaigns").delete().eq("id", id);
    toast.success("Campaign deleted");
    load();
  }

  async function startCampaign(id: string) {
    setStarting(id);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "start-campaign", campaignId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.noPendingContacts) {
        toast.info(data.message || "No pending contacts left to call");
        load();
        return;
      }
      toast.success(
        `Campaign started — ${data.pendingContacts ?? "?"} pending. The paced ticker will dial within a minute.`
      );
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to start campaign");
    } finally {
      setStarting(null);
    }
  }

  async function stopCampaign(id: string) {
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "stop-campaign", campaignId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Campaign stopped. ${data.callsEnded || 0} active calls ended.`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to stop campaign");
    }
  }

  async function pauseCampaign(id: string) {
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "pause-campaign", campaignId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Campaign paused");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to pause campaign");
    }
  }

  async function resumeCampaign(id: string) {
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "resume-campaign", campaignId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Campaign resumed");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to resume campaign");
    }
  }

  async function resetCampaign(id: string) {
    if (!confirm("This will reset the campaign back to draft, clear all call logs for it, and reset all contacts to pending. Continue?")) return;
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "reset-campaign", campaignId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Campaign reset to draft — ready to start again");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to reset campaign");
    }
  }

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/20 text-emerald-400",
    paused: "bg-amber-500/20 text-amber-400",
    completed: "bg-cyan/20 text-cyan",
  };

  function nextCallEta(c: any): string | null {
    if (c.status !== "active") return null;
    if (!c.last_call_finished_at) return "any minute";
    const gapMs = (c.min_gap_seconds ?? 180) * 1000;
    const elapsed = Date.now() - new Date(c.last_call_finished_at).getTime();
    const remaining = Math.max(0, gapMs - elapsed);
    if (remaining <= 0) return "any minute";
    const mins = Math.ceil(remaining / 60000);
    return `in ~${mins} min`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Campaigns</h2>
          <p className="text-sm text-muted-foreground">Paced auto-dialler — set the rules, the ticker handles the rest.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingCampaign(null); setDialogOpen(true); }}><Plus className="w-4 h-4" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCampaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. March Super Review Calls" />
              </div>
              <div className="space-y-2">
                <Label>Script</Label>
                <Select value={scriptId} onValueChange={setScriptId}>
                  <SelectTrigger><SelectValue placeholder="Select a script..." /></SelectTrigger>
                  <SelectContent>
                    {scripts.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone Number (call from)</Label>
                <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
                  <SelectTrigger><SelectValue placeholder="Select a phone number..." /></SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {phoneNumbers.length === 0 && (
                  <p className="text-xs text-destructive">No phone numbers available. Buy one in the Phone Numbers tab first.</p>
                )}
              </div>

              {/* Pacing settings */}
              <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan" />
                  <Label className="text-sm">Pacing rules</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Max calls / hour</Label>
                    <Input type="number" min={1} max={500} value={callsPerHour}
                      onChange={e => setCallsPerHour(Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gap between calls (sec)</Label>
                    <Input type="number" min={0} max={3600} value={minGapSeconds}
                      onChange={e => setMinGapSeconds(Math.max(0, parseInt(e.target.value) || 0))} />
                    <p className="text-[10px] text-muted-foreground">Starts when the previous call ends.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Daily start</Label>
                    <Input type="time" value={dailyStart} onChange={e => setDailyStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Daily end</Label>
                    <Input type="time" value={dailyEnd} onChange={e => setDailyEnd(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Active days</Label>
                  <div className="flex gap-1">
                    {DOW_LABELS.map((label, idx) => {
                      const day = idx + 1;
                      const on = activeDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`px-2 py-1 text-xs rounded-md border transition ${
                            on
                              ? "bg-cyan/20 text-cyan border-cyan/40"
                              : "bg-card text-muted-foreground border-border"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Times are Australia/Sydney.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Contacts ({contacts.length})</Label>
                  <div className="flex gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleCSV(e.target.files[0])}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
                      <Upload className="w-3 h-3" /> Upload CSV
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addManualContact} className="gap-1">
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">CSV format: name, phone, email (one per row, header row optional)</p>
                {contacts.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {contacts.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <Input
                          value={c.name}
                          onChange={e => { const n = [...contacts]; n[i].name = e.target.value; setContacts(n); }}
                          placeholder="Name"
                          className="text-xs"
                        />
                        <Input
                          value={c.phone}
                          onChange={e => { const n = [...contacts]; n[i].phone = e.target.value; setContacts(n); }}
                          placeholder="Phone"
                          className="text-xs"
                        />
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setContacts(contacts.filter((_, j) => j !== i))}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {editingCampaign ? (
                <Button onClick={updateCampaign} className="w-full">Save Changes</Button>
              ) : (
                <Button onClick={createCampaign} className="w-full">Create Campaign</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : campaigns.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No campaigns yet. Create one to start calling.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const total = c.total_contacts || 0;
            const done = c.calls_completed || 0;
            const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
            const eta = nextCallEta(c);
            const days = (c.active_days || [1,2,3,4,5]).map((d:number) => DOW_LABELS[d-1]).join(", ");
            return (
              <Card key={c.id} className="bg-card border-border">
                <CardContent className="py-4 px-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{c.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[c.status] || statusColor.draft}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.ai_caller_scripts?.name || "No script"} · {done}/{total} called · {c.calls_answered || 0} answered · {c.leads_generated || 0} leads
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {c.status === "draft" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(c)}>
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button size="sm" className="gap-1" onClick={() => startCampaign(c.id)} disabled={starting !== null}>
                            {starting === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            {starting === c.id ? "Starting..." : "Start"}
                          </Button>
                        </>
                      )}
                      {c.status === "active" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(c)}>
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => pauseCampaign(c.id)}>
                            <Pause className="w-3 h-3" /> Pause
                          </Button>
                          <Button variant="destructive" size="sm" className="gap-1" onClick={() => stopCampaign(c.id)}>
                            <Square className="w-3 h-3" /> Stop
                          </Button>
                        </>
                      )}
                      {c.status === "paused" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(c)}>
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => resumeCampaign(c.id)}>
                            <Play className="w-3 h-3" /> Resume
                          </Button>
                          <Button variant="destructive" size="sm" className="gap-1" onClick={() => stopCampaign(c.id)}>
                            <Square className="w-3 h-3" /> Stop
                          </Button>
                        </>
                      )}
                      {(c.status === "completed" || c.status === "active" || c.status === "paused") && (
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => resetCampaign(c.id)}>
                          <RotateCcw className="w-3 h-3" /> Reset
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        if (confirm("Delete this campaign and all its contacts?")) deleteCampaign(c.id);
                      }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {(c.status === "active" || c.status === "paused" || c.status === "completed") && (
                    <div className="space-y-2">
                      <Progress value={pct} className="h-1.5" />
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Gauge className="w-3 h-3" />
                          {c.calls_per_hour ?? 50}/hr · {Math.round((c.min_gap_seconds ?? 180) / 60)} min gap
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(c.daily_start_time || "09:00").slice(0,5)}–{(c.daily_end_time || "17:00").slice(0,5)} · {days}
                        </span>
                        {eta && <span>Next call {eta}</span>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
