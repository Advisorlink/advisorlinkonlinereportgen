import { useEffect, useState } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Copy, ExternalLink, Save, Send } from "lucide-react";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function Calendar() {
  const [settings, setSettings] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  const reload = async () => {
    const [{ data: s }, { data: b }, { data: t }] = await Promise.all([
      supabase.from("booking_settings").select("*").eq("slug","travis").single(),
      supabase.from("bookings").select("*").order("start_at", { ascending: false }).limit(100),
      supabase.from("booking_reminder_templates").select("*").order("kind"),
    ]);
    setSettings(s); setBookings(b ?? []); setTemplates(t ?? []);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const bookUrl = `${window.location.origin}/book/${settings?.slug ?? "travis"}`;

  const saveSettings = async () => {
    const { error } = await supabase.from("booking_settings").update({
      host_name: settings.host_name,
      host_title: settings.host_title,
      host_email: settings.host_email,
      timezone: settings.timezone,
      meeting_duration_minutes: settings.meeting_duration_minutes,
      buffer_minutes: settings.buffer_minutes,
      min_notice_hours: settings.min_notice_hours,
      max_days_ahead: settings.max_days_ahead,
      max_per_day: settings.max_per_day,
      meeting_link: settings.meeting_link,
      meeting_title: settings.meeting_title,
      meeting_description: settings.meeting_description,
      weekly_availability: settings.weekly_availability,
    }).eq("id", 1);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  const saveTemplate = async (t: any) => {
    const { error } = await supabase.from("booking_reminder_templates").update({
      subject: t.subject, body: t.body, is_active: t.is_active,
    }).eq("id", t.id);
    if (error) toast.error(error.message);
    else toast.success("Template saved");
  };

  const sendTest = async (kind: string) => {
    const isEmail = kind.startsWith("email");
    if (isEmail && !testEmail) { toast.error("Enter a test email address"); return; }
    if (!isEmail && !testPhone) { toast.error("Enter a test phone number"); return; }
    setSendingTest(kind);
    const { data, error } = await supabase.functions.invoke("booking-test-reminder", {
      body: { kind, email: testEmail || undefined, phone: testPhone || undefined },
    });
    setSendingTest(null);
    if (error || (data as any)?.error) toast.error(error?.message || (data as any).error);
    else toast.success(isEmail ? `Test email sent to ${testEmail}` : `Test SMS sent to ${testPhone}`);
  };

  const updateDay = (dow: number, idx: number, field: "start" | "end", v: string) => {
    const wa = { ...settings.weekly_availability };
    wa[dow] = [...(wa[dow] || [])];
    wa[dow][idx] = { ...wa[dow][idx], [field]: v };
    setSettings({ ...settings, weekly_availability: wa });
  };
  const toggleDay = (dow: number) => {
    const wa = { ...settings.weekly_availability };
    wa[dow] = wa[dow]?.length ? [] : [{ start: "10:00", end: "19:00" }];
    setSettings({ ...settings, weekly_availability: wa });
  };

  return (
    <CRMLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground">Bookings, availability, and reminder templates.</p>
          </div>
          {settings && (
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs px-3 py-2 rounded-md bg-muted text-foreground/80 truncate max-w-[260px]">{bookUrl}</code>
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(bookUrl); toast.success("Link copied"); }}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={bookUrl} target="_blank" rel="noopener"><ExternalLink className="w-4 h-4" /></a>
              </Button>
              <Button variant="outline" size="sm" onClick={async () => {
                const { data, error } = await supabase.functions.invoke("gcal-watch-register", { body: {} });
                if (error || (data as { error?: string })?.error) toast.error((data as { error?: string })?.error || error?.message || "Failed");
                else toast.success("Google Calendar two-way sync enabled");
              }}>Enable GCal sync</Button>
            </div>
          )}

        </div>

        {loading || !settings ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <Tabs defaultValue="bookings">
            <TabsList>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
              <TabsTrigger value="reminders">Reminders</TabsTrigger>
            </TabsList>

            <TabsContent value="bookings" className="space-y-2 mt-4">
              {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet — share your link to start receiving them.</p>}
              {bookings.map(b => (
                <div key={b.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{b.client_name}</span>
                      <Badge variant={b.status === "cancelled" ? "destructive" : "secondary"}>{b.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: b.client_timezone }).format(new Date(b.start_at))}
                      {" "}({b.client_timezone})
                    </div>
                    <div className="text-xs text-muted-foreground">{b.client_email} · {b.client_phone ?? "—"}</div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="availability" className="space-y-4 mt-4">
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label>Host name</Label><Input value={settings.host_name} onChange={(e) => setSettings({...settings, host_name: e.target.value})}/></div>
                  <div><Label>Host email (for booking alerts)</Label><Input value={settings.host_email ?? ""} onChange={(e) => setSettings({...settings, host_email: e.target.value})}/></div>
                  <div><Label>Meeting title</Label><Input value={settings.meeting_title} onChange={(e) => setSettings({...settings, meeting_title: e.target.value})}/></div>
                  <div><Label>Meeting link (your screen-share)</Label><Input value={settings.meeting_link ?? ""} placeholder="https://..." onChange={(e) => setSettings({...settings, meeting_link: e.target.value})}/></div>
                  <div><Label>Timezone</Label><Input value={settings.timezone} onChange={(e) => setSettings({...settings, timezone: e.target.value})}/></div>
                  <div className="grid grid-cols-4 gap-2">
                    <div><Label>Length (min)</Label><Input type="number" value={settings.meeting_duration_minutes} onChange={(e) => setSettings({...settings, meeting_duration_minutes: +e.target.value})}/></div>
                    <div><Label>Buffer</Label><Input type="number" value={settings.buffer_minutes} onChange={(e) => setSettings({...settings, buffer_minutes: +e.target.value})}/></div>
                    <div><Label>Min notice (h)</Label><Input type="number" value={settings.min_notice_hours} onChange={(e) => setSettings({...settings, min_notice_hours: +e.target.value})}/></div>
                    <div><Label>Max/day</Label><Input type="number" value={settings.max_per_day} onChange={(e) => setSettings({...settings, max_per_day: +e.target.value})}/></div>
                  </div>
                </div>
                <div>
                  <Label>Meeting description</Label>
                  <Textarea value={settings.meeting_description ?? ""} onChange={(e) => setSettings({...settings, meeting_description: e.target.value})} rows={2}/>
                </div>
                <div className="space-y-2">
                  <Label>Weekly availability</Label>
                  {DAYS.map((name, dow) => {
                    const win = settings.weekly_availability?.[dow]?.[0];
                    return (
                      <div key={dow} className="flex items-center gap-3 text-sm">
                        <label className="flex items-center gap-2 w-28">
                          <input type="checkbox" checked={!!win} onChange={() => toggleDay(dow)} />
                          {name}
                        </label>
                        {win ? (
                          <>
                            <Input type="time" value={win.start} onChange={(e) => updateDay(dow, 0, "start", e.target.value)} className="w-28"/>
                            <span className="text-muted-foreground">to</span>
                            <Input type="time" value={win.end} onChange={(e) => updateDay(dow, 0, "end", e.target.value)} className="w-28"/>
                          </>
                        ) : <span className="text-muted-foreground text-xs">Unavailable</span>}
                      </div>
                    );
                  })}
                </div>
                <Button onClick={saveSettings} className="bg-cyan text-navy hover:bg-cyan-glow"><Save className="w-4 h-4 mr-2"/>Save availability</Button>
              </div>
            </TabsContent>

            <TabsContent value="reminders" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">Use merge fields: <code>{`{{client_name}}`}</code>, <code>{`{{date}}`}</code>, <code>{`{{time}}`}</code>, <code>{`{{client_timezone}}`}</code>, <code>{`{{meeting_link}}`}</code>, <code>{`{{reschedule_link}}`}</code>, <code>{`{{cancel_link}}`}</code>.</p>

              <div className="rounded-xl border bg-card p-5 space-y-3">
                <div>
                  <div className="font-semibold">Send a test</div>
                  <p className="text-xs text-muted-foreground">Save your changes first, then send a test of any template to your own email or phone. Uses a sample booking 24 hours from now.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>Test email</Label><Input type="email" placeholder="you@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}/></div>
                  <div><Label>Test phone (SMS)</Label><Input type="tel" placeholder="+61 4XX XXX XXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)}/></div>
                </div>
              </div>

              {templates.map(t => (
                <div key={t.id} className="rounded-xl border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold capitalize">{t.kind.replace(/_/g," ")}</div>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={t.is_active} onChange={(e) => setTemplates(templates.map(x => x.id === t.id ? { ...x, is_active: e.target.checked } : x))}/> Active</label>
                  </div>
                  {t.kind.startsWith("email") && (
                    <div><Label>Subject</Label><Input value={t.subject ?? ""} onChange={(e) => setTemplates(templates.map(x => x.id === t.id ? { ...x, subject: e.target.value } : x))}/></div>
                  )}
                  <div><Label>Message</Label><Textarea rows={5} value={t.body} onChange={(e) => setTemplates(templates.map(x => x.id === t.id ? { ...x, body: e.target.value } : x))}/></div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" onClick={() => saveTemplate(t)}><Save className="w-4 h-4 mr-2"/>Save</Button>
                    <Button size="sm" variant="outline" disabled={sendingTest === t.kind} onClick={() => sendTest(t.kind)}>
                      <Send className="w-4 h-4 mr-2"/>{sendingTest === t.kind ? "Sending…" : `Send test ${t.kind.startsWith("email") ? "email" : "SMS"}`}
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </CRMLayout>
  );
}
