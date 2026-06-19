import { useState, useEffect, useCallback } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, applyEdgeChanges, applyNodeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
  Handle, Position, ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CRMLayout } from "@/components/CRMLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Workflow as WorkflowIcon, Plus, Trash2, Mail, MessageSquare, Clock, GitBranch,
  Zap, ArrowLeft, Save, Play, ChevronRight,
} from "lucide-react";

type Workflow = {
  id: string; name: string; description: string | null;
  trigger_type: string; trigger_config: Record<string, unknown>;
  graph: { nodes: Node[]; edges: Edge[] };
  is_active: boolean; created_at: string; updated_at: string;
};

type WorkflowRun = {
  id: string; workflow_id: string; status: string;
  client_name: string | null; client_email: string | null;
  created_at: string; completed_at: string | null;
  current_node_id: string | null; error: string | null;
};

const TRIGGERS = [
  { value: "report_generated", label: "Report generated" },
  { value: "report_sent", label: "Report sent" },
  { value: "pipeline_stage_changed", label: "Pipeline stage changed" },
  { value: "booking_created", label: "Booking created" },
  { value: "booking_rescheduled", label: "Booking rescheduled" },
  { value: "booking_cancelled", label: "Booking cancelled" },
];

// ---------- Custom node renderers ----------
function NodeShell({ icon: Icon, title, subtitle, color, children, target = true, source = true }: {
  icon: React.ElementType; title: string; subtitle?: string; color: string;
  children?: React.ReactNode; target?: boolean; source?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm min-w-[200px]">
      {target && <Handle type="target" position={Position.Top} style={{ background: "#0ea5e9" }} />}
      <div className={`flex items-center gap-2 px-3 py-2 border-b rounded-t-xl ${color}`}>
        <Icon className="w-4 h-4 text-white" />
        <div className="text-xs font-semibold text-white">{title}</div>
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground">{subtitle}</div>
      {children}
      {source && <Handle type="source" position={Position.Bottom} style={{ background: "#0ea5e9" }} />}
    </div>
  );
}

const nodeTypes = {
  trigger: ({ data }: { data: { triggerType?: string } }) => (
    <NodeShell icon={Zap} title="When" subtitle={TRIGGERS.find(t => t.value === data.triggerType)?.label ?? "Pick a trigger"} color="bg-emerald-600" target={false} />
  ),
  email: ({ data }: { data: { subject?: string } }) => (
    <NodeShell icon={Mail} title="Send Email" subtitle={data.subject || "(no subject)"} color="bg-blue-600" />
  ),
  sms: ({ data }: { data: { body?: string } }) => (
    <NodeShell icon={MessageSquare} title="Send SMS" subtitle={(data.body || "(no body)").slice(0, 60)} color="bg-violet-600" />
  ),
  wait: ({ data }: { data: { amount?: number; unit?: string } }) => (
    <NodeShell icon={Clock} title="Wait" subtitle={`${data.amount ?? 1} ${data.unit ?? "minutes"}`} color="bg-amber-600" />
  ),
  condition: ({ data }: { data: { field?: string; equals?: string } }) => (
    <div className="rounded-xl border bg-card shadow-sm min-w-[220px]">
      <Handle type="target" position={Position.Top} style={{ background: "#0ea5e9" }} />
      <div className="flex items-center gap-2 px-3 py-2 border-b rounded-t-xl bg-orange-600">
        <GitBranch className="w-4 h-4 text-white" />
        <div className="text-xs font-semibold text-white">If</div>
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {data.field || "field"} = {data.equals || "value"}
      </div>
      <div className="flex justify-between px-3 pb-2 text-[10px]">
        <span className="text-emerald-600 font-semibold">Yes</span>
        <span className="text-red-600 font-semibold">No</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ background: "#10b981", left: "25%" }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ background: "#ef4444", left: "75%" }} />
    </div>
  ),
  end: () => (
    <div className="rounded-full border bg-slate-200 dark:bg-slate-800 px-4 py-2 text-xs font-semibold">
      <Handle type="target" position={Position.Top} style={{ background: "#0ea5e9" }} />
      End
    </div>
  ),
};

