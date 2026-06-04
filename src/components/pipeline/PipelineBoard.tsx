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
  tags?: string[] | null;
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

  useEffect(() => {
    const channel = supabase
      .channel("pipeline-deals-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_deals" },
        () => fetchData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const visibleStages = useMemo(() => {
    if (view === "all") return stages;
    if (view === "won") return stages.filter(isWonStage);
    if (view === "lost") return stages.filter(isLostStage);
    return stages.filter((s) => !isWonStage(s) && !isLostStage(s));
  }, [stages, view]);

  const dealsInStage = (stageId: string) => {
    const q = search.trim().toLowerCase();
    return deals
      .filter((d) => d.stage_id === stageId)
      .filter((d) => {
        if (!q) return true;
        return (
          d.client_name?.toLowerCase().includes(q) ||
          d.client_email?.toLowerCase().includes(q) ||
          d.client_phone?.toLowerCase().includes(q) ||
          d.notes?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.position - b.position);
  };

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
    // Drop at TOP: shift other cards in target stage down by 1, place dropped card at position 0
    const otherIds = deals
      .filter((d) => d.stage_id === targetStageId && d.id !== dealId)
      .map((d) => d.id);

    setDeals((prev) =>
      prev.map((d) => {
        if (d.id === dealId) return { ...d, stage_id: targetStageId, position: 0, ...extra };
        if (otherIds.includes(d.id)) return { ...d, position: d.position + 1 };
        return d;
      })
    );

    const { error } = await supabase
      .from("pipeline_deals")
      .update({ stage_id: targetStageId, position: 0, ...extra })
      .eq("id", dealId);

    // Best-effort shift others (ignore errors — UI already updated optimistically)
    if (otherIds.length) {
      await Promise.all(
        otherIds.map((id) => {
          const cur = deals.find((d) => d.id === id);
          return supabase
            .from("pipeline_deals")
            .update({ position: (cur?.position ?? 0) + 1 })
            .eq("id", id);
        })
      );
    }

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

  const handleDealClick = async (deal: Deal) => {
    setSelectedDeal(deal);
    // Auto-fill any missing profile fields from a matching SMS contact (email or phone)
    try {
      const d: any = deal;
      const missing = ["age","state","super_fund_name","super_balance","had_review_before","source","notes"]
        .filter((k) => d[k] == null || d[k] === "");
      if (!missing.length) return;
      let contact: any = null;
      if (d.client_email) {
        const { data } = await supabase
          .from("sms_contacts").select("*").ilike("email", d.client_email).limit(1).maybeSingle();
        if (data) contact = data;
      }
      if (!contact && d.client_phone) {
        const digits = String(d.client_phone).replace(/\D+/g, "");
        if (digits.length >= 6) {
          const { data: all } = await supabase
            .from("sms_contacts").select("*").not("phone", "is", null);
          contact = (all || []).find(
            (x: any) => (x.phone || "").replace(/\D+/g, "").endsWith(digits.slice(-9))
          );
        }
      }
      if (!contact) return;
      const cf = (contact.custom_fields || {}) as Record<string, any>;
      const candidate: Record<string, any> = {
        age: cf.age ?? null,
        state: cf.state ?? null,
        super_fund_name: cf.super_fund_name ?? null,
        super_balance: cf.super_balance != null && cf.super_balance !== "" ? Number(cf.super_balance) : null,
        had_review_before:
          cf.had_review_before === true ? true : cf.had_review_before === false ? false : null,
        source: contact.lead_source ?? null,
        notes: contact.notes ?? null,
      };
      const patch: Record<string, any> = {};
      for (const k of missing) if (candidate[k] != null) patch[k] = candidate[k];
      if (!Object.keys(patch).length) return;
      const { data: updated } = await supabase
        .from("pipeline_deals").update(patch as any).eq("id", d.id).select("*").single();
      if (updated) { setSelectedDeal(updated as any); fetchData(); }
    } catch { /* noop */ }
  };

  const handleSyncQualified = async () => {
    const newLeadStage = stages.find((s) => s.name.toLowerCase() === "new lead");
    if (!newLeadStage) {
      toast({ title: "No 'New Lead' stage found", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const { data: leads, error } = await supabase
        .from("ai_caller_leads")
        .select("*")
        .gte("qualification_score", 80);

      if (error) throw error;

      // Build set of existing phones to avoid duplicates
      const existingKeys = new Set(
        deals.map((d) => {
          const phone = (d.client_phone || "").replace(/\D+/g, "").slice(-9);
          const name = (d.client_name || "").trim().toLowerCase();
          const email = (d.client_email || "").trim().toLowerCase();
          return email || `${name}|${phone}`;
        })
      );

      const toInsert: any[] = [];
      const summariesByPhone = new Map<string, string>();
      for (const l of leads || []) {
        const cleanPhone = (l.phone || "").replace(/\D+/g, "").slice(-9);
        const cleanName = (l.name || "").trim().toLowerCase();
        const cleanEmail = (l.email || "").trim().toLowerCase();
        const leadKey = cleanEmail || `${cleanName}|${cleanPhone}`;
        if (leadKey && existingKeys.has(leadKey)) continue;
        const f: any = l.extracted_fields || {};
        const leadEmail = (l.email || f.email || "").trim() || null;
        const balanceNum = f.balance ? Number(String(f.balance).replace(/[^\d.]/g, "")) : null;
        const reviewed =
          f.had_review_before === true || /^(y|yes|true)$/i.test(String(f.had_review_before || ""))
            ? true
            : f.had_review_before === false || /^(n|no|false)$/i.test(String(f.had_review_before || ""))
            ? false
            : null;
        toInsert.push({
          stage_id: newLeadStage.id,
          client_name: l.name || "Unknown",
          client_phone: l.phone || null,
          client_email: leadEmail,
          age: f.age ? String(f.age) : null,
          super_fund_name: f.super_fund_name || f.fund || null,
          super_balance: balanceNum,
          state: f.state || null,
          had_review_before: reviewed,
          value: balanceNum,
          source: "AI Caller",
          tags: ["AI Caller"],
          notes: null,
        });
        if (l.transcript_summary && cleanPhone) {
          summariesByPhone.set(cleanPhone, l.transcript_summary);
        }
        existingKeys.add(leadKey);
      }

      if (!toInsert.length) {
        toast({ title: "Nothing new to sync", description: "All qualified leads are already in the pipeline." });
        return;
      }

      // Append at the bottom of the New Lead stage so older leads stay at the top
      const { data: maxRow } = await supabase
        .from("pipeline_deals")
        .select("position")
        .eq("stage_id", newLeadStage.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      let nextPos = (maxRow?.position ?? -1) + 1;
      toInsert.forEach((d) => (d.position = nextPos++));
      const { data: inserted, error: insErr } = await supabase
        .from("pipeline_deals")
        .insert(toInsert)
        .select("id, client_phone");
      if (insErr) throw insErr;

      // Add transcript summaries as activity notes on each deal
      const noteRows = (inserted || [])
        .map((row: any) => {
          const cleanPhone = (row.client_phone || "").replace(/\s+/g, "");
          const summary = summariesByPhone.get(cleanPhone);
          return summary ? { deal_id: row.id, content: `Call summary: ${summary}` } : null;
        })
        .filter(Boolean);
      if (noteRows.length) {
        await supabase.from("pipeline_deal_notes").insert(noteRows as any);
      }

      toast({ title: `Synced ${toInsert.length} qualified lead${toInsert.length !== 1 ? "s" : ""}` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
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

  const filterTabs: { id: ViewFilter; label: string; count: number; icon: any; tone: string }[] = [
    { id: "active", label: "Active", count: activeCount, icon: Kanban, tone: "text-primary" },
    { id: "won", label: "Won", count: wonCount, icon: Trophy, tone: "text-emerald-600" },
    { id: "lost", label: "Lost", count: lostCount, icon: XCircle, tone: "text-destructive" },
    { id: "all", label: "All", count: deals.length, icon: Layers, tone: "text-muted-foreground" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border/50 bg-background/80 dark:bg-background/60 backdrop-blur-xl shrink-0">
        <div className="flex items-start sm:items-center justify-between gap-3 max-w-full">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-foreground tracking-tight flex items-center gap-2 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl gradient-accent flex items-center justify-center shadow-lg shadow-cyan/20 shrink-0">
                <Kanban className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
              </div>
              Pipeline
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {deals.length} deal{deals.length !== 1 ? "s" : ""} in pipeline
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search deals…"
                className="pl-9 w-56 h-9 bg-background/60"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncQualified}
              disabled={syncing}
              className="gap-1.5 h-9 px-2.5 sm:px-3"
              title="Import AI Caller leads with 80%+ qualification into New Lead"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync Qualified"}</span>
            </Button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                ${totalValue.toLocaleString()}
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setAddToStage(stages.find((s) => !isWonStage(s) && !isLostStage(s))?.id || stages[0]?.id || null)}
              className="h-9 gradient-accent text-white border-0 shadow-lg shadow-cyan/20 hover:shadow-cyan/30 gap-1.5 px-2.5 sm:px-3"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Deal</span>
            </Button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="relative mt-3 md:hidden">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals…"
            className="pl-9 h-9 bg-background/60"
          />
        </div>

        {/* Filter tabs */}
        <div className="mt-3 sm:mt-4 flex items-center gap-1 sm:gap-1.5 bg-muted/40 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
          {filterTabs.map((t) => {
            const Icon = t.icon;
            const isActive = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
                  isActive
                    ? "bg-card shadow-sm text-foreground"
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
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-4 md:p-6">
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
