import { useEffect, useMemo, useState } from "react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, startOfDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Globe2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BookingPickerSlots {
  /** keyed by YYYY-MM-DD (client tz) → array of UTC ISO start times */
  slots: Record<string, string[]>;
  hostTz: string;
  clientTz: string;
  settings: {
    host_name: string;
    host_title: string;
    meeting_title: string;
    meeting_description: string;
    meeting_duration_minutes: number;
  };
}

interface Props {
  slug?: string;
  onSelect: (utcIso: string, tz: string) => void;
  selected?: string;
}

const COMMON_TZS = [
  "Australia/Sydney","Australia/Melbourne","Australia/Brisbane","Australia/Perth","Australia/Adelaide","Australia/Darwin",
  "Pacific/Auckland","Asia/Singapore","Asia/Tokyo","Asia/Hong_Kong","Asia/Dubai",
  "Europe/London","Europe/Paris","America/New_York","America/Los_Angeles",
];

export function BookingPicker({ slug = "travis", onSelect, selected }: Props) {
  const browserTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Sydney", []);
  const [tz, setTz] = useState(browserTz);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [data, setData] = useState<BookingPickerSlots | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const from = format(startOfMonth(month), "yyyy-MM-dd");
    const fnUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/booking-availability`;
    fetch(`${fnUrl}?from=${from}&days=45&tz=${encodeURIComponent(tz)}&slug=${slug}`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, tz, slug]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startWeekday = startOfMonth(month).getDay();
  const pad = Array.from({ length: startWeekday }, (_, i) => i);
  const today = startOfDay(new Date());

  const dayHasSlots = (day: Date) => {
    if (!data?.slots) return false;
    const key = format(day, "yyyy-MM-dd");
    return (data.slots[key]?.length ?? 0) > 0;
  };

  const slotsForSelected = selectedDay && data
    ? (data.slots[format(selectedDay, "yyyy-MM-dd")] ?? [])
    : [];

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setMonth(addMonths(month, -1))}
            disabled={isBefore(addMonths(month, -1), startOfMonth(today))}
            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-base font-semibold tracking-tight">{format(month, "MMMM yyyy")}</h3>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            className="p-2 rounded-lg hover:bg-white/10 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-white/40 mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {pad.map(i => <div key={`p${i}`} />)}
          {days.map(day => {
            const isPast = isBefore(day, today);
            const hasSlots = !isPast && dayHasSlots(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            return (
              <button
                key={day.toISOString()}
                disabled={!hasSlots}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "aspect-square rounded-lg text-sm font-medium transition relative",
                  hasSlots && !isSelected && "bg-cyan/10 text-white hover:bg-cyan/20 ring-1 ring-cyan/30",
                  hasSlots && isSelected && "bg-cyan text-navy ring-2 ring-cyan-glow shadow-glow",
                  !hasSlots && "text-white/20 cursor-not-allowed",
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-2 text-xs text-white/50">
          <Globe2 className="w-3.5 h-3.5" />
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="bg-transparent border border-white/10 rounded-md px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-cyan/50"
          >
            {[browserTz, ...COMMON_TZS.filter(t => t !== browserTz)].map(t => (
              <option key={t} value={t} className="bg-navy text-white">{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 backdrop-blur-sm min-h-[420px]">
        <div className="flex items-center gap-2 text-sm font-semibold mb-1">
          <Clock className="w-4 h-4 text-cyan" />
          {selectedDay ? format(selectedDay, "EEEE, MMMM d") : "Pick a date"}
        </div>
        <p className="text-xs text-white/40 mb-4">{data?.settings?.meeting_duration_minutes ?? 45} min · {tz}</p>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !selectedDay ? (
          <div className="text-center text-xs text-white/40 py-10">
            Choose a highlighted day to see available times.
          </div>
        ) : slotsForSelected.length === 0 ? (
          <div className="text-center text-xs text-white/40 py-10">
            No times left on this day.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
            {slotsForSelected.map(iso => {
              const isSel = selected === iso;
              const t = new Date(iso);
              const label = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).format(t);
              return (
                <Button
                  key={iso}
                  variant={isSel ? "default" : "outline"}
                  className={cn(
                    "h-10 text-sm",
                    isSel
                      ? "bg-cyan text-navy hover:bg-cyan-glow border-cyan"
                      : "bg-white/[0.03] border-white/10 text-white hover:bg-cyan/15 hover:border-cyan/40",
                  )}
                  onClick={() => onSelect(iso, tz)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
