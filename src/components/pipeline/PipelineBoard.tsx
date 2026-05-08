import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PipelineColumn } from "./PipelineColumn";
import { PipelineDealCard } from "./PipelineDealCard";
import { AddDealDialog } from "./AddDealDialog";
import { Kanban, Plus, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

export function PipelineBoard() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [addToStage, setAddToStage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const fetchData = useCallback(async () => {
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase.from("pipeline_stages").select("*").order("position"),
      supabase.from("pipeline_deals").select("*").order("position"),
    ]);
    setStages(s || []);
    setDeals(d || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dealsInStage = (stageId: string) =>
    deals.filter((d) => d.stage_id === stageId).sort((a, b) => a.position - b.position);

  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeDeal = deals.find((d) => d.id === activeId);
    if (!activeDeal) return;

    // Check if dropping over a stage column
    const overStage = stages.find((s) => s.id === overId);
    // Or over another deal
    const overDeal = deals.find((d) => d.id === overId);

    const newStageId = overStage?.id || overDeal?.stage_id;
    if (!newStageId || activeDeal.stage_id === newStageId) return;

    setDeals((prev) =>
      prev.map((d) =>
        d.id === activeId ? { ...d, stage_id: newStageId } : d
      )
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    if (!over) return;

    const activeId = active.id as string;
    const deal = deals.find((d) => d.id === activeId);
    if (!deal) return;

    // Determine target stage
    const overStage = stages.find((s) => s.id === (over.id as string));
    const overDeal = deals.find((d) => d.id === (over.id as string));
    const targetStageId = overStage?.id || overDeal?.stage_id || deal.stage_id;

    // Calculate new position
    const stageDeals = deals
      .filter((d) => d.stage_id === targetStageId && d.id !== activeId)
      .sort((a, b) => a.position - b.position);

    let newPosition = 0;
    if (overDeal) {
      const overIndex = stageDeals.findIndex((d) => d.id === overDeal.id);
      newPosition = overIndex >= 0 ? overIndex : stageDeals.length;
    } else {
      newPosition = stageDeals.length;
    }

    // Optimistic update
    const updated = deals.map((d) => {
      if (d.id === activeId) return { ...d, stage_id: targetStageId, position: newPosition };
      return d;
    });
    setDeals(updated);

    const { error } = await supabase
      .from("pipeline_deals")
      .update({ stage_id: targetStageId, position: newPosition })
      .eq("id", activeId);

    if (error) {
      toast({ title: "Failed to move deal", variant: "destructive" });
      fetchData();
    }
  };

  const handleDealAdded = () => {
    setAddToStage(null);
    fetchData();
  };

  const handleDeleteDeal = async (dealId: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    await supabase.from("pipeline_deals").delete().eq("id", dealId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
            <Kanban className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Loading pipeline…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/50 bg-white/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between max-w-full">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground tracking-tight flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-lg shadow-cyan/20">
                <Kanban className="w-4.5 h-4.5 text-white" />
              </div>
              Pipeline
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {deals.length} deal{deals.length !== 1 ? "s" : ""} in pipeline
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200/50">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">
                ${totalValue.toLocaleString()}
              </span>
            </div>
            <Button
              onClick={() => setAddToStage(stages[0]?.id || null)}
              className="gradient-accent text-white border-0 shadow-lg shadow-cyan/20 hover:shadow-cyan/30 gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Deal</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max">
            {stages.map((stage) => {
              const stageDeals = dealsInStage(stage.id);
              return (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  deals={stageDeals}
                  onAddDeal={() => setAddToStage(stage.id)}
                  onDeleteDeal={handleDeleteDeal}
                />
              );
            })}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
            {activeDeal ? <PipelineDealCard deal={activeDeal} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      <AddDealDialog
        open={!!addToStage}
        onOpenChange={(open) => !open && setAddToStage(null)}
        stageId={addToStage || ""}
        stages={stages}
        onDealAdded={handleDealAdded}
      />
    </div>
  );
}
