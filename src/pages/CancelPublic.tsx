import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { CheckCircle2, X } from "lucide-react";
import logo from "@/assets/logo.svg";

export default function CancelPublic() {
  const { token = "" } = useParams();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_booking_by_token", { _token: token });
      if (error) toast.error("Invalid link");
      else setBooking((data as any)?.[0] || null);
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-cancel", { body: { token, reason } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setDone(true);
    } catch (e: any) {
      toast.error(e.message || "Couldn't cancel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06101f] text-white">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 30% 0%, hsl(192 90% 50% / 0.12), transparent 60%)" }} />
      <div className="relative max-w-md mx-auto px-4 py-10 sm:py-16">
        <header className="flex items-center justify-between mb-10">
          <img src={logo} alt="Advisor Link Online" className="h-10 w-auto" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-semibold">Cancel booking</div>
        </header>

        {loading ? <div className="text-center text-white/40 py-20">Loading…</div>
          : !booking ? <div className="text-center text-white/40 py-20">This link is no longer valid.</div>
          : done || booking.status === "cancelled" ? (
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-8 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-cyan" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Cancelled</h2>
              <p className="text-white/60">If this was a mistake, just book again any time.</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-center mb-2">Cancel your call?</h1>
              <p className="text-center text-white/60 text-sm mb-6">
                {new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: booking.client_timezone }).format(new Date(booking.start_at))}
              </p>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" rows={3}
                className="bg-white/[0.04] border-white/10 text-white mb-4" />
              <Button onClick={submit} disabled={busy} variant="destructive" className="w-full h-12">
                {busy ? "Cancelling…" : "Yes, cancel my call"}
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