// ---------- Builder ----------
function Builder({ workflow, onBack, onSaved }: { workflow: Workflow; onBack: () => void; onSaved: (w: Workflow) => void }) {
  const [name, setName] = useState(workflow.name);
  const [triggerType, setTriggerType] = useState(workflow.trigger_type);
  const [isActive, setIsActive] = useState(workflow.is_active);
  const [nodes, setNodes] = useState<Node[]>(workflow.graph?.nodes ?? []);
  const [edges, setEdges] = useState<Edge[]>(workflow.graph?.edges ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!nodes.find(n => n.id === "trigger")) {
      setNodes((nds) => [
        { id: "trigger", type: "trigger", position: { x: 250, y: 40 }, data: { triggerType } },
        ...nds,
      ]);
    }
  }, []);

  useEffect(() => {
    setNodes((nds) => nds.map(n => n.id === "trigger" ? { ...n, data: { ...n.data, triggerType } } : n));
  }, [triggerType]);

  const onNodesChange = useCallback((c: NodeChange[]) => setNodes(nds => applyNodeChanges(c, nds)), []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges(eds => applyEdgeChanges(c, eds)), []);
  const onConnect = useCallback((c: Connection) => setEdges(eds => addEdge({ ...c, animated: true }, eds)), []);

  const addNode = (type: string) => {
    const id = `${type}_${Date.now()}`;
    const defaultData: Record<string, Record<string, unknown>> = {
      email: { subject: "Hi {{client_name}}", heading: "Update", body: "Hi {{client_name}},\n\nQuick update...\n\nTravis", ctaLabel: "", ctaUrl: "" },
      sms: { body: "Hi {{client_name}}, quick note from Travis." },
      wait: { amount: 1, unit: "hours" },
      condition: { field: "client_phone", equals: "" },
      end: {},
    };
    setNodes(nds => [...nds, {
      id, type,
      position: { x: 250, y: 120 + nds.length * 90 },
      data: defaultData[type] ?? {},
    }]);
  };

  const selected = nodes.find(n => n.id === selectedId);
  const updateSelectedData = (patch: Record<string, unknown>) => {
    setNodes(nds => nds.map(n => n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n));
  };
  const deleteSelected = () => {
    if (!selectedId || selectedId === "trigger") return;
    setNodes(nds => nds.filter(n => n.id !== selectedId));
    setEdges(eds => eds.filter(e => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const save = async () => {
    const { data, error } = await supabase.from("workflows").update({
      name, trigger_type: triggerType, is_active: isActive,
      graph: { nodes, edges },
    } as never).eq("id", workflow.id).select().single();
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved" });
    onSaved(data as unknown as Workflow);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-card">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <Input value={name} onChange={e => setName(e.target.value)} className="max-w-sm font-semibold" />
        <Select value={triggerType} onValueChange={setTriggerType}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm">{isActive ? "Active" : "Inactive"}</span>
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={save}><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="w-56 border-r bg-muted/30 p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Add step</div>
          <Button variant="outline" className="w-full justify-start" onClick={() => addNode("email")}><Mail className="w-4 h-4 mr-2" />Email</Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => addNode("sms")}><MessageSquare className="w-4 h-4 mr-2" />SMS</Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => addNode("wait")}><Clock className="w-4 h-4 mr-2" />Wait</Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => addNode("condition")}><GitBranch className="w-4 h-4 mr-2" />If / Then</Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => addNode("end")}>End</Button>
          <div className="text-[11px] text-muted-foreground mt-4">
            Use <code className="bg-muted px-1 rounded">{"{{client_name}}"}</code>, <code className="bg-muted px-1 rounded">{"{{client_email}}"}</code>, <code className="bg-muted px-1 rounded">{"{{meeting_link}}"}</code>, <code className="bg-muted px-1 rounded">{"{{date}}"}</code>, <code className="bg-muted px-1 rounded">{"{{time}}"}</code>.
          </div>
        </div>

        <div className="flex-1">
          <ReactFlow
            nodes={nodes} edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            fitView
          >
            <Background gap={16} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
          <SheetContent className="w-96">
            <SheetHeader><SheetTitle>{selected?.type} settings</SheetTitle></SheetHeader>
            {selected?.type === "email" && (
              <div className="space-y-3 mt-4">
                <div><Label>Subject</Label><Input value={(selected.data.subject as string) ?? ""} onChange={e => updateSelectedData({ subject: e.target.value })} /></div>
                <div><Label>Heading</Label><Input value={(selected.data.heading as string) ?? ""} onChange={e => updateSelectedData({ heading: e.target.value })} /></div>
                <div><Label>Body</Label><Textarea rows={6} value={(selected.data.body as string) ?? ""} onChange={e => updateSelectedData({ body: e.target.value })} /></div>
                <div><Label>Button label (optional)</Label><Input value={(selected.data.ctaLabel as string) ?? ""} onChange={e => updateSelectedData({ ctaLabel: e.target.value })} /></div>
                <div><Label>Button URL (optional)</Label><Input value={(selected.data.ctaUrl as string) ?? ""} onChange={e => updateSelectedData({ ctaUrl: e.target.value })} /></div>
              </div>
            )}
            {selected?.type === "sms" && (
              <div className="space-y-3 mt-4">
                <div><Label>Message</Label><Textarea rows={5} value={(selected.data.body as string) ?? ""} onChange={e => updateSelectedData({ body: e.target.value })} /></div>
              </div>
            )}
            {selected?.type === "wait" && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div><Label>Amount</Label><Input type="number" value={(selected.data.amount as number) ?? 1} onChange={e => updateSelectedData({ amount: Number(e.target.value) })} /></div>
                <div><Label>Unit</Label>
                  <Select value={(selected.data.unit as string) ?? "minutes"} onValueChange={v => updateSelectedData({ unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Seconds</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {selected?.type === "condition" && (
              <div className="space-y-3 mt-4">
                <div><Label>Field name</Label><Input value={(selected.data.field as string) ?? ""} onChange={e => updateSelectedData({ field: e.target.value })} placeholder="e.g. stage_name" /></div>
                <div><Label>Equals</Label><Input value={(selected.data.equals as string) ?? ""} onChange={e => updateSelectedData({ equals: e.target.value })} /></div>
                <div className="text-xs text-muted-foreground">Connect the green "Yes" handle and red "No" handle to different paths.</div>
              </div>
            )}
            {selected && selected.id !== "trigger" && (
              <Button variant="destructive" className="w-full mt-6" onClick={deleteSelected}>
                <Trash2 className="w-4 h-4 mr-2" />Delete step
              </Button>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

// ---------- List ----------
function WorkflowList({ onOpen }: { onOpen: (w: Workflow) => void }) {
  const [items, setItems] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);

  const load = async () => {
    const { data } = await supabase.from("workflows").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as unknown as Workflow[]);
    const { data: r } = await supabase.from("workflow_runs").select("*").order("created_at", { ascending: false }).limit(20);
    setRuns((r ?? []) as unknown as WorkflowRun[]);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const { data, error } = await supabase.from("workflows").insert({
      name: "New automation",
      trigger_type: "report_sent",
      graph: { nodes: [], edges: [] },
    } as never).select().single();
    if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
    onOpen(data as unknown as Workflow);
  };

  const toggleActive = async (w: Workflow) => {
    await supabase.from("workflows").update({ is_active: !w.is_active } as never).eq("id", w.id);
    load();
  };
  const remove = async (w: Workflow) => {
    if (!confirm(`Delete "${w.name}"?`)) return;
    await supabase.from("workflows").delete().eq("id", w.id);
    load();
  };

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><WorkflowIcon className="w-7 h-7 text-cyan" />Automations</h1>
          <p className="text-muted-foreground mt-1">Build drag-and-drop workflows that trigger on events.</p>
        </div>
        <Button onClick={create}><Plus className="w-4 h-4 mr-2" />New automation</Button>
      </div>

      <div className="grid gap-3">
        {items.length === 0 && <Card className="p-10 text-center text-muted-foreground">No automations yet. Click "New automation" to get started.</Card>}
        {items.map(w => (
          <Card key={w.id} className="p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onOpen(w)}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <WorkflowIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{w.name}</div>
              <div className="text-xs text-muted-foreground">Trigger: {TRIGGERS.find(t => t.value === w.trigger_type)?.label ?? w.trigger_type}</div>
            </div>
            <Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Active" : "Inactive"}</Badge>
            <Switch checked={w.is_active} onCheckedChange={() => toggleActive(w)} onClick={e => e.stopPropagation()} />
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(w); }}><Trash2 className="w-4 h-4" /></Button>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Card>
        ))}
      </div>

      {runs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Play className="w-4 h-4" />Recent runs</h2>
          <Card className="divide-y">
            {runs.map(r => (
              <div key={r.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge>
                <span className="font-medium">{r.client_name || r.client_email || "(no client)"}</span>
                <span className="text-muted-foreground text-xs ml-auto">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <SheetLeadSyncEditor />
      <BookingTemplatesEditor />
    </div>
  );
}

// ---------- Google Sheet → New Lead sync ----------
type SyncCfg = {
  id: number;
  spreadsheet_id: string;
  sheet_name: string;
  header_row: number;
  target_stage_name: string;
  source_tag: string;
  source_label: string;
  is_active: boolean;
  last_synced_at: string | null;
  last_imported_count: number;
  last_error: string | null;
};

function SheetLeadSyncEditor() {
  const [cfg, setCfg] = useState<SyncCfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("sheet_lead_sync_config" as never).select("*").eq("id", 1).maybeSingle();
    setCfg(data as SyncCfg | null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!cfg) return;
    const { error } = await supabase.from("sheet_lead_sync_config" as never).update({
      spreadsheet_id: cfg.spreadsheet_id,
      sheet_name: cfg.sheet_name,
      header_row: cfg.header_row,
      target_stage_name: cfg.target_stage_name,
      source_tag: cfg.source_tag,
      source_label: cfg.source_label,
      is_active: cfg.is_active,
    } as never).eq("id", 1);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved" });
  };

  const syncNow = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("gsheet-leads-sync", { body: { source: "manual" } });
    setSyncing(false);
    if (error) { toast({ title: "Sync failed", description: error.message, variant: "destructive" }); return; }
    const imp = (data as { imported?: number } | null)?.imported ?? 0;
    toast({ title: `Synced - ${imp} new lead${imp === 1 ? "" : "s"}` });
    load();
  };

  if (loading || !cfg) return <Card className="p-6 text-sm text-muted-foreground">Loading sheet sync…</Card>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <Zap className="w-4 h-4" />Google Sheet → New Lead
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Every 5 minutes, new rows from your Google Sheet are added to the chosen pipeline stage with the chosen tag.
        Duplicates are skipped by phone number. Sheet columns expected: <code className="bg-muted px-1 rounded">Name, Number, Age, State, Fund Name, Fund Balance, Employment, Comments</code>.
      </p>
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Spreadsheet ID</Label>
            <Input value={cfg.spreadsheet_id} onChange={e => setCfg({ ...cfg, spreadsheet_id: e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1">Found in the sheet URL: <code>/spreadsheets/d/&lt;ID&gt;/edit</code></p>
          </div>
          <div>
            <Label className="text-xs">Sheet (tab) name</Label>
            <Input value={cfg.sheet_name} onChange={e => setCfg({ ...cfg, sheet_name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Target pipeline stage</Label>
            <Input value={cfg.target_stage_name} onChange={e => setCfg({ ...cfg, target_stage_name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Header row #</Label>
            <Input type="number" min={1} value={cfg.header_row} onChange={e => setCfg({ ...cfg, header_row: parseInt(e.target.value) || 1 })} />
          </div>
          <div>
            <Label className="text-xs">Tag</Label>
            <Input value={cfg.source_tag} onChange={e => setCfg({ ...cfg, source_tag: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Source label</Label>
            <Input value={cfg.source_label} onChange={e => setCfg({ ...cfg, source_label: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Switch checked={cfg.is_active} onCheckedChange={v => setCfg({ ...cfg, is_active: v })} />
            <span className="text-xs">{cfg.is_active ? "Auto-sync on" : "Auto-sync off"}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Last sync: {cfg.last_synced_at ? new Date(cfg.last_synced_at).toLocaleString() : "never"}
            {" · "}Last batch: {cfg.last_imported_count}
            {cfg.last_error && <span className="text-destructive ml-2">Error: {cfg.last_error}</span>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={syncNow} disabled={syncing}>
            <Play className="w-4 h-4 mr-2" />{syncing ? "Syncing…" : "Sync now"}
          </Button>
          <Button size="sm" onClick={save}><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </Card>
    </div>
  );
}

// ---------- Booking message templates ----------
type Tpl = { id: string; kind: string; subject: string | null; body: string; is_active: boolean };

const TPL_META: Record<string, { label: string; hasSubject: boolean; description: string }> = {
  sms_confirmation: { label: "SMS - Booking confirmation", hasSubject: false, description: "Sent by SMS as soon as a client books." },
  email_confirmation: { label: "Email - Booking confirmation", hasSubject: true, description: "Sent by email as soon as a client books." },
  email_24h: { label: "Email - 24h reminder", hasSubject: true, description: "Sent ~24 hours before the call." },
  email_1h: { label: "Email - 1h reminder", hasSubject: true, description: "Sent ~1 hour before the call." },
};

function BookingTemplatesEditor() {
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("booking_reminder_templates").select("*").order("kind");
    setItems((data ?? []) as Tpl[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateLocal = (id: string, patch: Partial<Tpl>) =>
    setItems(arr => arr.map(t => t.id === id ? { ...t, ...patch } : t));

  const save = async (t: Tpl) => {
    const { error } = await supabase.from("booking_reminder_templates")
      .update({ subject: t.subject, body: t.body, is_active: t.is_active })
      .eq("id", t.id);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved" });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />Booking message templates
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Edit the SMS and emails sent when an appointment is booked or reminded. Use
        <code className="bg-muted px-1 rounded mx-1">{"{{first_name}}"}</code>,
        <code className="bg-muted px-1 rounded mx-1">{"{{client_name}}"}</code>,
        <code className="bg-muted px-1 rounded mx-1">{"{{date}}"}</code>,
        <code className="bg-muted px-1 rounded mx-1">{"{{time}}"}</code>,
        <code className="bg-muted px-1 rounded mx-1">{"{{client_timezone}}"}</code>,
        <code className="bg-muted px-1 rounded mx-1">{"{{meeting_link}}"}</code>,
        <code className="bg-muted px-1 rounded mx-1">{"{{reschedule_link}}"}</code>,
        <code className="bg-muted px-1 rounded mx-1">{"{{cancel_link}}"}</code>.
      </p>
      {loading ? <Card className="p-6 text-sm text-muted-foreground">Loading…</Card> : (
        <div className="grid gap-3">
          {items.map(t => {
            const meta = TPL_META[t.kind] ?? { label: t.kind, hasSubject: true, description: "" };
            return (
              <Card key={t.id} className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-semibold">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{meta.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={t.is_active} onCheckedChange={v => updateLocal(t.id, { is_active: v })} />
                    <span className="text-xs">{t.is_active ? "On" : "Off"}</span>
                  </div>
                </div>
                {meta.hasSubject && (
                  <div>
                    <Label className="text-xs">Subject</Label>
                    <Input value={t.subject ?? ""} onChange={e => updateLocal(t.id, { subject: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Message</Label>
                  <Textarea rows={meta.hasSubject ? 8 : 6} value={t.body ?? ""} onChange={e => updateLocal(t.id, { body: e.target.value })} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => save(t)}><Save className="w-4 h-4 mr-2" />Save</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Automations() {
  const [editing, setEditing] = useState<Workflow | null>(null);
  return (
    <CRMLayout>
      <ReactFlowProvider>
        {editing
          ? <Builder workflow={editing} onBack={() => setEditing(null)} onSaved={setEditing} />
          : <WorkflowList onOpen={setEditing} />}
      </ReactFlowProvider>
    </CRMLayout>
  );
}
