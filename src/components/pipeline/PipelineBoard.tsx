import { useEffect, useState, useCallback, useMemo } from "react";
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
import { PipelineColumn } from "./PipelineColumn";
import { PipelineDealCard } from "./PipelineDealCard";
import { AddDealDialog } from "./AddDealDialog";
import { DealProfileDrawer } from "./DealProfileDrawer";
import { LostReasonDialog } from "./LostReasonDialog";
import { Kanban, Plus, DollarSign, Trophy, XCircle, Layers, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  lost_reason_id?: string | null;
  lost_reason_note?: string | null;
};

type ViewFilter = "active" | "won" | "lost" | "all";

const isLostStage = (s?: Stage) => !!s && s.name.toLowerCase() === "lost";
const isWonStage = (s?: Stage) => !!s && s.name.toLowerCase() === "won";

export function PipelineBoard() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [addToStage, setAddToStage] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewFilter>("active");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [pendingLost, setPendingLost] = useState<{
    dealId: string;
    targetStageId: string;
    previousStageId: string;
    clientName: string;
  } | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const fetchData = useCallback(async () => {
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase.from("pipeline_stages").select("*").order("position"),
      supabase.from("pipeline_deals").select("*").order("position"),
    ]);
    setStages(s || []);
    setDeals((d as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleStages = useMemo(() => {
    if (view === "all") return stages;
    if (view === "won") return stages.filter(isWonStage);
    if (view === "lost") return stages.filter(isLostStage);
    return stages.filter((s) => !isWonStage(s) && !isLostStage(s));
  }, [stages, view]);

  const dealsInStage = (stageId: string) =>
    deals.filter((d) => d.stage_id === stageId).sort((a, b) => a.position - b.position);

  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const wonCount = deals.filter((d) => isWonStage(stages.find((s) => s.id === d.stage_id))).length;
  const lostCount = deals.filter((d) => isLostStage(stages.find((s) => s.id === d.stage_id))).length;
  const activeCount = deals.length - wonCount - lostCount;

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeDealItem = deals.find((d) => d.id === activeId);
    if (!activeDealItem) return;

    const overStage = stages.find((s) => s.id === overId);
    const overDeal = deals.find((d) => d.id === overId);
    const newStageId = overStage?.id || overDeal?.stage_id;
    if (!newStageId || activeDealItem.stage_id === newStageId) return;

    setDeals((prev) =>
      prev.map((d) =>
        d.id === activeId ? { ...d, stage_id: newStageId } : d
      )
    );
  };

  const persistMove = async (dealId: string, targetStageId: string, extra: Record<string, any> = {}) => {
    const stageDeals = deals
      .filter((d) => d.stage_id === targetStageId && d.id !== dealId)
      .sort((a, b) => a.position - b.position);
    const newPosition = stageDeals.length;

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, stage_id: targetStageId, position: newPosition, ...extra } : d
      )
    );

    const { error } = await supabase
      .from("pipeline_deals")
      .update({ stage_id: targetStageId, position: newPosition, ...extra })
      .eq("id", dealId);

    if (error) {
      toast({ title: "Failed to move deal", variant: "destructive" });
      fetchData();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const dragged = activeDeal;
    setActiveDeal(null);
    if (!over) { fetchData(); return; }

    const activeId = active.id as string;
    const deal = deals.find((d) => d.id === activeId) || dragged;
    if (!deal) return;

    const overStage = stages.find((s) => s.id === (over.id as string));
    const overDeal = deals.find((d) => d.id === (over.id as string));
    const targetStageId = overStage?.id || overDeal?.stage_id || deal.stage_id;
    const targetStage = stages.find((s) => s.id === targetStageId);

    // If moving INTO a Lost stage from a non-Lost stage → ask for reason first
    const previousStage = stages.find((s) => s.id === dragged?.stage_id);
    if (
      isLostStage(targetStage) &&
      !isLostStage(previousStage) &&
      dragged
    ) {
      setPendingLost({
        dealId: deal.id,
        targetStageId,
        previousStageId: dragged.stage_id,
        clientName: deal.client_name,
      });
      return;
    }

    // If moving OUT of Lost → clear the reason
    const extra: Record<string, any> = {};
    if (isLostStage(previousStage) && !isLostStage(targetStage)) {
      extra.lost_reason_id = null;
      extra.lost_reason_note = null;
    }

    await persistMove(activeId, targetStageId, extra);
  };

  const handleConfirmLost = async (reasonId: string, note: string) => {
    if (!pendingLost) return;
    await persistMove(pendingLost.dealId, pendingLost.targetStageId, {
      lost_reason_id: reasonId,
      lost_reason_note: note || null,
    });
    setPendingLost(null);
    toast({ title: "Marked as lost" });
  };

  const handleCancelLost = () => {
    if (!pendingLost) return;
    // revert UI
    const { dealId, previousStageId } = pendingLost;
    setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage_id: previousStageId } : d));
    setPendingLost(null);
  };

  const handleDealAdded = () => {
    setAddToStage(null);
    fetchData();
  };

  const handleDeleteDeal = async (dealId: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    await supabase.from("pipeline_deals").delete().eq("id", dealId);
  };

  const handleDealClick = (deal: Deal) => setSelectedDeal(deal);

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

  const filterTabs: { id: ViewFilter; label: string; count: number; icon: any; tone: string }[] = [
    { id: "active", label: "Active", count: activeCount, icon: Kanban, tone: "text-primary" },
    { id: "won", label: "Won", count: wonCount, icon: Trophy, tone: "text-emerald-600" },
    { id: "lost", label: "Lost", count: lostCount, icon: XCircle, tone: "text-destructive" },
    { id: "all", label: "All", count: deals.length, icon: Layers, tone: "text-muted-foreground" },
  ];

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
              onClick={() => setAddToStage(stages.find((s) => !isWonStage(s) && !isLostStage(s))?.id || stages[0]?.id || null)}
              className="gradient-accent text-white border-0 shadow-lg shadow-cyan/20 hover:shadow-cyan/30 gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Deal</span>
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-4 flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl w-fit">
          {filterTabs.map((t) => {
            const Icon = t.icon;
            const isActive = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? t.tone : ""}`} />
                {t.label}
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-muted text-foreground" : "bg-background/60 text-muted-foreground"
                }`}>
                  {t.count}
                </span>
              </button>
            );
          })}
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
            {visibleStages.map((stage) => {
              const stageDeals = dealsInStage(stage.id);
              return (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  deals={stageDeals}
                  onAddDeal={() => setAddToStage(stage.id)}
                  onDeleteDeal={handleDeleteDeal}
                  onDealClick={handleDealClick}
                />
              );
            })}
            {visibleStages.length === 0 && (
              <div className="flex items-center justify-center w-full text-sm text-muted-foreground">
                Nothing here yet.
              </div>
            )}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
            {activeDeal ? <PipelineDealCard deal={activeDeal as any} isOverlay /> : null}
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

      <DealProfileDrawer
        deal={selectedDeal as any}
        stages={stages}
        open={!!selectedDeal}
        onOpenChange={(open) => { if (!open) setSelectedDeal(null); }}
        onDealUpdated={() => { fetchData(); }}
        onDeleteDeal={handleDeleteDeal}
      />

      <LostReasonDialog
        open={!!pendingLost}
        clientName={pendingLost?.clientName}
        onConfirm={handleConfirmLost}
        onCancel={handleCancelLost}
      />
    </div>
  );
}
