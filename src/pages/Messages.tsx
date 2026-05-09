import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CRMLayout } from "@/components/CRMLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search, Send, Paperclip, Phone, Mail, User, MessageSquare,
  Archive, X, MoreVertical, Clock, CheckCheck, Check,
  AlertCircle, Ban, Plus, Tag, ArrowLeft, FileText, ChevronDown,
  Landmark, MapPin, UserCog, Calendar, Smile,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Conversation = {
  id: string; contact_id: string; status: string; is_unread: boolean;
  unread_count: number; last_message_body: string | null; last_message_at: string | null;
  last_message_direction: string | null; assigned_user_id: string | null;
  tags: string[]; created_at: string;
  sms_contacts: { id: string; full_name: string; phone: string; email: string | null;
    lead_status: string | null; opt_out_status: boolean; tags: string[]; lead_source: string | null;
    notes: string | null; first_name: string | null; last_name: string | null;
    opt_in_status: boolean; opt_in_date: string | null; opt_out_date: string | null;
    assigned_user_id: string | null; last_message_at: string | null; custom_fields: Record<string, unknown>;
  };
};

type Message = {
  id: string; direction: string; channel: string; body: string | null;
  media_urls: string[]; status: string; error_code: string | null;
  error_message: string | null; created_at: string; from_number: string;
  to_number: string; twilio_sid: string | null; segment_count: number;
};

type SmsNumber = {
  id: string; phone_number: string; provider: string; friendly_name: string | null; is_default: boolean;
};

type Template = {
  id: string; name: string; category: string; body: string;
};

const statusIcon = (s: string) => {
  switch (s) {
    case "delivered": return <CheckCheck className="w-3 h-3 text-cyan" />;
    case "sent": return <Check className="w-3 h-3 text-muted-foreground" />;
    case "queued": case "accepted": return <Clock className="w-3 h-3 text-muted-foreground" />;
    case "failed": case "undelivered": return <AlertCircle className="w-3 h-3 text-destructive" />;
    default: return null;
  }
};

