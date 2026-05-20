import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { ClientInputs } from "@/lib/calc";
import { DEFAULT_INPUTS } from "@/lib/xlsx-import";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STORAGE_KEY = "advisor-link:client-inputs:v1";
const LOOKUP_KEY = "advisor-link:lookup-state:v1";
const EDITING_KEY = "advisor-link:editing-report-id:v1";

export interface LookupState {
  text: string;
  result: Record<string, unknown> | null;
}

const DEFAULT_LOOKUP: LookupState = { text: "", result: null };

interface Ctx {
  inputs: ClientInputs;
  setInputs: (v: ClientInputs) => void;
  reset: () => void;
  lookup: LookupState;
  setLookup: (v: LookupState | ((prev: LookupState) => LookupState)) => void;
  lookupLoading: boolean;
  runLookup: (
    text: string,
    onApply: (r: Record<string, unknown>) => void,
  ) => Promise<void>;
  editingReportId: string | null;
  setEditingReportId: (id: string | null) => void;
}

const ClientInputsCtx = createContext<Ctx | null>(null);

export function ClientInputsProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputsState] = useState<ClientInputs>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_INPUTS, ...JSON.parse(raw) } as ClientInputs;
    } catch { /* ignore */ }
    return DEFAULT_INPUTS;
  });

  const [lookup, setLookupState] = useState<LookupState>(() => {
    try {
      const raw = localStorage.getItem(LOOKUP_KEY);
      if (raw) return { ...DEFAULT_LOOKUP, ...JSON.parse(raw) } as LookupState;
    } catch { /* ignore */ }
    return DEFAULT_LOOKUP;
  });

  const [lookupLoading, setLookupLoading] = useState(false);
  // Cache last successful result keyed by query so re-running with the same
  // text is instant.
  const cacheRef = useRef<{ key: string; result: Record<string, unknown> } | null>(null);
  // Track in-flight request so navigation doesn't cancel it.
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch { /* ignore */ }
  }, [inputs]);

  useEffect(() => {
    try { localStorage.setItem(LOOKUP_KEY, JSON.stringify(lookup)); } catch { /* ignore */ }
  }, [lookup]);

  const setInputs = (v: ClientInputs) => setInputsState(v);
  const setLookup: Ctx["setLookup"] = (v) =>
    setLookupState((prev) => (typeof v === "function" ? (v as (p: LookupState) => LookupState)(prev) : v));

  const runLookup: Ctx["runLookup"] = async (text, onApply) => {
    if (text.trim().length < 3) {
      toast.error("Enter at least the fund name and investment option.");
      return;
    }
    if (inFlightRef.current) {
      toast.info("A search is already running — it will keep going in the background.");
      return inFlightRef.current;
    }

    const cacheKey = text.trim().toLowerCase().replace(/\s+/g, " ");
    if (cacheRef.current && cacheRef.current.key === cacheKey) {
      const r = cacheRef.current.result;
      onApply(r);
      setLookupState((prev) => ({ ...prev, result: r }));
      toast.success("Fund details applied", { description: "Used the same verified result as the previous fill." });
      return;
    }

    setLookupLoading(true);
    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("lookup-fund", {
          body: { query: text.trim() },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const r = (data?.data ?? {}) as Record<string, unknown>;
        cacheRef.current = { key: cacheKey, result: r };
        onApply(r);
        setLookupState((prev) => ({ ...prev, result: r }));
        toast.success("Fund details applied", {
          description: "Review the figures and source links below.",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Lookup failed";
        toast.error(msg);
      } finally {
        setLookupLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  };

  const [editingReportId, setEditingReportIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(EDITING_KEY); } catch { return null; }
  });
  const setEditingReportId = (id: string | null) => {
    setEditingReportIdState(id);
    try {
      if (id) localStorage.setItem(EDITING_KEY, id);
      else localStorage.removeItem(EDITING_KEY);
    } catch { /* ignore */ }
  };

  const reset = () => {
    setInputsState(DEFAULT_INPUTS);
    setLookupState(DEFAULT_LOOKUP);
    setEditingReportId(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LOOKUP_KEY);
    } catch { /* ignore */ }
  };

  return (
    <ClientInputsCtx.Provider value={{ inputs, setInputs, reset, lookup, setLookup, lookupLoading, runLookup, editingReportId, setEditingReportId }}>
      {children}
    </ClientInputsCtx.Provider>
  );
}

export function useClientInputs() {
  const ctx = useContext(ClientInputsCtx);
  if (!ctx) throw new Error("useClientInputs must be used within ClientInputsProvider");
  return ctx;
}
