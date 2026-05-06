import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Phone, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PhoneNumber {
  id: string;
  number: string;
  provider: string;
  name?: string;
  createdAt?: string;
}

export function AICallerPhoneNumbers() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [areaCode, setAreaCode] = useState("");

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
        number: p.number || p.twilioPhoneNumber || p.vonagePhoneNumber || "Unknown",
        provider: p.provider || "twilio",
        name: p.name,
        createdAt: p.createdAt,
      }));
      setNumbers(nums);
    } catch (e: any) {
      console.error("Failed to load phone numbers:", e);
      toast.error(e.message || "Failed to load phone numbers");
    } finally {
      setLoading(false);
    }
  }

  async function buyNumber() {
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-manage", {
        body: {
          action: "buy-phone-number",
          areaCode: areaCode.trim() || undefined,
          countryCode: "AU",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Australian phone number purchased!");
      setDialogOpen(false);
      setAreaCode("");
      loadNumbers();
    } catch (e: any) {
      toast.error(e.message || "Failed to buy number. Make sure you have Twilio credits in your Vapi account.");
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Phone Numbers</h2>
          <p className="text-sm text-muted-foreground">Manage your Australian calling numbers via Vapi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadNumbers} className="gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Buy Number</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Buy Australian Phone Number</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Purchase an Australian phone number through your Vapi account. This will be charged to your Vapi/Twilio billing.
                </p>
                <div className="space-y-2">
                  <Label>Area Code (optional)</Label>
                  <Input
                    value={areaCode}
                    onChange={e => setAreaCode(e.target.value)}
                    placeholder="e.g. 02 for Sydney, 03 for Melbourne"
                  />
                  <p className="text-xs text-muted-foreground">Leave blank for any available AU number</p>
                </div>
                <Button onClick={buyNumber} disabled={buying} className="w-full">
                  {buying ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Purchasing...</> : "Buy Number"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading phone numbers from Vapi...
        </div>
      ) : numbers.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Phone className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No phone numbers yet</p>
            <p className="text-xs text-muted-foreground">Buy an Australian number to start making AI calls</p>
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
                {n.name && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">{n.name}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{n.id}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-muted/30 border-border">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> You can also buy and manage phone numbers directly in your{" "}
            <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-cyan underline">
              Vapi dashboard
            </a>. Numbers purchased there will appear here automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
