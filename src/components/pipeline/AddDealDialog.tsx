import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Stage = { id: string; name: string; color: string; position: number };

interface AddDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  stages: Stage[];
  onDealAdded: () => void;
}

export function AddDealDialog({ open, onOpenChange, stageId, stages, onDealAdded }: AddDealDialogProps) {
  const [saving, setSaving] = useState(false);
  const [selectedStage, setSelectedStage] = useState(stageId);
  const [form, setForm] = useState({ client_name: "", client_email: "", client_phone: "", value: "", notes: "" });
  const { toast } = useToast();

  // Sync stageId when dialog opens
  const effectiveStage = selectedStage || stageId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name.trim()) return;
    setSaving(true);

    // Brand-new manual deals appear at the TOP of the chosen stage.
    // Shift existing deals in this stage down by 1, then insert at position 0.
    const { data: existing } = await supabase
      .from("pipeline_deals")
      .select("id, position")
      .eq("stage_id", effectiveStage);
    if (existing && existing.length) {
      await Promise.all(
        existing.map((d: any) =>
          supabase
            .from("pipeline_deals")
            .update({ position: (d.position ?? 0) + 1 })
            .eq("id", d.id)
        )
      );
    }

    const { error } = await supabase.from("pipeline_deals").insert({
      stage_id: effectiveStage,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || null,
      client_phone: form.client_phone.trim() || null,
      value: form.value ? parseFloat(form.value) : null,
      notes: form.notes.trim() || null,
      position: 0,
    });

    setSaving(false);
    if (error) {
      toast({ title: "Failed to add deal", variant: "destructive" });
      return;
    }

    setForm({ client_name: "", client_email: "", client_phone: "", value: "", notes: "" });
    onDealAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Add New Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="stage">Stage</Label>
            <Select value={effectiveStage} onValueChange={setSelectedStage}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="name">Client Name *</Label>
            <Input
              id="name"
              value={form.client_name}
              onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))}
              placeholder="John Smith"
              className="mt-1.5"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.client_email}
                onChange={(e) => setForm((p) => ({ ...p, client_email: e.target.value }))}
                placeholder="john@email.com"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.client_phone}
                onChange={(e) => setForm((p) => ({ ...p, client_phone: e.target.value }))}
                placeholder="0412 345 678"
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="value">Deal Value ($)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
              placeholder="50,000"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Any relevant details…"
              className="mt-1.5 resize-none"
              rows={2}
            />
          </div>
          <Button type="submit" disabled={saving || !form.client_name.trim()} className="w-full gradient-accent text-white border-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Deal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
