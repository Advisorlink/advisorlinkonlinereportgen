import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BookingPicker } from "@/components/booking/BookingPicker";
import { toast } from "@/components/ui/sonner";
import { Loader2, CheckCircle2, Calendar as CalIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill?: {
    clientName?: string | null;
    clientEmail?: string | null;
    clientPhone?: string | null;
  };
  dealId?: string | null;
  onBooked?: () => void;
  /** When provided, the dialog rebooks (reschedules) the existing booking via this token. */
  rescheduleToken?: string | null;
}

function splitName(full?: string | null): { first: string; last: string } {
  const s = (full || "").trim();
  if (!s) return { first: "", last: "" };
  const parts = s.split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function BookAppointmentDialog({ open, onOpenChange, prefill, dealId, onBooked, rescheduleToken }: Props) {
  const isRebook = !!rescheduleToken;
  const init = splitName(prefill?.clientName);
  const [firstName, setFirstName] = useState(init.first);
  const [lastName, setLastName] = useState(init.last);
  const [email, setEmail] = useState(prefill?.clientEmail || "");
  const [phone, setPhone] = useState(prefill?.clientPhone || "");
  const [notes, setNotes] = useState("");
  const [pickedIso, setPickedIso] = useState<string | null>(null);
  const [pickedTz, setPickedTz] = useState<string>("Australia/Sydney");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { dateStr: string; timeStr: string }>(null);

  // Re-sync prefill whenever the dialog opens or the prefill values change.
  useEffect(() => {
    if (!open) return;
    const { first, last } = splitName(prefill?.clientName);
    setFirstName(first);
    setLastName(last);
    setEmail(prefill?.clientEmail || "");
    setPhone(prefill?.clientPhone || "");
    setNotes("");
    setPickedIso(null);
    setDone(null);
  }, [open, prefill?.clientName, prefill?.clientEmail, prefill?.clientPhone]);

  const submit = async () => {
    if (!pickedIso) return toast.error("Pick a time first");
    setSubmitting(true);

    if (isRebook) {
      const { data, error } = await supabase.functions.invoke("booking-reschedule", {
        body: { token: rescheduleToken, startAt: pickedIso },
      });
      setSubmitting(false);
      if (error || (data && (data as any).error)) {
        toast.error((data as any)?.error || error?.message || "Rebook failed");
        return;
      }
      const d = data as any;
      setDone({ dateStr: d.dateStr, timeStr: d.timeStr });
      onBooked?.();
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName || !email.trim()) {
      setSubmitting(false);
      return toast.error("Name and email required");
    }
    const { data, error } = await supabase.functions.invoke("booking-create", {
      body: {
        startAt: pickedIso,
        clientName: fullName,
        clientEmail: email.trim(),
        clientPhone: phone.trim() || null,
        clientTimezone: pickedTz,
        notes: notes.trim() || null,
        slug: "travis",
        dealId: dealId || null,
        source: "internal",
      },
    });
    setSubmitting(false);
    if (error || (data && (data as any).error)) {
      toast.error((data as any)?.error || error?.message || "Booking failed");
      return;
    }
    setDone({ dateStr: (data as any).booking.dateStr, timeStr: (data as any).booking.timeStr });
    onBooked?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[hsl(var(--navy))] text-white border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <CalIcon className="w-5 h-5 text-cyan" />
            Book Appointment
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Pick a time and we'll send the client confirmation by email & SMS, add it to your Google Calendar, and update the pipeline.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-10 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-cyan mx-auto" />
            <h3 className="text-lg font-semibold">Booked!</h3>
            <p className="text-sm text-white/70">{done.dateStr} at {done.timeStr}</p>
            <Button onClick={() => onOpenChange(false)} className="bg-cyan text-navy hover:bg-cyan-glow">Close</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/60">First name *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs text-white/60">Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs text-white/60">Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs text-white/60">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-white/60">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="bg-white/5 border-white/10 text-white resize-none" />
              </div>
            </div>

            <BookingPicker
              onSelect={(iso, tz) => { setPickedIso(iso); setPickedTz(tz); }}
              selected={pickedIso || undefined}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/70 hover:text-white hover:bg-white/10">Cancel</Button>
              <Button onClick={submit} disabled={!pickedIso || submitting} className="bg-cyan text-navy hover:bg-cyan-glow">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm booking"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
