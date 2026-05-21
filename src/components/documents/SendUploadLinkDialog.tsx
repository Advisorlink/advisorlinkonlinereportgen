import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, MessageSquare, Search, Send, Copy, Check, Link2, Briefcase, FileText, Receipt, IdCard } from "lucide-react";

const UPLOAD_URLS = {
  license_and_statement: "https://report.advisorlinkonline.com.au/upload",
  statement_only: "https://report.advisorlinkonline.com.au/upload-statement",
  license_only: "https://report.advisorlinkonline.com.au/upload",
} as const;

type UploadType = keyof typeof UPLOAD_URLS;

const UPLOAD_TYPE_LABELS: Record<UploadType, { label: string; description: string; subject: string; blurb: string }> = {
  license_and_statement: {
    label: "License & Statement",
    description: "Photo ID + super statement upload",
    subject: "Please upload your license and statement",
    blurb: "Please use the secure link below to upload your driver's license and statement. It only takes a couple of minutes and your information is encrypted.",
  },
  statement_only: {
    label: "Statement Only",
    description: "Screenshot, photo, or PDF of a statement",
    subject: "Please send through your statement",
    blurb: "Please use the secure link below to send through your statement — you can upload a screenshot, a photo, or a PDF. It only takes a minute and your information is encrypted.",
  },
  license_only: {
    label: "License Only",
    description: "Driver's license / photo ID upload",
    subject: "Please upload your driver's license",
    blurb: "Please use the secure link below to upload a clear photo of your driver's license. It only takes a minute and your information is encrypted.",
  },
};

const ADVISORS = [
  { id: "pure-private-wealth", name: "Pure Private Wealth" },
  { id: "my-advice-hub", name: "My Advice Hub" },
  { id: "inheritance-financial", name: "Inheritance Financial" },
  { id: "advisor-link-online", name: "Advisor Link Online" },
] as const;

type AdvisorId = typeof ADVISORS[number]["id"];
type SendChannel = "email" | "sms" | "both";

type Contact = { id: string; name: string; email: string | null; phone: string | null; source: string };

