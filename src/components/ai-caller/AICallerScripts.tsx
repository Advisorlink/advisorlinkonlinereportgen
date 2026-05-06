import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, Play, Volume2, Pencil, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Question {
  id: string;
  question: string;
  fieldName: string;
}

interface Script {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  first_message: string;
  second_message: string;
  questions: Question[];
  closing_statements: string;
  voice_id: string;
  voice_provider: string;
  background_sound: string | null;
  background_sound_enabled: boolean;
  model: string;
  max_duration_seconds: number;
  call_direction: string;
  created_at: string;
}

const VOICES = [
  { id: "voice1", name: "Adam", accent: "Australian", gender: "Male" },
  { id: "voice2", name: "Damien", accent: "Australian", gender: "Male" },
  { id: "voice3", name: "Emily", accent: "Australian", gender: "Female" },
  { id: "voice4", name: "Marcus", accent: "Australian", gender: "Male" },
  { id: "voice5", name: "Lachlan", accent: "Australian", gender: "Male" },
  { id: "voice6", name: "Declan", accent: "Australian", gender: "Male" },
  { id: "voice7", name: "Ryan", accent: "Australian", gender: "Male" },
];

const SCRIPT_SETUP_DRAFT_KEY = "ai-caller-script-setup-draft";

type ScriptSetupDraft = {
  dialogOpen: boolean;
  editingScriptId: string | null;
  directionFilter: "outbound" | "inbound";
  name: string;
  description: string;
  callDirection: "outbound" | "inbound";
  systemPrompt: string;
  firstMessage: string;
  followUpStatements: string[];
  questions: Question[];
  closingStatements: string[];
  voiceId: string;
  bgSound: string;
  bgEnabled: boolean;
  maxDuration: number;
};

