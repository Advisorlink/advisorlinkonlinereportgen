import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CRMLayout } from "@/components/CRMLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Plus, Edit, Trash2, Copy, Send, Users, BarChart3,
  Clock, CheckCheck, AlertCircle, Play, Pause, Calendar, Search,
  MessageSquare, Target, TrendingUp, Mail,
} from "lucide-react";

const TEMPLATE_CATEGORIES = [
  "Initial Contact", "Appointment Reminder", "Document Request", "Follow Up",
  "No Answer", "Rebooking", "Referral", "Super Review", "Property Enquiry",
  "Finance Enquiry", "General",
];

const MERGE_FIELDS = [
  { key: "{{first_name}}", label: "First Name" },
  { key: "{{last_name}}", label: "Last Name" },
  { key: "{{full_name}}", label: "Full Name" },
  { key: "{{phone}}", label: "Phone" },
  { key: "{{email}}", label: "Email" },
  { key: "{{adviser_name}}", label: "Adviser Name" },
  { key: "{{company_name}}", label: "Company Name" },
  { key: "{{appointment_date}}", label: "Appointment Date" },
  { key: "{{appointment_time}}", label: "Appointment Time" },
];

type Template = {
  id: string; name: string; category: string; body: string;
  merge_fields: string[]; compliance_footer: string | null; is_active: boolean;
  created_at: string; updated_at: string;
};

type Campaign = {
  id: string; name: string; status: string; message_body: string;
  total_recipients: number; sent_count: number; delivered_count: number;
  failed_count: number; reply_count: number; opt_out_count: number;
  scheduled_at: string | null; started_at: string | null; completed_at: string | null;
  created_at: string;
};

