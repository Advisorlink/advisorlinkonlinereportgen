import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, Play, Trash2, Users, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

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

  async function createCampaign() {
    if (!name.trim() || !scriptId) { toast.error("Name and script are required"); return; }
    if (!phoneNumberId) { toast.error("Select a phone number to call from"); return; }
    if (contacts.length === 0) { toast.error("Add at least one contact"); return; }
    if (!user) return;

    const validContacts = contacts.filter(c => c.phone.trim());
    if (validContacts.length === 0) { toast.error("Contacts need phone numbers"); return; }

    const { data: campaign, error } = await supabase.from("ai_caller_campaigns").insert({
      user_id: user.id,
      name: name.trim(),
      script_id: scriptId,
      phone_number_id: phoneNumberId,
      total_contacts: validContacts.length,
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
    setDialogOpen(false);
    setName("");
    setScriptId("");
    setPhoneNumberId("");
    setContacts([]);
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
      toast.success(`Campaign started! ${data.callsInitiated} calls initiated, ${data.callsFailed} failed.`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to start campaign");
    } finally {
      setStarting(null);
    }
  }

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/20 text-emerald-400",
    paused: "bg-amber-500/20 text-amber-400",
    completed: "bg-cyan/20 text-cyan",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Campaigns</h2>
          <p className="text-sm text-muted-foreground">Manage your calling campaigns</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
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

              <Button onClick={createCampaign} className="w-full">Create Campaign</Button>
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
          {campaigns.map(c => (
            <Card key={c.id} className="bg-card border-border">
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-foreground">{c.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[c.status] || statusColor.draft}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.ai_caller_scripts?.name || "No script"} · {c.total_contacts} contacts · {c.calls_completed} calls · {c.leads_generated} leads
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "draft" && (
                      <Button size="sm" className="gap-1" onClick={() => startCampaign(c.id)} disabled={starting !== null}>
                        {starting === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        {starting === c.id ? "Starting..." : "Start"}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteCampaign(c.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
