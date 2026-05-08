import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, X, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type LostReason = { id: string; name: string; position: number };

interface LostReasonDialogProps {
  open: boolean;
  clientName?: string;
  onConfirm: (reasonId: string, note: string) => void;
  onCancel: () => void;
}

export function LostReasonDialog({ open, clientName, onConfirm, onCancel }: LostReasonDialogProps) {
  const [reasons, setReasons] = useState<LostReason[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchReasons = async () => {
    const { data } = await supabase
      .from("pipeline_lost_reasons" as any)
      .select("*")
      .order("position");
    setReasons((data as any) || []);
  };

  useEffect(() => {
    if (open) {
      setSelected(null);
      setNote("");
      setNewReason("");
      setAdding(false);
      fetchReasons();
    }
  }, [open]);

  const handleAddReason = async () => {
    const name = newReason.trim();
    if (!name) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("pipeline_lost_reasons" as any)
      .insert({ name, position: reasons.length } as any)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Could not add reason", description: error.message, variant: "destructive" });
      return;
    }
    const r = data as any as LostReason;
    setReasons((p) => [...p, r]);
    setSelected(r.id);
    setNewReason("");
    setAdding(false);
  };

  const handleConfirm = () => {
    if (!selected) {
      toast({ title: "Pick a reason", variant: "destructive" });
      return;
    }
    onConfirm(selected, note.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
          <DialogTitle>Mark deal as Lost</DialogTitle>
          <DialogDescription>
            {clientName ? <>Why are you losing <span className="font-medium text-foreground">{clientName}</span>?</> : "Pick a reason this deal was lost."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Reason</Label>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  selected === r.id
                    ? "bg-destructive text-destructive-foreground border-destructive shadow-sm"
                    : "bg-muted/40 border-border/60 hover:border-destructive/50 hover:bg-destructive/5"
                }`}
              >
                {r.name}
              </button>
            ))}
            {!adding ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="px-3 py-1.5 rounded-full text-sm border border-dashed border-border hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add reason
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-muted/30 border border-border rounded-full pl-3 pr-1 py-0.5">
                <input
                  autoFocus
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddReason()}
                  placeholder="New reason"
                  className="bg-transparent text-sm outline-none w-32"
                />
                <Button size="sm" variant="ghost" onClick={handleAddReason} disabled={saving || !newReason.trim()} className="h-7 px-2">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                </Button>
                <button onClick={() => { setAdding(false); setNewReason(""); }} className="p-1 hover:bg-muted rounded-full">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="lost-note" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="lost-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any extra context…"
              rows={2}
              className="mt-1 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} className="flex-1" disabled={!selected}>
            Mark as Lost
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
