import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Mail, Phone, DollarSign, Trash2 } from "lucide-react";
import { useRef } from "react";

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
};

const PROGRESS_TOTAL = 8;

interface PipelineDealCardProps {
  deal: Deal;
  isOverlay?: boolean;
  onDelete?: (id: string) => void;
  onClick?: (deal: Deal) => void;
}

export function PipelineDealCard({ deal, isOverlay, onDelete, onClick }: PipelineDealCardProps) {
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
          <p className="text-sm font-semibold text-foreground truncate">{deal.client_name}</p>
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
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {(deal.client_email || deal.client_phone) && (
        <div className="mt-2.5 pt-2.5 border-t border-border/30 space-y-1">
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
              <a
                href={`sip:${localNumber}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                {localNumber}
              </a>
            );
          })()}
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
