import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, MessageSquare, Search, Send, Copy, Check, Link2 } from "lucide-react";

const UPLOAD_URL = "https://report.advisorlinkonline.com.au/upload";

type Contact = { id: string; name: string; email: string | null; phone: string | null; source: string };

export function SendUploadLinkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [tab, setTab] = useState<"email" | "sms">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Please upload your documents securely");
  const [emailBody, setEmailBody] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: smsData }, { data: dealData }] = await Promise.all([
        supabase.from("sms_contacts").select("id, full_name, email, phone").order("full_name").limit(500),
        supabase.from("pipeline_deals").select("id, client_name, client_email, client_phone").order("created_at", { ascending: false }).limit(500),
      ]);
      const map = new Map<string, Contact>();
      (smsData || []).forEach((c: any) => {
        const key = (c.email || c.phone || c.id).toLowerCase();
        if (!map.has(key)) map.set(key, { id: c.id, name: c.full_name, email: c.email, phone: c.phone, source: "SMS" });
      });
      (dealData || []).forEach((d: any) => {
        const key = (d.client_email || d.client_phone || d.id).toLowerCase();
        if (!map.has(key)) map.set(key, { id: d.id, name: d.client_name, email: d.client_email, phone: d.client_phone, source: "Pipeline" });
      });
      setContacts(Array.from(map.values()));
    })();
  }, [open]);

  useEffect(() => {
    const greeting = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
    setEmailBody(`${greeting}\n\nPlease use the secure link below to upload your photo ID and super statement. It only takes a couple of minutes and your information is encrypted.\n\n${UPLOAD_URL}\n\nThanks,\nAdvisor Link Online`);
    setSmsBody(`${greeting} Please upload your documents securely here: ${UPLOAD_URL}`);
  }, [name]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contacts.slice(0, 20);
    return contacts.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [search, contacts]);

  const pick = (c: Contact) => {
    setSelected(c);
    setName(c.name || "");
    setEmail(c.email || "");
    setPhone(c.phone || "");
    if (!c.email && c.phone) setTab("sms");
    if (c.email && !c.phone) setTab("email");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(UPLOAD_URL);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const sendEmail = () => {
    if (!email) return toast.error("Enter an email address");
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailto;
    toast.success("Opening your email client...");
    onOpenChange(false);
  };

  const sendSMS = async () => {
    if (!phone) return toast.error("Enter a phone number");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("sms-send", {
        body: { to: phone, body: smsBody },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("SMS sent");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Could not send SMS: ${e.message || e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" /> Send upload link</DialogTitle>
          <DialogDescription>Pick a client and send them the secure document upload link via email or SMS.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 flex items-center gap-2">
          <code className="flex-1 text-xs sm:text-sm truncate">{UPLOAD_URL}</code>
          <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5 shrink-0">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Choose a client</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search contacts or pipeline deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {filtered.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
              {filtered.map(c => (
                <button
                  key={`${c.source}-${c.id}`}
                  onClick={() => pick(c)}
                  className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${selected?.id === c.id ? "bg-accent" : ""}`}
                >
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[c.email, c.phone].filter(Boolean).join(" • ")} <span className="ml-1 opacity-60">[{c.source}]</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ul-name">Name</Label>
            <Input id="ul-name" value={name} onChange={e => setName(e.target.value)} placeholder="Client name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ul-email">Email</Label>
            <Input id="ul-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ul-phone">Phone</Label>
            <Input id="ul-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="04xx xxx xxx" />
          </div>
        </div>

        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="email" className="gap-2"><Mail className="w-4 h-4" /> Email</TabsTrigger>
            <TabsTrigger value="sms" className="gap-2"><MessageSquare className="w-4 h-4" /> SMS</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="ul-subject">Subject</Label>
              <Input id="ul-subject" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ul-body">Message</Label>
              <Textarea id="ul-body" rows={7} value={emailBody} onChange={e => setEmailBody(e.target.value)} />
            </div>
            <Button onClick={sendEmail} className="w-full gap-2">
              <Send className="w-4 h-4" /> Open in email client
            </Button>
            <p className="text-xs text-muted-foreground text-center">This opens your default email app pre-filled, ready to send.</p>
          </TabsContent>
          <TabsContent value="sms" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="ul-sms">Message</Label>
              <Textarea id="ul-sms" rows={4} value={smsBody} onChange={e => setSmsBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">{smsBody.length} characters</p>
            </div>
            <Button onClick={sendSMS} disabled={sending} className="w-full gap-2">
              <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send SMS"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