function parseFollowUps(secondMessage: string | null | undefined): string[] {
  if (!secondMessage) return [""];
  try {
    const parsed = JSON.parse(secondMessage);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch { /* not JSON, treat as single statement */ }
  return [secondMessage];
}

function serializeFollowUps(statements: string[]): string {
  const filtered = statements.filter(s => s.trim());
  if (filtered.length === 0) return "";
  return JSON.stringify(filtered);
}

export function AICallerScripts() {
  const { user } = useAuth();
  const savedDraft = useRef<ScriptSetupDraft | null>(null);
  if (savedDraft.current === null && typeof window !== "undefined") {
    try {
      savedDraft.current = JSON.parse(sessionStorage.getItem(SCRIPT_SETUP_DRAFT_KEY) || "null");
    } catch {
      savedDraft.current = null;
    }
  }
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(savedDraft.current?.dialogOpen ?? false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [directionFilter, setDirectionFilter] = useState<"outbound" | "inbound">(savedDraft.current?.directionFilter ?? "outbound");

  const [name, setName] = useState(savedDraft.current?.name ?? "");
  const [description, setDescription] = useState(savedDraft.current?.description ?? "");
  const [callDirection, setCallDirection] = useState<"outbound" | "inbound">(savedDraft.current?.callDirection ?? "outbound");
  const [systemPrompt, setSystemPrompt] = useState(savedDraft.current?.systemPrompt ?? "You are a friendly Australian financial advisor assistant calling potential clients to discuss their superannuation options.");
  const [firstMessage, setFirstMessage] = useState(savedDraft.current?.firstMessage ?? "G'day! My name is Sarah and I'm calling from Advisor Link. How are you today?");
  const [followUpStatements, setFollowUpStatements] = useState<string[]>(savedDraft.current?.followUpStatements ?? [
    "Great to hear! The reason for my call today is to let you know about a free superannuation review we're offering. It only takes a few minutes and could save you thousands. Would you mind if I asked you a couple of quick questions?"
  ]);
  const [questions, setQuestions] = useState<Question[]>(savedDraft.current?.questions ?? [
    { id: crypto.randomUUID(), question: "What is your current super fund?", fieldName: "super_fund" },
    { id: crypto.randomUUID(), question: "Do you know roughly what your super balance is?", fieldName: "super_balance" },
    { id: crypto.randomUUID(), question: "Have you ever had your super review before?", fieldName: "had_review" },
  ]);
  const [closingStatements, setClosingStatements] = useState<string[]>(savedDraft.current?.closingStatements ?? [
    "Thank you so much for your time today! We'll have one of our advisors reach out to you shortly to arrange your free review."
  ]);
  const [voiceId, setVoiceId] = useState(savedDraft.current?.voiceId ?? "sarah");
  const [bgSound, setBgSound] = useState(savedDraft.current?.bgSound ?? "office");
  const [bgEnabled, setBgEnabled] = useState(savedDraft.current?.bgEnabled ?? true);
  const [maxDuration, setMaxDuration] = useState(savedDraft.current?.maxDuration ?? 300);

  useEffect(() => { loadScripts(); }, []);

  useEffect(() => {
    const editingScriptId = savedDraft.current?.editingScriptId;
    if (!editingScriptId || editingScript || scripts.length === 0) return;
    const script = scripts.find(s => s.id === editingScriptId);
    if (script) setEditingScript(script);
  }, [editingScript, scripts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!dialogOpen) {
      sessionStorage.removeItem(SCRIPT_SETUP_DRAFT_KEY);
      return;
    }

    const draft: ScriptSetupDraft = {
      dialogOpen,
      editingScriptId: editingScript?.id ?? savedDraft.current?.editingScriptId ?? null,
      directionFilter,
      name,
      description,
      callDirection,
      systemPrompt,
      firstMessage,
      followUpStatements,
      questions,
      closingStatements,
      voiceId,
      bgSound,
      bgEnabled,
      maxDuration,
    };

    sessionStorage.setItem(SCRIPT_SETUP_DRAFT_KEY, JSON.stringify(draft));
    savedDraft.current = draft;
  }, [bgEnabled, bgSound, callDirection, closingStatements, description, dialogOpen, directionFilter, editingScript, firstMessage, maxDuration, name, questions, followUpStatements, systemPrompt, voiceId]);

  async function loadScripts() {
    setLoading(true);
    const { data } = await supabase
      .from("ai_caller_scripts")
      .select("*")
      .order("created_at", { ascending: false });
    setScripts((data || []).map((s: any) => ({ ...s, questions: s.questions || [] })));
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setDescription("");
    setCallDirection(directionFilter);
    setSystemPrompt("You are a friendly Australian financial advisor assistant calling potential clients to discuss their superannuation options.");
    setFirstMessage("G'day! My name is Sarah and I'm calling from Advisor Link. How are you today?");
    setFollowUpStatements(["Great to hear! The reason for my call today is to let you know about a free superannuation review we're offering. It only takes a few minutes and could save you thousands. Would you mind if I asked you a couple of quick questions?"]);
    setQuestions([
      { id: crypto.randomUUID(), question: "What is your current super fund?", fieldName: "super_fund" },
      { id: crypto.randomUUID(), question: "Do you know roughly what your super balance is?", fieldName: "super_balance" },
      { id: crypto.randomUUID(), question: "Have you ever had your super reviewed before?", fieldName: "had_review" },
    ]);
    setClosingStatements(["Thank you so much for your time today! We'll have one of our advisors reach out to you shortly to arrange your free review."]);
    setVoiceId("sarah");
    setBgSound("office");
    setBgEnabled(true);
    setMaxDuration(300);
    setEditingScript(null);
  }

  function clearSavedDraft() {
    savedDraft.current = null;
    if (typeof window !== "undefined") sessionStorage.removeItem(SCRIPT_SETUP_DRAFT_KEY);
  }

  function openEdit(script: Script) {
    clearSavedDraft();
    setEditingScript(script);
    setName(script.name);
    setDescription(script.description || "");
    setCallDirection((script.call_direction as "outbound" | "inbound") || "outbound");
    setSystemPrompt(script.system_prompt);
    setFirstMessage(script.first_message);
    setFollowUpStatements(parseFollowUps(script.second_message));
    setQuestions(script.questions.length > 0 ? script.questions : []);
    setClosingStatements(parseFollowUps(script.closing_statements));
    setVoiceId(script.voice_id);
    setBgSound(script.background_sound || "office");
    setBgEnabled(script.background_sound_enabled);
    setMaxDuration(script.max_duration_seconds);
    setDialogOpen(true);
  }

  function addQuestion() {
    setQuestions([...questions, { id: crypto.randomUUID(), question: "", fieldName: "" }]);
  }

  function removeQuestion(id: string) {
    setQuestions(questions.filter(q => q.id !== id));
  }

  function updateQuestion(id: string, field: "question" | "fieldName", value: string) {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  }

  async function saveScript() {
    if (!name.trim()) { toast.error("Script name is required"); return; }
    if (!user) return;

    const payload = {
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      call_direction: callDirection,
      system_prompt: systemPrompt,
      first_message: firstMessage,
      second_message: serializeFollowUps(followUpStatements),
      questions: questions.filter(q => q.question && q.fieldName).map(q => ({ id: q.id, question: q.question, fieldName: q.fieldName })) as any,
      closing_statements: serializeFollowUps(closingStatements),
      voice_id: voiceId,
      voice_provider: "elevenlabs",
      background_sound: bgSound,
      background_sound_enabled: bgEnabled,
      model: "gpt-4o",
      max_duration_seconds: maxDuration,
    };

    if (editingScript) {
      const { error } = await supabase.from("ai_caller_scripts").update(payload).eq("id", editingScript.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Script updated");
    } else {
      const { error } = await supabase.from("ai_caller_scripts").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Script created");
    }

    setDialogOpen(false);
    resetForm();
    loadScripts();
  }

  async function deleteScript(id: string) {
    await supabase.from("ai_caller_scripts").delete().eq("id", id);
    toast.success("Script deleted");
    loadScripts();
  }

  function cloneScript(script: Script) {
    clearSavedDraft();
    setEditingScript(null);
    setName(`${script.name} (Copy)`);
    setDescription(script.description || "");
    setCallDirection((script.call_direction as "outbound" | "inbound") || "outbound");
    setSystemPrompt(script.system_prompt);
    setFirstMessage(script.first_message);
    setFollowUpStatements(parseFollowUps(script.second_message));
    setQuestions(script.questions.map(q => ({ ...q, id: crypto.randomUUID() })));
    setClosingStatements(parseFollowUps(script.closing_statements));
    setVoiceId(script.voice_id);
    setBgSound(script.background_sound || "office");
    setBgEnabled(script.background_sound_enabled);
    setMaxDuration(script.max_duration_seconds);
    setDialogOpen(true);
  }

  const filteredScripts = scripts.filter(s => (s.call_direction || "outbound") === directionFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Call Scripts</h2>
          <p className="text-sm text-muted-foreground">Define what your AI caller says and asks</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { clearSavedDraft(); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Script</Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-2xl max-h-[85vh] overflow-y-auto"
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{editingScript ? "Edit Script" : "Create Script"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              {/* Load from existing script */}
              {!editingScript && scripts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Load from existing script</Label>
                  <Select onValueChange={(id) => {
                    const s = scripts.find(sc => sc.id === id);
                    if (!s) return;
                    setName(`${s.name} (Copy)`);
                    setDescription(s.description || "");
                    setCallDirection((s.call_direction as "outbound" | "inbound") || "outbound");
                    setSystemPrompt(s.system_prompt);
                    setFirstMessage(s.first_message);
                    setFollowUpStatements(parseFollowUps(s.second_message));
                    setQuestions(s.questions.map(q => ({ ...q, id: crypto.randomUUID() })));
                    setClosingStatements(parseFollowUps(s.closing_statements));
                    setVoiceId(s.voice_id);
                    setBgSound(s.background_sound || "office");
                    setBgEnabled(s.background_sound_enabled);
                    setMaxDuration(s.max_duration_seconds);
                    toast.success("Script loaded — edit and save as new");
                  }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Load an existing script as a starting point..." />
                    </SelectTrigger>
                    <SelectContent>
                      {scripts.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {(s.call_direction || "outbound") === "inbound" ? "(Inbound)" : "(Outbound)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Direction selector */}
              <div className="space-y-2">
                <Label>Call Direction</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={callDirection === "outbound" ? "default" : "outline"}
                    size="sm"
                    className="gap-2 flex-1"
                    onClick={() => setCallDirection("outbound")}
                  >
                    <PhoneOutgoing className="w-3.5 h-3.5" /> Outbound
                  </Button>
                  <Button
                    type="button"
                    variant={callDirection === "inbound" ? "default" : "outline"}
                    size="sm"
                    className="gap-2 flex-1"
                    onClick={() => setCallDirection("inbound")}
                  >
                    <PhoneIncoming className="w-3.5 h-3.5" /> Inbound
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {callDirection === "inbound"
                    ? "This script runs when someone calls your number. Assign it to a phone number in the Numbers tab."
                    : "This script is used for outbound campaigns calling leads."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Script Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Super Review Intro" />
                </div>
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Select value={voiceId} onValueChange={setVoiceId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VOICES.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} — {v.accent} ({v.gender})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." />
              </div>

              <div className="space-y-2">
                <Label>{callDirection === "inbound" ? "Greeting Message" : "Opening Message"}</Label>
                <Textarea
                  value={firstMessage}
                  onChange={e => setFirstMessage(e.target.value)}
                  rows={2}
                  placeholder={callDirection === "inbound"
                    ? "e.g. G'day! Thanks for calling Advisor Link. How can I help you today?"
                    : "What does the AI say first?"}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Follow-Up Statements</Label>
                    <p className="text-xs text-muted-foreground">Said after the client responds, before questions begin. Add as many as needed.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setFollowUpStatements([...followUpStatements, ""])} className="gap-1 shrink-0">
                    <Plus className="w-3 h-3" /> Add Statement
                  </Button>
                </div>
                {followUpStatements.map((stmt, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                    <span className="text-xs text-muted-foreground mt-2.5 font-mono w-5 shrink-0">{i + 1}.</span>
                    <Textarea
                      value={stmt}
                      onChange={e => {
                        const updated = [...followUpStatements];
                        updated[i] = e.target.value;
                        setFollowUpStatements(updated);
                      }}
                      rows={2}
                      placeholder={`Follow-up statement ${i + 1}...`}
                      className="flex-1"
                    />
                    {followUpStatements.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 mt-1"
                        onClick={() => setFollowUpStatements(followUpStatements.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>System Prompt / Personality</Label>
                <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={4} placeholder="Define how the AI should behave..." />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Questions to Ask</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="gap-1">
                    <Plus className="w-3 h-3" /> Add Question
                  </Button>
                </div>
                {questions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                    <span className="text-xs text-muted-foreground mt-2.5 font-mono w-5 shrink-0">{i + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={q.question}
                        onChange={e => updateQuestion(q.id, "question", e.target.value)}
                        placeholder="e.g. What is your current super fund?"
                      />
                      <Input
                        value={q.fieldName}
                        onChange={e => updateQuestion(q.id, "fieldName", e.target.value.replace(/\s/g, "_").toLowerCase())}
                        placeholder="field_name (e.g. super_fund)"
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 mt-1" onClick={() => removeQuestion(q.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Closing Statements */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Closing Statements</Label>
                    <p className="text-xs text-muted-foreground">Script for the AI to follow when closing the call. Add as many as needed.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setClosingStatements([...closingStatements, ""])} className="gap-1 shrink-0">
                    <Plus className="w-3 h-3" /> Add Statement
                  </Button>
                </div>
                {closingStatements.map((stmt, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                    <span className="text-xs text-muted-foreground mt-2.5 font-mono w-5 shrink-0">{i + 1}.</span>
                    <Textarea
                      value={stmt}
                      onChange={e => {
                        const updated = [...closingStatements];
                        updated[i] = e.target.value;
                        setClosingStatements(updated);
                      }}
                      rows={2}
                      placeholder={`Closing statement ${i + 1}...`}
                      className="flex-1"
                    />
                    {closingStatements.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 mt-1"
                        onClick={() => setClosingStatements(closingStatements.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Office Background Sound</Label>
                    <Switch checked={bgEnabled} onCheckedChange={setBgEnabled} />
                  </div>
                  {bgEnabled && (
                    <Select value={bgSound} onValueChange={setBgSound}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="off">Silent</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Max Call Duration (seconds)</Label>
                  <Input type="number" value={maxDuration} onChange={e => setMaxDuration(Number(e.target.value))} min={60} max={1800} />
                </div>
              </div>

              <Button onClick={saveScript} className="w-full">
                {editingScript ? "Update Script" : "Create Script"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Direction filter tabs */}
      <div className="flex gap-2">
        <Button
          variant={directionFilter === "outbound" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setDirectionFilter("outbound")}
        >
          <PhoneOutgoing className="w-3.5 h-3.5" /> Outbound Scripts
        </Button>
        <Button
          variant={directionFilter === "inbound" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setDirectionFilter("inbound")}
        >
          <PhoneIncoming className="w-3.5 h-3.5" /> Inbound Scripts
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading scripts...</div>
      ) : filteredScripts.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            {directionFilter === "inbound" ? (
              <>
                <PhoneIncoming className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-1">No inbound scripts yet</p>
                <p className="text-xs text-muted-foreground">Create an inbound script so your AI answers when clients call your number</p>
              </>
            ) : (
              <>
                <Phone className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No outbound scripts yet. Create one to get started.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredScripts.map(s => (
            <Card key={s.id} className="bg-card border-border hover:border-cyan/30 transition-colors">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {(s.call_direction || "outbound") === "inbound" ? (
                      <PhoneIncoming className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <PhoneOutgoing className="w-4 h-4 text-cyan shrink-0" />
                    )}
                    <div>
                      <h3 className="font-semibold text-foreground">{s.name}</h3>
                      {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Clone" onClick={() => cloneScript(s)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteScript(s.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan/20 text-cyan font-medium">
                    {VOICES.find(v => v.id === s.voice_id)?.name || s.voice_id}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    {(s.questions as Question[]).length} questions
                  </span>
                  {s.background_sound_enabled && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex items-center gap-1">
                      <Volume2 className="w-2.5 h-2.5" /> Office BG
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
