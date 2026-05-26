import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BookingPicker } from "@/components/booking/BookingPicker";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.svg";

export default function ReschedulePublic() {
  const { token = "" } = useParams();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pickedIso, setPickedIso] = useState<string | null>(null);
  const [pickedTz, setPickedTz] = useState("Australia/Sydney");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_booking_by_token", { _token: token });
      if (error) toast.error("Invalid link");
      else setBooking((data as any)?.[0] || null);
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (!pickedIso) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-reschedule", {
        body: { token, startAt: pickedIso },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setDone(data);
    } catch (e: any) {
      toast.error(e.message || "Couldn't reschedule");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06101f] text-white">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 30% 0%, hsl(192 90% 50% / 0.18), transparent 60%)" }}
      />
      <div className="relative max-w-4xl mx-auto px-4 py-10 sm:py-16">
        <header className="flex items-center justify-between mb-10">
          <img src={logo} alt="Advisor Link Online" className="h-10 w-auto" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-cyan/70 font-semibold">Reschedule</div>
        </header>

        {loading ? <div className="text-center text-white/40 py-20">Loading…</div>
          : !booking ? <div className="text-center text-white/40 py-20">This link is no longer valid.</div>
          : done ? (
            <div className="max-w-md mx-auto rounded-2xl bg-white/[0.04] border border-white/10 p-8 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-cyan/15 flex items-center justify-center mb-4 shadow-glow">
                <CheckCircle2 className="w-8 h-8 text-cyan" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Rescheduled!</h2>
              <p className="text-white/60">{done.dateStr} at {done.timeStr} ({done.tz})</p>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Pick a new time</h1>
              <p className="text-white/60 mb-6">
                Currently booked for{" "}
                {new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: booking.client_timezone }).format(new Date(booking.start_at))}{" "}
                ({booking.client_timezone}).
              </p>
              {pickedIso ? (
                <div className="max-w-md mx-auto rounded-2xl bg-white/[0.04] border border-white/10 p-6">
                  <button onClick={() => setPickedIso(null)} className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-4">
                    <ArrowLeft className="w-3.5 h-3.5" /> Pick a different time
                  </button>
                  <div className="p-4 rounded-xl bg-cyan/10 border border-cyan/30 mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-cyan/80 font-semibold mb-1">New slot</div>
                    <div className="font-semibold">
                      {new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: pickedTz }).format(new Date(pickedIso))}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">{pickedTz}</div>
                  </div>
                  <Button onClick={submit} disabled={busy} className="w-full h-12 bg-cyan text-navy hover:bg-cyan-glow font-semibold shadow-glow">
                    {busy ? "Saving…" : "Confirm new time"}
                  </Button>
                </div>
              ) : (
                <BookingPicker onSelect={(iso, tz) => { setPickedIso(iso); setPickedTz(tz); }} />
              )}
            </div>
          )}
      </div>
    </div>
  );
}