export default function SMSHub() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState("General");
  const [tplBody, setTplBody] = useState("");
  const [tplFooter, setTplFooter] = useState("");
  const [campName, setCampName] = useState("");
  const [campBody, setCampBody] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const fetchTemplates = async () => {
    const { data } = await supabase.from("sms_templates").select("*").order("created_at", { ascending: false });
    if (data) setTemplates(data as unknown as Template[]);
  };

  const fetchCampaigns = async () => {
    const { data } = await supabase.from("sms_campaigns").select("*").order("created_at", { ascending: false });
    if (data) setCampaigns(data as unknown as Campaign[]);
  };

  useEffect(() => { fetchTemplates(); fetchCampaigns(); }, []);

  const handleSaveTemplate = async () => {
    if (!tplName.trim() || !tplBody.trim() || !user) return;
    const payload = {
      user_id: user.id, name: tplName, category: tplCategory, body: tplBody,
      compliance_footer: tplFooter || null,
      merge_fields: MERGE_FIELDS.filter((f) => tplBody.includes(f.key)).map((f) => f.key),
    };
    if (editingTemplate) {
      await supabase.from("sms_templates").update(payload).eq("id", editingTemplate.id);
    } else {
      await supabase.from("sms_templates").insert(payload);
    }
    setShowTemplateDialog(false);
    resetTemplateForm();
    fetchTemplates();
    toast({ title: editingTemplate ? "Template updated" : "Template created" });
  };

  const resetTemplateForm = () => {
    setTplName(""); setTplCategory("General"); setTplBody(""); setTplFooter(""); setEditingTemplate(null);
  };

  const handleEditTemplate = (t: Template) => {
    setEditingTemplate(t); setTplName(t.name); setTplCategory(t.category); setTplBody(t.body); setTplFooter(t.compliance_footer || "");
    setShowTemplateDialog(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    await supabase.from("sms_templates").delete().eq("id", id);
    fetchTemplates();
    toast({ title: "Template deleted" });
  };

  const handleDuplicateTemplate = async (t: Template) => {
    if (!user) return;
    await supabase.from("sms_templates").insert({
      user_id: user.id, name: `${t.name} (Copy)`, category: t.category, body: t.body,
      compliance_footer: t.compliance_footer, merge_fields: t.merge_fields,
    });
    fetchTemplates();
    toast({ title: "Template duplicated" });
  };

  const handleCreateCampaign = async () => {
    if (!campName.trim() || !campBody.trim() || !user) return;
    await supabase.from("sms_campaigns").insert({
      user_id: user.id, name: campName, message_body: campBody, status: "draft",
    });
    setShowCampaignDialog(false);
    setCampName(""); setCampBody("");
    fetchCampaigns();
    toast({ title: "Campaign created as draft" });
  };

  const filteredTemplates = templates.filter((t) =>
    !searchQ || t.name.toLowerCase().includes(searchQ.toLowerCase()) || t.category.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <CRMLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-cyan" /> SMS Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Templates, campaigns, and analytics</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="templates" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Templates</TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5"><Target className="w-3.5 h-3.5" /> Campaigns</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Analytics</TabsTrigger>
          </TabsList>

          {/* TEMPLATES TAB */}
          <TabsContent value="templates" className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search templates..." className="pl-9" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
              </div>
              <Button className="bg-cyan hover:bg-cyan/90 text-white" onClick={() => { resetTemplateForm(); setShowTemplateDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> New Template
              </Button>
            </div>

            {filteredTemplates.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No templates yet. Create your first SMS template.</p>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((t) => (
                  <Card key={t.id} className="hover:shadow-elevated transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">{t.name}</CardTitle>
                          <Badge variant="secondary" className="mt-1 text-[10px]">{t.category}</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditTemplate(t)}><Edit className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDuplicateTemplate(t)}><Copy className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTemplate(t.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.body}</p>
                      {t.merge_fields.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {t.merge_fields.map((f) => <Badge key={f} variant="outline" className="text-[9px]">{f}</Badge>)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CAMPAIGNS TAB */}
          <TabsContent value="campaigns" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
              <Button className="bg-cyan hover:bg-cyan/90 text-white" onClick={() => setShowCampaignDialog(true)}>
                <Plus className="w-4 h-4 mr-2" /> New Campaign
              </Button>
            </div>

            {campaigns.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No campaigns yet. Create your first SMS broadcast.</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-foreground">{c.name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.message_body}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={c.status === "draft" ? "secondary" : c.status === "completed" ? "default" : "outline"} className="capitalize">
                            {c.status}
                          </Badge>
                          <div className="text-right text-xs">
                            <p className="text-muted-foreground"><span className="font-medium text-foreground">{c.sent_count}</span> sent</p>
                            <p className="text-muted-foreground"><span className="font-medium text-online">{c.delivered_count}</span> delivered</p>
                          </div>
                        </div>
                      </div>
                      {/* Stats bar */}
                      {c.total_recipients > 0 && (
                        <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[10px]">
                          <div><p className="font-bold text-foreground">{c.total_recipients}</p><p className="text-muted-foreground">Recipients</p></div>
                          <div><p className="font-bold text-cyan">{c.delivered_count}</p><p className="text-muted-foreground">Delivered</p></div>
                          <div><p className="font-bold text-destructive">{c.failed_count}</p><p className="text-muted-foreground">Failed</p></div>
                          <div><p className="font-bold text-foreground">{c.reply_count}</p><p className="text-muted-foreground">Replies</p></div>
                          <div><p className="font-bold text-amber-500">{c.opt_out_count}</p><p className="text-muted-foreground">Opt Outs</p></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="mt-4">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>

        {/* Template Dialog */}
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Template Name</Label><Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Appointment Reminder" /></div>
              <div>
                <Label>Category</Label>
                <Select value={tplCategory} onValueChange={setTplCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Message Body</Label>
                <Textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} placeholder="Hi {{first_name}}, ..." className="min-h-[120px]" />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">{tplBody.length} chars · {Math.ceil(tplBody.length / 160) || 1} segments</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {MERGE_FIELDS.map((f) => (
                    <Button key={f.key} variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={() => setTplBody(tplBody + f.key)}>
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div><Label>Compliance Footer (optional)</Label><Input value={tplFooter} onChange={(e) => setTplFooter(e.target.value)} placeholder="Reply STOP to unsubscribe" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
              <Button className="bg-cyan hover:bg-cyan/90 text-white" onClick={handleSaveTemplate} disabled={!tplName.trim() || !tplBody.trim()}>
                {editingTemplate ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Campaign Dialog */}
        <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Campaign Name</Label><Input value={campName} onChange={(e) => setCampName(e.target.value)} placeholder="January Follow-Up" /></div>
              <div>
                <Label>Message</Label>
                <Textarea value={campBody} onChange={(e) => setCampBody(e.target.value)} placeholder="Hi {{first_name}}, ..." className="min-h-[120px]" />
                <div className="flex flex-wrap gap-1 mt-2">
                  {MERGE_FIELDS.map((f) => (
                    <Button key={f.key} variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={() => setCampBody(campBody + f.key)}>
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>Cancel</Button>
              <Button className="bg-cyan hover:bg-cyan/90 text-white" onClick={handleCreateCampaign} disabled={!campName.trim() || !campBody.trim()}>
                Save as Draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CRMLayout>
  );
}

function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    totalSent: 0, totalDelivered: 0, totalFailed: 0, totalInbound: 0,
    totalOptOuts: 0, totalConversations: 0,
  });

  useEffect(() => {
    const fetch = async () => {
      const [sent, inbound, failed, optOuts, convs] = await Promise.all([
        supabase.from("sms_messages").select("id", { count: "exact", head: true }).eq("direction", "outbound"),
        supabase.from("sms_messages").select("id", { count: "exact", head: true }).eq("direction", "inbound"),
        supabase.from("sms_messages").select("id", { count: "exact", head: true }).in("status", ["failed", "undelivered"]),
        supabase.from("sms_opt_records").select("id", { count: "exact", head: true }).eq("action", "opt_out"),
        supabase.from("sms_conversations").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        totalSent: sent.count || 0,
        totalDelivered: (sent.count || 0) - (failed.count || 0),
        totalFailed: failed.count || 0,
        totalInbound: inbound.count || 0,
        totalOptOuts: optOuts.count || 0,
        totalConversations: convs.count || 0,
      });
    };
    fetch();
  }, []);

  const cards = [
    { label: "SMS Sent", value: stats.totalSent, icon: Send, color: "text-cyan" },
    { label: "Delivered", value: stats.totalDelivered, icon: CheckCheck, color: "text-online" },
    { label: "Failed", value: stats.totalFailed, icon: AlertCircle, color: "text-destructive" },
    { label: "Inbound Replies", value: stats.totalInbound, icon: Mail, color: "text-cyan" },
    { label: "Opt Outs", value: stats.totalOptOuts, icon: Users, color: "text-amber-500" },
    { label: "Conversations", value: stats.totalConversations, icon: MessageSquare, color: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="py-4 text-center">
            <c.icon className={`w-6 h-6 mx-auto mb-2 ${c.color}`} />
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{c.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
