import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { ClientInputs } from "@/lib/calc";
import { DEFAULT_INPUTS } from "@/lib/xlsx-import";

const STORAGE_KEY = "advisor-link:client-inputs:v1";
const LOOKUP_KEY = "advisor-link:lookup-state:v1";

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

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch { /* ignore */ }
  }, [inputs]);

  useEffect(() => {
    try { localStorage.setItem(LOOKUP_KEY, JSON.stringify(lookup)); } catch { /* ignore */ }
  }, [lookup]);

  const setInputs = (v: ClientInputs) => setInputsState(v);
  const setLookup: Ctx["setLookup"] = (v) =>
    setLookupState((prev) => (typeof v === "function" ? (v as (p: LookupState) => LookupState)(prev) : v));

  const reset = () => {
    setInputsState(DEFAULT_INPUTS);
    setLookupState(DEFAULT_LOOKUP);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LOOKUP_KEY);
    } catch { /* ignore */ }
  };

  return (
    <ClientInputsCtx.Provider value={{ inputs, setInputs, reset, lookup, setLookup }}>
      {children}
    </ClientInputsCtx.Provider>
  );
}

export function useClientInputs() {
  const ctx = useContext(ClientInputsCtx);
  if (!ctx) throw new Error("useClientInputs must be used within ClientInputsProvider");
  return ctx;
}