const formatTime = (d: string) => {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000 && date.getDate() === now.getDate()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [showContactPanel, setShowContactPanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  // From number selector
  const [smsNumbers, setSmsNumbers] = useState<SmsNumber[]>([]);
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");

  // Template quick-insert
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<{ id: string; email: string }[]>([]);

  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from("sms_conversations")
      .select("*, sms_contacts(*)")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (!error && data) setConversations(data as unknown as Conversation[]);
    setLoading(false);
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from("sms_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as unknown as Message[]);
  }, []);

  const fetchSmsNumbers = useCallback(async () => {
    const { data } = await supabase
      .from("sms_twilio_numbers")
      .select("id, phone_number, provider, friendly_name, is_default")
      .order("is_default", { ascending: false });
    if (data) {
      setSmsNumbers(data as unknown as SmsNumber[]);
      const def = data.find((n: any) => n.is_default);
      if (def) setSelectedFromNumber((def as any).phone_number);
      else if (data.length > 0) setSelectedFromNumber((data[0] as any).phone_number);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from("sms_templates")
      .select("id, name, category, body")
      .eq("is_active", true)
      .order("category");
    if (data) setTemplates(data as unknown as Template[]);
  }, []);

  const fetchTeam = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, email").order("email");
    if (data) setTeamMembers(data);
  }, []);

  useEffect(() => { fetchConversations(); fetchSmsNumbers(); fetchTemplates(); fetchTeam(); }, [fetchConversations, fetchSmsNumbers, fetchTemplates, fetchTeam]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("sms-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sms_messages" }, () => {
        if (activeConv) fetchMessages(activeConv.id);
        fetchConversations();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sms_conversations" }, () => {
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConv, fetchMessages, fetchConversations]);

  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv.id);
      if (activeConv.is_unread) {
        supabase.from("sms_conversations").update({ is_unread: false, unread_count: 0 }).eq("id", activeConv.id).then();
      }
    }
  }, [activeConv, fetchMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !activeConv) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("sms-send", {
        body: {
          to: activeConv.sms_contacts.phone,
          body: messageText,
          contactId: activeConv.contact_id,
          conversationId: activeConv.id,
          fromNumber: selectedFromNumber || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessageText("");
      fetchMessages(activeConv.id);
      fetchConversations();
    } catch (err: unknown) {
      toast({ title: "Send failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setSending(false);
  };

  const handleInsertTemplate = (template: Template) => {
    // Replace merge fields with contact data if available
    let body = template.body;
    if (activeConv) {
      const c = activeConv.sms_contacts;
      body = body
        .replace(/\{\{first_name\}\}/g, c.first_name || c.full_name.split(" ")[0] || "")
        .replace(/\{\{last_name\}\}/g, c.last_name || "")
        .replace(/\{\{full_name\}\}/g, c.full_name || "")
        .replace(/\{\{phone\}\}/g, c.phone || "")
        .replace(/\{\{email\}\}/g, c.email || "");
    }
    setMessageText(body);
    setShowTemplates(false);
  };

  const handleNewChat = async () => {
    if (!newChatPhone.trim() || !user) return;
    const { data: contact } = await supabase
      .from("sms_contacts")
      .insert({ user_id: user.id, full_name: newChatName || newChatPhone, phone: newChatPhone })
      .select("id")
      .single();
    if (contact) {
      const { data: conv } = await supabase
        .from("sms_conversations")
        .insert({ contact_id: contact.id, user_id: user.id, status: "open" })
        .select("*, sms_contacts(*)")
        .single();
      if (conv) {
        setActiveConv(conv as unknown as Conversation);
        fetchConversations();
      }
    }
    setShowNewChat(false);
    setNewChatPhone("");
    setNewChatName("");
  };

  const handleArchive = async (convId: string) => {
    await supabase.from("sms_conversations").update({ status: "archived" }).eq("id", convId);
    if (activeConv?.id === convId) setActiveConv(null);
    fetchConversations();
  };

  const handleCloseConv = async (convId: string) => {
    await supabase.from("sms_conversations").update({ status: "closed" }).eq("id", convId);
    fetchConversations();
  };

  const handleReassign = async (userId: string) => {
    if (!activeConv) return;
    const newId = userId === "__unassigned" ? null : userId;
    const { error } = await supabase
      .from("sms_conversations")
      .update({ assigned_user_id: newId })
      .eq("id", activeConv.id);
    if (error) {
      toast({ title: "Failed to reassign", variant: "destructive" });
    } else {
      await supabase.from("sms_contacts").update({ assigned_user_id: newId }).eq("id", activeConv.contact_id);
      setActiveConv({ ...activeConv, assigned_user_id: newId });
      toast({ title: "Conversation reassigned" });
      fetchConversations();
    }
  };

  const filtered = conversations.filter((c) => {
    if (filterTab === "unread" && !c.is_unread) return false;
    if (filterTab === "open" && c.status !== "open") return false;
    if (filterTab === "closed" && c.status !== "closed") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.sms_contacts.full_name.toLowerCase().includes(q) ||
        c.sms_contacts.phone.includes(q) ||
        (c.last_message_body || "").toLowerCase().includes(q);
    }
    return true;
  });

  const charCount = messageText.length;
  const segmentCount = Math.ceil(charCount / 160) || 1;

  const providerLabel = (p: string) => p === "telnyx" ? "Telnyx" : "Twilio";

  return (
    <CRMLayout>
      <div className="flex h-[calc(100vh-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {/* LEFT — Conversation List */}
        <div className={`flex flex-col border-r border-border ${activeConv ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 shrink-0`}>
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground font-heading flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan" /> Conversations
              </h2>
              <Button size="icon" variant="ghost" className="text-cyan hover:bg-cyan/10" onClick={() => setShowNewChat(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search conversations..." className="pl-9 h-9 text-sm bg-muted/50 border-0" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Tabs value={filterTab} onValueChange={setFilterTab}>
              <TabsList className="w-full h-8 bg-muted/50">
                <TabsTrigger value="all" className="text-xs flex-1">All</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs flex-1">Unread</TabsTrigger>
                <TabsTrigger value="open" className="text-xs flex-1">Open</TabsTrigger>
                <TabsTrigger value="closed" className="text-xs flex-1">Closed</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowNewChat(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Start a conversation
                </Button>
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${activeConv?.id === conv.id ? "bg-cyan/5 border-l-2 border-l-cyan" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {conv.sms_contacts.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${conv.is_unread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                          {conv.sms_contacts.full_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {conv.last_message_at ? formatTime(conv.last_message_at) : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {conv.last_message_direction === "outbound" && <span className="text-[10px] text-muted-foreground">You: </span>}
                        <p className={`text-xs truncate ${conv.is_unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {conv.last_message_body || "No messages yet"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {conv.sms_contacts.opt_out_status && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">Opted Out</Badge>}
                        {conv.is_unread && conv.unread_count > 0 && (
                          <span className="bg-cyan text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{conv.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* CENTER — Chat Thread */}
        {activeConv ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setActiveConv(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center text-white text-sm font-bold">
                  {activeConv.sms_contacts.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{activeConv.sms_contacts.full_name}</h3>
                  <p className="text-xs text-muted-foreground">{activeConv.sms_contacts.phone}</p>
                </div>
                {activeConv.sms_contacts.opt_out_status && (
                  <Badge variant="destructive" className="text-[10px]"><Ban className="w-3 h-3 mr-1" />Opted Out</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowContactPanel(!showContactPanel)}>
                  <User className="w-4 h-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCloseConv(activeConv.id)}>Close conversation</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleArchive(activeConv.id)}>Archive</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">Block contact</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.direction === "outbound"
                        ? "bg-navy text-white rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}>
                      {msg.body && <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>}
                      {msg.media_urls && msg.media_urls.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.media_urls.map((url, i) => (
                            <img key={i} src={url} alt="MMS" className="rounded-lg max-w-full max-h-48 cursor-pointer" onClick={() => setMediaPreview(url)} />
                          ))}
                        </div>
                      )}
                      <div className={`flex items-center gap-1 mt-1 ${msg.direction === "outbound" ? "justify-end" : ""}`}>
                        <span className={`text-[10px] ${msg.direction === "outbound" ? "text-white/50" : "text-muted-foreground"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.direction === "outbound" && statusIcon(msg.status)}
                        {(msg.status === "failed" || msg.status === "undelivered") && (
                          <span className="text-[10px] text-destructive ml-1">{msg.error_message || "Failed"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Composer */}
            <div className="border-t border-border p-3 bg-card">
              {activeConv.sms_contacts.opt_out_status ? (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-destructive">
                  <Ban className="w-4 h-4" /> This contact has opted out of SMS
                </div>
              ) : (
                <>
                  {/* From number & template selector row */}
                  <div className="flex items-center gap-2 mb-2">
                    {smsNumbers.length > 0 && (
                      <Select value={selectedFromNumber} onValueChange={setSelectedFromNumber}>
                        <SelectTrigger className="h-7 text-[11px] w-auto min-w-[140px] max-w-[200px] bg-muted/50 border-0">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                            <SelectValue placeholder="From number" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {smsNumbers.map((n) => (
                            <SelectItem key={n.id} value={n.phone_number}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{n.phone_number}</span>
                                <span className={`text-[9px] px-1 py-0 rounded ${n.provider === "telnyx" ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}`}>
                                  {providerLabel(n.provider)}
                                </span>
                                {n.is_default && <span className="text-[9px] text-muted-foreground">default</span>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Popover open={showTemplates} onOpenChange={setShowTemplates}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1.5 px-2">
                          <FileText className="w-3 h-3" /> Templates
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="start">
                        <div className="p-2 border-b border-border">
                          <p className="text-xs font-semibold text-foreground">Quick Insert Template</p>
                        </div>
                        <ScrollArea className="max-h-[250px]">
                          {templates.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">No templates yet</div>
                          ) : (
                            templates.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => handleInsertTemplate(t)}
                                className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border/50 last:border-0"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-foreground">{t.name}</span>
                                  <Badge variant="secondary" className="text-[9px] px-1">{t.category}</Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{t.body}</p>
                              </button>
                            ))
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="relative rounded-2xl border border-border bg-muted/30 focus-within:border-cyan/60 focus-within:bg-card focus-within:shadow-[0_0_0_4px_hsl(var(--cyan)/0.08)] transition-all">
                    <Textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message…"
                      className="min-h-[56px] max-h-40 resize-none border-0 bg-transparent px-4 py-3 pr-28 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    />
                    <div className="absolute right-2 bottom-2 flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-9 w-9 rounded-full bg-cyan hover:bg-cyan/90 text-white shadow-md disabled:opacity-40"
                        onClick={handleSend}
                        disabled={!messageText.trim() || sending}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 px-1">
                    <span className="text-[10px] text-muted-foreground">{charCount} chars · {segmentCount} segment{segmentCount > 1 ? "s" : ""}</span>
                    {charCount > 160 && <span className="text-[10px] text-amber-500">Multi-segment message</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">Select a conversation</h3>
              <p className="text-sm text-muted-foreground/60 mt-1">Choose from your existing conversations or start a new one</p>
              <Button className="mt-4 bg-cyan hover:bg-cyan/90 text-white" onClick={() => setShowNewChat(true)}>
                <Plus className="w-4 h-4 mr-2" /> New Conversation
              </Button>
            </div>
          </div>
        )}

        {/* RIGHT — Contact Panel (rich profile, mirrors client profile) */}
        {activeConv && showContactPanel && (() => {
          const c = activeConv.sms_contacts;
          const cf = (c.custom_fields || {}) as Record<string, any>;
          const initials = (c.full_name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
          const balance = cf.super_balance != null ? Number(cf.super_balance) : null;
          return (
            <div className="hidden lg:flex flex-col w-80 border-l border-border bg-card shrink-0 overflow-y-auto">
              {/* Hero header */}
              <div className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(215,60%,18%)] p-5 pb-6 relative">
                <Button size="icon" variant="ghost" className="absolute top-3 right-3 h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setShowContactPanel(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
                <p className="text-white/60 text-[11px] font-medium uppercase tracking-wider mb-3">Client Profile</p>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center text-lg font-bold text-white shadow-lg shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white text-base truncate">{c.full_name}</h4>
                    <p className="text-[11px] text-white/60 truncate mt-0.5">{c.phone}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.lead_status && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-white/10 text-white/90 border-white/10 hover:bg-white/15">
                          {c.lead_status}
                        </Badge>
                      )}
                      {c.opt_in_status && !c.opt_out_status && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-online/20 text-online border-online/30">Opted In</Badge>
                      )}
                      {c.opt_out_status && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">Opted Out</Badge>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-5">
                {/* Assigned to */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
                    <UserCog className="w-3 h-3" /> Assigned to
                  </p>
                  <Select
                    value={activeConv.assigned_user_id || "__unassigned"}
                    onValueChange={handleReassign}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned"><span className="text-muted-foreground">Unassigned</span></SelectItem>
                      {teamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact details */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Contact Details
                  </p>
                  <div className="space-y-2 bg-muted/30 rounded-xl p-3">
                    <DetailRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={c.phone} />
                    {c.email && <DetailRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={c.email} />}
                    {cf.age && <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Age" value={String(cf.age)} />}
                    {cf.state && <DetailRow icon={<MapPin className="w-3.5 h-3.5" />} label="State" value={String(cf.state)} />}
                    {c.lead_source && <DetailRow icon={<Tag className="w-3.5 h-3.5" />} label="Source" value={c.lead_source} />}
                  </div>
                </div>

                {/* Superannuation */}
                {(cf.super_fund_name || balance != null || cf.had_review_before != null) && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                      <Landmark className="w-3 h-3" /> Superannuation
                    </p>
                    <div className="space-y-2 bg-muted/30 rounded-xl p-3">
                      {cf.super_fund_name && <DetailRow icon={<Landmark className="w-3.5 h-3.5" />} label="Fund" value={String(cf.super_fund_name)} />}
                      {balance != null && (
                        <DetailRow icon={<span className="text-xs">$</span>} label="Balance" value={`$${balance.toLocaleString()}`} />
                      )}
                      {cf.had_review_before != null && (
                        <DetailRow icon={<Check className="w-3.5 h-3.5" />} label="Reviewed before" value={cf.had_review_before ? "Yes" : "No"} />
                      )}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {c.tags && c.tags.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {c.notes && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Notes</p>
                    <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3 whitespace-pre-wrap">{c.notes}</p>
                  </div>
                )}

                {/* Activity */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Activity</p>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    {c.last_message_at && <p>Last message: {new Date(c.last_message_at).toLocaleDateString()}</p>}
                    {c.opt_in_date && <p>Opted in: {new Date(c.opt_in_date).toLocaleDateString()}</p>}
                    {c.opt_out_date && <p className="text-destructive">Opted out: {new Date(c.opt_out_date).toLocaleDateString()}</p>}
                  </div>
                </div>
              </div>
          </div>
        )}

        {/* Hidden file input for MMS */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />

        {/* New Chat Dialog */}
        <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Conversation</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Contact Name</Label><Input value={newChatName} onChange={(e) => setNewChatName(e.target.value)} placeholder="John Smith" /></div>
              <div><Label>Phone Number</Label><Input value={newChatPhone} onChange={(e) => setNewChatPhone(e.target.value)} placeholder="+61400000000" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewChat(false)}>Cancel</Button>
              <Button className="bg-cyan hover:bg-cyan/90 text-white" onClick={handleNewChat} disabled={!newChatPhone.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Media Preview */}
        <Dialog open={!!mediaPreview} onOpenChange={() => setMediaPreview(null)}>
          <DialogContent className="max-w-2xl"><img src={mediaPreview || ""} alt="Media" className="w-full rounded-lg" /></DialogContent>
        </Dialog>
      </div>
    </CRMLayout>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
        <p className="text-xs text-foreground">{value}</p>
      </div>
    </div>
  );
}
