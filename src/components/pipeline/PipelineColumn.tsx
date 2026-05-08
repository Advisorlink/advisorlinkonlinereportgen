import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PipelineDealCard } from "./PipelineDealCard";
import { Plus } from "lucide-react";

type Stage = { id: string; name: string; color: string; position: number };
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
};

interface PipelineColumnProps {
  stage: Stage;
  deals: Deal[];
  onAddDeal: () => void;
  onDeleteDeal: (id: string) => void;
}

export function PipelineColumn({ stage, deals, onAddDeal, onDeleteDeal }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const stageValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div
      className={`
        w-[300px] shrink-0 flex flex-col rounded-2xl transition-all duration-300
        ${isOver
          ? "bg-accent/50 ring-2 ring-primary/20 shadow-lg scale-[1.01]"
          : "bg-muted/40 border border-border/30"
        }
      `}
    >
      {/* Column header */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div
            className="w-3.5 h-3.5 rounded-full shadow-sm ring-2 ring-white"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-sm font-bold text-foreground tracking-tight uppercase">{stage.name}</h3>
          <span className="ml-auto text-xs font-bold text-foreground bg-background px-2.5 py-1 rounded-full border border-border/50 shadow-sm">
            {deals.length}
          </span>
        </div>
        {stageValue > 0 && (
          <p className="text-xs text-muted-foreground font-semibold pl-6">
            ${stageValue.toLocaleString()}
          </p>
        )}
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[80px] scrollbar-thin"
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <PipelineDealCard key={deal.id} deal={deal} onDelete={onDeleteDeal} />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed border-border/40 text-muted-foreground/40">
            <p className="text-xs">Drop deals here</p>
          </div>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={onAddDeal}
        className="mx-2 mb-2 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all duration-200"
      >
        <Plus className="w-3.5 h-3.5" />
        Add deal
      </button>
    </div>
  );
}