export function SendUploadLinkDialog({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: { name?: string; email?: string; phone?: string } | null }) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [advisor, setAdvisor] = useState<AdvisorId>("pure-private-wealth");
  const [uploadType, setUploadType] = useState<UploadType>("license_and_statement");
  const [channel, setChannel] = useState<SendChannel>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState(UPLOAD_TYPE_LABELS.license_and_statement.subject);
  const [emailBody, setEmailBody] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const advisorName = useMemo(
    () => ADVISORS.find(a => a.id === advisor)?.name || "",
    [advisor]
  );

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

  // Prefill from the client we're currently presenting to
  useEffect(() => {
    if (!open || !prefill) return;
    if (prefill.name) setName(prefill.name);
    if (prefill.email) setEmail(prefill.email);
    if (prefill.phone) setPhone(prefill.phone);
    setSelected(null);
    setSearch("");
    if (!prefill.email && prefill.phone) setChannel("sms");
    else if (prefill.email && !prefill.phone) setChannel("email");
  }, [open, prefill]);

  useEffect(() => {
    const greeting = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
    const url = UPLOAD_URLS[uploadType];
    const meta = UPLOAD_TYPE_LABELS[uploadType];
    setSubject(meta.subject);
    setEmailBody(`${greeting}\n\n${meta.blurb}\n\n${url}\n\nThanks,\n${advisorName}`);
    setSmsBody(`${greeting} ${meta.blurb.replace(/Please use the secure link below to /, "").replace(/\.$/, "")} here: ${url} — ${advisorName}`);
  }, [name, advisorName, uploadType]);


  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [] as Contact[];
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
    if (!c.email && c.phone) setChannel("sms");
    else if (c.email && !c.phone) setChannel("email");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(UPLOAD_URLS[uploadType]);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const sendEmailNow = async () => {
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = emailBody
      .split("\n")
      .map(line => {
        if (line.trim() === "") return "<br>";
        const safe = escape(line).replace(
          /(https?:\/\/[^\s]+)/g,
          '<a href="$1" style="color:#0891b2;text-decoration:underline">$1</a>'
        );
        return `<p style="margin:0 0 8px 0">${safe}</p>`;
      })
      .join("\n");
    const { data, error } = await supabase.functions.invoke("send-report-email", {
      body: {
        recipientEmail: email,
        clientName: name,
        customSubject: subject,
        customBody: html,
        isHtml: true,
      },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
  };

  const sendSmsNow = async () => {
    const { data, error } = await supabase.functions.invoke("sms-send", {
      body: { to: phone, body: smsBody },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
  };

  const handleSend = async () => {
    if ((channel === "email" || channel === "both") && !email) return toast.error("Enter an email address");
    if ((channel === "sms" || channel === "both") && !phone) return toast.error("Enter a phone number");
    if (!name.trim()) return toast.error("Enter a client name");

    setSending(true);
    try {
      const tasks: Promise<void>[] = [];
      if (channel === "email" || channel === "both") tasks.push(sendEmailNow());
      if (channel === "sms" || channel === "both") tasks.push(sendSmsNow());
      await Promise.all(tasks);

      // Best-effort: update pipeline deal note that link was sent
      if (selected?.source === "Pipeline") {
        const stamp = new Date().toISOString();
        await supabase
          .from("pipeline_deals")
          .update({ notes: `Upload link sent ${stamp} via ${channel} — advisor: ${advisorName}` } as any)
          .eq("id", selected.id);
      }

      toast.success(
        channel === "both"
          ? `Email & SMS sent to ${name}`
          : channel === "email"
          ? `Email sent to ${email}`
          : `SMS sent to ${phone}`
      );
      onOpenChange(false);

      // Auto-open E-Sign new request with this client prefilled
      const params = new URLSearchParams({
        new: "1",
        name,
        email,
        phone,
        advisor,
      });
      navigate(`/esign?${params.toString()}`);
    } catch (e: any) {
      toast.error(`Could not send: ${e.message || e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" /> Send upload link</DialogTitle>
          <DialogDescription>Pick a client, choose your advisor brand, and send the secure document upload link.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> What are you sending?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(UPLOAD_TYPE_LABELS) as UploadType[]).map((key) => {
              const meta = UPLOAD_TYPE_LABELS[key];
              const Icon = key === "advisor" ? FileText : Receipt;
              const active = uploadType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setUploadType(key)}
                  className={`text-left rounded-lg border p-3 transition-all ${active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40 hover:bg-accent/50"}`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    {meta.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{meta.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 flex items-center gap-2">
          <code className="flex-1 text-xs sm:text-sm truncate">{UPLOAD_URLS[uploadType]}</code>
          <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5 shrink-0">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Choose advisor</Label>
            <Select value={advisor} onValueChange={(v) => setAdvisor(v as AdvisorId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADVISORS.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Send via</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as SendChannel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email only</SelectItem>
                <SelectItem value="sms">Text message only</SelectItem>
                <SelectItem value="both">Both email & text</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

        {(channel === "email" || channel === "both") && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Mail className="w-4 h-4 text-primary" /> Email</div>
            <div className="space-y-1.5">
              <Label htmlFor="ul-subject">Subject</Label>
              <Input id="ul-subject" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ul-body">Message</Label>
              <Textarea id="ul-body" rows={6} value={emailBody} onChange={e => setEmailBody(e.target.value)} />
            </div>
          </div>
        )}

        {(channel === "sms" || channel === "both") && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="w-4 h-4 text-primary" /> Text message</div>
            <div className="space-y-1.5">
              <Label htmlFor="ul-sms">Message</Label>
              <Textarea id="ul-sms" rows={3} value={smsBody} onChange={e => setSmsBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">{smsBody.length} characters</p>
            </div>
          </div>
        )}

        <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
          <Send className="w-4 h-4" />
          {sending
            ? "Sending..."
            : channel === "both"
            ? "Send email & text"
            : channel === "email"
            ? "Send email"
            : "Send text message"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          After sending, you'll be taken to E-Sign with this client ready to go under <span className="font-medium">{advisorName}</span>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
