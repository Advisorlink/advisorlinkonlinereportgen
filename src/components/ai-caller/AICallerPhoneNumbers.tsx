import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Phone, Loader2, RefreshCw, Search, ShoppingCart, Upload, PhoneIncoming } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface PhoneNumber {
  id: string;
  number: string;
  provider: string;
  name?: string;
  assistantId?: string;
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

interface InboundScript {
  id: string;
  name: string;
  description: string | null;
}

export function AICallerPhoneNumbers() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState("buy");

  // Inbound scripts
  const [inboundScripts, setInboundScripts] = useState<InboundScript[]>([]);
  const [assigningNumberId, setAssigningNumberId] = useState<string | null>(null);
  const [assigningScriptId, setAssigningScriptId] = useState<string>("");
  const [savingInbound, setSavingInbound] = useState(false);

  // Search/Buy state
  const [areaCode, setAreaCode] = useState("");
  const [contains, setContains] = useState("");
  const [searching, setSearching] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [buying, setBuying] = useState<string | null>(null);

  // Import state
  const [importNumber, setImportNumber] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioAuth, setTwilioAuth] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => { loadNumbers(); loadInboundScripts(); }, []);

  async function loadNumbers() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "list-phone-numbers" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const nums = (data?.phoneNumbers || []).map((p: any) => ({
        id: p.id,
        number: p.number || p.twilioPhoneNumber || "Unknown",
        provider: p.provider || "twilio",
        name: p.name,
        assistantId: p.assistantId || null,
      }));
      setNumbers(nums);
    } catch (e: any) {
      console.error("Failed to load phone numbers:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadInboundScripts() {
    const { data } = await supabase
      .from("ai_caller_scripts")
      .select("id, name, description")
      .eq("call_direction", "inbound")
      .order("created_at", { ascending: false });
    setInboundScripts(data || []);
  }

  async function searchNumbers() {
    setSearching(true);
    setAvailableNumbers([]);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: {
          action: "search-twilio-numbers",
          country: "AU",
          areaCode: areaCode.trim() || undefined,
          contains: contains.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAvailableNumbers(data?.numbers || []);
      if ((data?.numbers || []).length === 0) {
        toast.info("No numbers found. Try different search criteria.");
      }
    } catch (e: any) {
      toast.error(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function buyNumber(phoneNumber: string) {
    setBuying(phoneNumber);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: { action: "buy-twilio-number", phoneNumber },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.warning) {
        toast.warning(data.warning);
      } else {
        toast.success(`Purchased ${phoneNumber} and imported to Vapi!`);
      }
      setDialogOpen(false);
      setAvailableNumbers([]);
      loadNumbers();
    } catch (e: any) {
      toast.error(e.message || "Failed to buy number");
    } finally {
      setBuying(null);
    }
  }

  async function handleImport() {
    if (!importNumber.trim() || !twilioSid.trim() || !twilioAuth.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (!importNumber.startsWith("+")) {
      toast.error("Phone number must be in E.164 format (e.g. +61412345678)");
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: {
          action: "import-phone-number",
          number: importNumber.trim(),
          twilioAccountSid: twilioSid.trim(),
          twilioAuthToken: twilioAuth.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Phone number imported successfully!");
      setDialogOpen(false);
      setImportNumber("");
      loadNumbers();
    } catch (e: any) {
      toast.error(e.message || "Failed to import number");
    } finally {
      setImporting(false);
    }
  }

  async function assignInboundScript(phoneNumberId: string, scriptId: string) {
    setSavingInbound(true);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: {
          action: "assign-inbound-script",
          phoneNumberId,
          scriptId: scriptId || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(scriptId ? "Inbound script assigned! Calls to this number will now be answered by your AI." : "Inbound script removed.");
      setAssigningNumberId(null);
      loadNumbers();
    } catch (e: any) {
      toast.error(e.message || "Failed to assign script");
    } finally {
      setSavingInbound(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Phone Numbers</h2>
          <p className="text-sm text-muted-foreground">Search, buy & manage your calling numbers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadNumbers} className="gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setAvailableNumbers([]); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Get Number</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Get a Phone Number</DialogTitle>
              </DialogHeader>

              <Tabs value={dialogTab} onValueChange={setDialogTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="buy" className="flex-1 gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5" /> Search & Buy
                  </TabsTrigger>
                  <TabsTrigger value="import" className="flex-1 gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Import Existing
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="buy" className="space-y-3 mt-3">
                  <p className="text-xs text-muted-foreground">Search for available Australian numbers via your connected Twilio account.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Area Code (optional)</Label>
                      <Input value={areaCode} onChange={e => setAreaCode(e.target.value)} placeholder="e.g. 02, 03" className="text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Contains (optional)</Label>
                      <Input value={contains} onChange={e => setContains(e.target.value)} placeholder="e.g. 555" className="text-xs" />
                    </div>
                  </div>
                  <Button onClick={searchNumbers} disabled={searching} className="w-full gap-2">
                    {searching ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching...</> : <><Search className="w-4 h-4" /> Search Australian Numbers</>}
                  </Button>

                  {availableNumbers.length > 0 && (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      <p className="text-xs text-muted-foreground">{availableNumbers.length} numbers found</p>
                      {availableNumbers.map(n => (
                        <div key={n.phoneNumber} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                          <div>
                            <p className="text-sm font-mono font-semibold text-foreground">{n.friendlyName || n.phoneNumber}</p>
                            <p className="text-xs text-muted-foreground">{n.locality}{n.region ? `, ${n.region}` : ""}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => buyNumber(n.phoneNumber)}
                            disabled={buying !== null}
                            className="gap-1.5"
                          >
                            {buying === n.phoneNumber ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                            Buy
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="import" className="space-y-3 mt-3">
                  <p className="text-xs text-muted-foreground">Import an existing Twilio number. Vapi requires your Twilio SID & Auth Token to manage the number.</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number (E.164 format)</Label>
                    <Input value={importNumber} onChange={e => setImportNumber(e.target.value)} placeholder="+61412345678" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Twilio Account SID</Label>
                      <Input value={twilioSid} onChange={e => setTwilioSid(e.target.value)} placeholder="ACxxx..." className="text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Twilio Auth Token</Label>
                      <Input type="password" value={twilioAuth} onChange={e => setTwilioAuth(e.target.value)} placeholder="Auth token" className="text-xs" />
                    </div>
                  </div>
                  <Button onClick={handleImport} disabled={importing} className="w-full">
                    {importing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing...</> : "Import Number"}
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading phone numbers...
        </div>
      ) : numbers.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Phone className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No phone numbers yet</p>
            <p className="text-xs text-muted-foreground">Click "Get Number" to search & buy an Australian number</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {numbers.map(n => (
            <Card key={n.id} className="bg-card border-border">
              <CardContent className="pt-4 pb-3 px-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan/20 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{n.number}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{n.provider}</p>
                  </div>
                </div>

                {/* Inbound script assignment */}
                <div className="border-t border-border pt-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <PhoneIncoming className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Inbound Script</span>
                  </div>

                  {assigningNumberId === n.id ? (
                    <div className="space-y-2">
                      <Select value={assigningScriptId} onValueChange={setAssigningScriptId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select inbound script..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (no inbound)</SelectItem>
                          {inboundScripts.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          disabled={savingInbound}
                          onClick={() => assignInboundScript(n.id, assigningScriptId === "none" ? "" : assigningScriptId)}
                        >
                          {savingInbound ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setAssigningNumberId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                      {inboundScripts.length === 0 && (
                        <p className="text-[10px] text-muted-foreground">No inbound scripts found. Create one in the Scripts tab first.</p>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs gap-1.5"
                      onClick={() => {
                        setAssigningNumberId(n.id);
                        setAssigningScriptId(n.assistantId ? "" : "none");
                      }}
                    >
                      {n.assistantId ? (
                        <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" /> Active — Change Script</>
                      ) : (
                        "Assign Inbound Script"
                      )}
                    </Button>
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
