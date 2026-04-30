import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { ClientInputs } from "@/lib/calc";
import { DEFAULT_INPUTS } from "@/lib/xlsx-import";

const STORAGE_KEY = "advisor-link:client-inputs:v1";

interface Ctx {
  inputs: ClientInputs;
  setInputs: (v: ClientInputs) => void;
  reset: () => void;
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

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch { /* ignore */ }
  }, [inputs]);

  const setInputs = (v: ClientInputs) => setInputsState(v);
  const reset = () => {
    setInputsState(DEFAULT_INPUTS);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  return (
    <ClientInputsCtx.Provider value={{ inputs, setInputs, reset }}>
      {children}
    </ClientInputsCtx.Provider>
  );
}

export function useClientInputs() {
  const ctx = useContext(ClientInputsCtx);
  if (!ctx) throw new Error("useClientInputs must be used within ClientInputsProvider");
  return ctx;
}
