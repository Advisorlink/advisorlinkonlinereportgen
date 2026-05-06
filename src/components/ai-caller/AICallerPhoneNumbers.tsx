import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Phone, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface PhoneNumber {
  id: string;
  number: string;
  provider: string;
  name?: string;
}

export function AICallerPhoneNumbers() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioAuth, setTwilioAuth] = useState("");

  useEffect(() => { loadNumbers(); }, []);

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
      }));
      setNumbers(nums);
    } catch (e: any) {
      console.error("Failed to load phone numbers:", e);
    } finally {
      setLoading(false);
    }
  }

  async function importNumber() {
    if (!phoneNumber.trim() || !twilioSid.trim() || !twilioAuth.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (!phoneNumber.startsWith("+")) {
      toast.error("Phone number must be in E.164 format (e.g. +61412345678)");
      return;
    }

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: {
          action: "import-phone-number",
          number: phoneNumber.trim(),
          twilioAccountSid: twilioSid.trim(),
          twilioAuthToken: twilioAuth.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Phone number imported successfully!");
      setDialogOpen(false);
      setPhoneNumber("");
      setTwilioSid("");
      setTwilioAuth("");
      loadNumbers();
    } catch (e: any) {
      toast.error(e.message || "Failed to import number");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Phone Numbers</h2>
          <p className="text-sm text-muted-foreground">Manage your calling numbers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadNumbers} className="gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Import Number</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Import Twilio Phone Number</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Import an Australian phone number from your Twilio account. You'll need the number, your Twilio Account SID, and Auth Token.
                </p>

                <div className="space-y-2">
                  <Label>Phone Number (E.164 format)</Label>
                  <Input
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="+61412345678"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Twilio Account SID</Label>
                  <Input
                    value={twilioSid}
                    onChange={e => setTwilioSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Twilio Auth Token</Label>
                  <Input
                    type="password"
                    value={twilioAuth}
                    onChange={e => setTwilioAuth(e.target.value)}
                    placeholder="Your Twilio auth token"
                  />
                </div>

                <Button onClick={importNumber} disabled={importing} className="w-full">
                  {importing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing...</> : "Import Number"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Don't have a Twilio number?{" "}
                  <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/search" target="_blank" rel="noopener noreferrer" className="text-cyan underline">
                    Buy one on Twilio
                  </a>
                </p>
              </div>
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
            <p className="text-xs text-muted-foreground">Import a Twilio number or buy one from the Vapi dashboard</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {numbers.map(n => (
            <Card key={n.id} className="bg-card border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan/20 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{n.number}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{n.provider}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-muted/30 border-border">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            <strong>How it works:</strong> 1) Buy a phone number on{" "}
            <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-cyan underline">Twilio</a>
            {" "}→ 2) Import it here with your Twilio credentials → 3) Use it in your campaigns. You can also manage numbers in your{" "}
            <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-cyan underline">Vapi dashboard</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
