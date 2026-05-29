import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Mail, Phone, DollarSign, Trash2, MessageSquare } from "lucide-react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";

type Deal = {
  id: string;
  stage_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  value: number | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  progress_stages?: string[] | null;
  source?: string | null;
};

const PROGRESS_TOTAL = 8;

interface PipelineDealCardProps {
  deal: Deal;
  isOverlay?: boolean;
  onDelete?: (id: string) => void;
  onClick?: (deal: Deal) => void;
}

export function PipelineDealCard({ deal, isOverlay, onDelete, onClick }: PipelineDealCardProps) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const initials = deal.client_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!pointerStart.current) {
      onClick?.(deal);
      return;
    }
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    // Only open profile if the pointer barely moved (not a drag)
    if (dx < 5 && dy < 5) {
      onClick?.(deal);
    }
    pointerStart.current = null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group bg-card rounded-xl border border-border/60 p-3 shadow-sm
        transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging ? "opacity-30 scale-95" : "hover:shadow-md hover:border-border hover:-translate-y-0.5"}
        ${isOverlay ? "shadow-xl rotate-2 scale-105 border-primary/30" : ""}
      `}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        handlePointerDown(e);
        listeners?.onPointerDown?.(e);
      }}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center shrink-0 text-[11px] font-bold text-white shadow-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{deal.client_name}</p>
            <AgePill createdAt={deal.created_at} />
            {deal.source && <SourceTag source={deal.source} />}
          </div>
          {deal.value != null && deal.value > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <DollarSign className="w-3 h-3 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">
                {deal.value.toLocaleString()}
              </span>
            </div>
          )}
        </div>
        {!isOverlay && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(deal.id); }}
            className="opacity-100 p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {(deal.client_email || deal.client_phone) && (
        <div className="mt-2.5 pt-2.5 border-t border-border/30 space-y-1.5">
          {deal.client_email && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
              <Mail className="w-3 h-3 shrink-0" />
              {deal.client_email}
            </div>
          )}
          {deal.client_phone && (() => {
            const localNumber = deal.client_phone
              .replace(/\s+/g, "")
              .replace(/^\+61/, "0");
            return (
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`sip:${localNumber}`}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-emerald-600 transition-colors"
                  title="Call"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  {localNumber}
                </a>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const phone = (deal.client_phone || "").trim();
                      if (!phone) return;
                      const params = new URLSearchParams({ phone });
                      if (deal.client_name) params.set("name", deal.client_name);
                      navigate(`/messages?${params.toString()}`);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-7 h-7 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/20 flex items-center justify-center transition-colors ring-1 ring-cyan-500/20"
                    title="Send SMS"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                  {deal.client_email && (
                    <a
                      href={`mailto:${deal.client_email}`}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/20 flex items-center justify-center transition-colors ring-1 ring-indigo-500/20"
                      title="Send Email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
          {!deal.client_phone && deal.client_email && (
            <div className="flex items-center justify-end">
              <a
                href={`mailto:${deal.client_email}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/20 flex items-center justify-center transition-colors ring-1 ring-indigo-500/20"
                title="Send Email"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

        </div>
      )}



      {deal.progress_stages && deal.progress_stages.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-border/30">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(deal.progress_stages.length / PROGRESS_TOTAL) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
              {deal.progress_stages.length}/{PROGRESS_TOTAL}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function AgePill({ createdAt }: { createdAt: string }) {
  const created = new Date(createdAt);
  const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));

  let label: string;
  if (days === 0) label = "Today";
  else if (days === 1) label = "1d";
  else if (days < 7) label = `${days}d`;
  else if (days < 30) label = `${Math.floor(days / 7)}w`;
  else if (days < 365) label = `${Math.floor(days / 30)}mo`;
  else label = `${Math.floor(days / 365)}y`;

  // Color ramp: fresh -> stale
  const tone =
    days <= 1
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"
      : days <= 7
      ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/30"
      : days <= 30
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30"
      : "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30";

  return (
    <span
      title={created.toLocaleString()}
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  );
}

const SOURCE_TONES = [
  "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30",
  "bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500/30",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/30",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/30",
  "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30",
  "bg-lime-500/15 text-lime-700 dark:text-lime-300 ring-1 ring-lime-500/30",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/30",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/30",
  "bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/30",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/30",
];

function SourceTag({ source }: { source: string }) {
  const label = source.trim();
  if (!label) return null;
  let hash = 0;
  const key = label.toLowerCase();
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const tone = SOURCE_TONES[hash % SOURCE_TONES.length];
  return (
    <span
      title={`Source: ${label}`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  );
}
