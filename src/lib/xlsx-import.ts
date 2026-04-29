// Read a Super Health Check XLSX and extract Client Data inputs
import * as XLSX from "xlsx";
import type { ClientInputs, IncomeFrequency } from "./calc";

const num = (v: unknown, fb = 0): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v.replace(/[$,%\s]/g, "")); return isNaN(n) ? fb : n; }
  return fb;
};
const str = (v: unknown, fb = ""): string => (v == null ? fb : String(v).trim());

export async function importFromFile(file: File): Promise<ClientInputs> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets["Client Data"] || wb.Sheets[wb.SheetNames[0]];
  const get = (addr: string) => sheet[addr]?.v;

  const freqRaw = str(get("N10"), "Annually");
  const freq: IncomeFrequency =
    freqRaw.toLowerCase().startsWith("week") ? "Weekly" :
    freqRaw.toLowerCase().startsWith("month") ? "Monthly" : "Annually";

  return {
    clientName: str(get("N4"), "New Client"),
    age: num(get("N5"), 50),
    annualIncome: num(get("N6"), 0),
    retirementAge: num(get("N8"), 67),
    goalBalance: num(get("N9"), 700000),
    desiredIncomeAmount: num(get("N11"), 1000),
    desiredIncomeFrequency: freq,
    fundName: str(get("J15"), "Industry Fund"),
    superBalance: num(get("J16"), 0),
    modelLabel: str(get("J17"), "Growth (Default)"),
    growthAssetsPct: num(get("J18"), 0.7),
    adminFeeFlat: num(get("K21"), 0),
    adminFeePct: num(get("O21"), 0),
    grossReturn: num(get("J25"), 0.066),
    investmentRiskProfile: str(get("J27"), ""),
    secondBalance: num(get("R16"), 0),
    secondGrowthPct: num(get("R18"), 0),
    secondAdminFlat: num(get("S21"), 0),
    secondAdminPct: num(get("W21"), 0),
    secondReturn: num(get("R25"), 0),
  };
}

export const DEFAULT_INPUTS: ClientInputs = {
  clientName: "Darren John Grainger",
  age: 59,
  annualIncome: 0,
  retirementAge: 67,
  goalBalance: 700000,
  desiredIncomeAmount: 1000,
  desiredIncomeFrequency: "Weekly",
  fundName: "REST",
  superBalance: 433000,
  modelLabel: "Growth (Default)",
  growthAssetsPct: 0.7,
  adminFeeFlat: 78,
  adminFeePct: 0.001,
  grossReturn: 0.066,
  investmentRiskProfile: "Growth",
};
