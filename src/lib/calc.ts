// Super Health Check calculation engine
// Ports the XLSX formulas exactly. All percentages are decimals (0.066 = 6.6%).

export type IncomeFrequency = "Weekly" | "Monthly" | "Annually";
export type RiskProfile = "High Growth" | "Growth" | "Balanced" | "Moderate" | "Conservative";

export interface FundEntry {
  fundName: string;
  modelLabel: string;
  superBalance: number;
  growthAssetsPct: number;
  grossReturn: number;
  adminFeeFlat: number;
  adminFeePct: number;
  investmentRiskProfile?: string;
}

export interface ClientInputs {
  // Personal
  clientName: string;
  clientEmail?: string;
  age: number;
  retirementAge: number; // N8
  goalBalance: number; // N9
  desiredIncomeAmount: number; // N11
  desiredIncomeFrequency: IncomeFrequency; // N10
  annualIncome: number; // N6 (salary)

  // Existing fund
  fundName: string; // J15
  superBalance: number; // J16
  modelLabel: string; // J17 e.g. "Growth (Default)"
  growthAssetsPct: number; // J18 (0.7 = 70%)
  adminFeeFlat: number; // K21
  adminFeePct: number; // O21
  grossReturn: number; // J25 (0.066)
  investmentRiskProfile?: string;

  // Optional second account (R columns) — keep zeroed if not used
  secondBalance?: number; // R16
  secondGrowthPct?: number; // R18
  secondAdminFlat?: number; // S21
  secondAdminPct?: number; // W21
  secondReturn?: number; // R25

  // Multiple funds support
  additionalFunds?: FundEntry[];
}

// Risk profile lookup (mirrors XLSX J27/J28 array formulas via growth-assets %)
export function inferRiskProfile(growthPct: number): RiskProfile {
  if (growthPct >= 0.85) return "High Growth";
  if (growthPct >= 0.70) return "Growth";
  if (growthPct >= 0.50) return "Balanced";
  if (growthPct >= 0.30) return "Moderate";
  return "Conservative";
}

// Comparison return by profile (mirrors N32)
export function comparisonReturnFor(profile: RiskProfile): number {
  switch (profile) {
    case "High Growth": return 0.15;
    case "Growth": return 0.13;
    case "Balanced": return 0.10;
    case "Moderate": return 0.07;
    case "Conservative": return 0.05;
  }
}

// Comparison admin pct tiered on balance (V33)
export function comparisonAdminPct(balance: number): number {
  if (balance <= 250_000) return 0.0035;
  if (balance <= 500_000) return 0.0016;
  return 0.0012;
}

// Comparison admin flat (P33) is fixed at 240
export const COMPARISON_ADMIN_FLAT = 240;
// Comparison advice fee (N37): MIN(balance * 4.4%, 6500)
export function comparisonAdviceFee(balance: number): number {
  return Math.min(balance * 0.044, 6500);
}
// Comparison annual fee (N36): MIN(balance * 1.76%, 5000)
export const COMPARISON_ANNUAL_PCT = 0.0176;
export const COMPARISON_ANNUAL_CAP = 5000;
export function comparisonAnnualFee(balance: number): number {
  return Math.min(balance * COMPARISON_ANNUAL_PCT, COMPARISON_ANNUAL_CAP);
}
export function comparisonAnnualFeePct(balance: number): number {
  return comparisonAnnualFee(balance) / balance;
}

// Excel FV(rate, 1, -pmt, -pv) for a single period with payment at end:
// FV = pv*(1+rate) + pmt
// (Excel sign convention: negative pmt and negative pv → positive FV)
export function fv1(rate: number, pmt: number, pv: number): number {
  return pv * (1 + rate) + pmt;
}

// Net super contributions: (annualIncome * 12%) * 0.85  (N7)
export function netSuperContrib(annualIncome: number): number {
  return annualIncome * 0.12 * 0.85;
}

// Annual desired income from N11/N10 → annual figure (N12 simplified)
export function annualDesiredIncome(amount: number, freq: IncomeFrequency): number {
  if (freq === "Weekly") return amount * 52;
  if (freq === "Monthly") return amount * 12;
  return amount;
}

// Gather all funds into an array for unified calculations
export function getAllFunds(i: ClientInputs): FundEntry[] {
  const primary: FundEntry = {
    fundName: i.fundName,
    modelLabel: i.modelLabel,
    superBalance: i.superBalance,
    growthAssetsPct: i.growthAssetsPct,
    grossReturn: i.grossReturn,
    adminFeeFlat: i.adminFeeFlat,
    adminFeePct: i.adminFeePct,
    investmentRiskProfile: i.investmentRiskProfile,
  };
  const funds = [primary];
  if (i.additionalFunds) {
    funds.push(...i.additionalFunds.filter(f => f.superBalance > 0));
  }
  return funds;
}

// Total balance across all funds
export function totalBalance(i: ClientInputs): number {
  return getAllFunds(i).reduce((sum, f) => sum + f.superBalance, 0) + (i.secondBalance ?? 0);
}

// Weighted average growth assets % across all funds
export function weightedGrowthPct(i: ClientInputs): number {
  const funds = getAllFunds(i);
  const total = funds.reduce((s, f) => s + f.superBalance, 0) + (i.secondBalance ?? 0);
  if (total === 0) return 0;
  let weighted = funds.reduce((s, f) => s + f.superBalance * f.growthAssetsPct, 0);
  weighted += (i.secondBalance ?? 0) * (i.secondGrowthPct ?? 0);
  return weighted / total;
}

// Existing scenario: weighted gross return (J26) and weighted admin fee % (J24)
export function existingReturnPct(i: ClientInputs): number {
  const funds = getAllFunds(i);
  const total = funds.reduce((s, f) => s + f.superBalance, 0) + (i.secondBalance ?? 0);
  if (total === 0) return 0;
  let weighted = funds.reduce((s, f) => s + f.superBalance * f.grossReturn, 0);
  weighted += (i.secondBalance ?? 0) * (i.secondReturn ?? 0);
  return weighted / total;
}
export function existingAdminPct(i: ClientInputs): number {
  const funds = getAllFunds(i);
  const total = funds.reduce((s, f) => s + f.superBalance, 0) + (i.secondBalance ?? 0);
  if (total === 0) return 0;
  let weighted = funds.reduce((s, f) => {
    const pct = f.superBalance > 0 ? f.adminFeeFlat / f.superBalance + f.adminFeePct : 0;
    return s + f.superBalance * pct;
  }, 0);
  const b = i.secondBalance ?? 0;
  if (b > 0) weighted += b * ((i.secondAdminFlat ?? 0) / b + (i.secondAdminPct ?? 0));
  return weighted / total;
}

// Year cycle for ×0.9 / ×0.95 dips: every 7 years from year index 1.
// XLSX uses ×0.9 in accumulation at relative years 8, 15, 22, 29, 36 (i.e. rows 66, 73, 80, 87, 94)
// Starting age row B59 = currentAge, dip occurs every 7th row offset.
function isAccumulationDipRow(rowOffsetFromStart: number): boolean {
  // matches rows 66,73,80,87,94 with start 59 → offsets 7,14,21,28,35
  return rowOffsetFromStart > 0 && rowOffsetFromStart % 7 === 0;
}
function isWithdrawalDipRow(rowOffsetFromStart: number): boolean {
  // rows 111,118,125,132,139,146,153,160,167,174,181 with start 104 → offsets 7,14,21...
  return rowOffsetFromStart > 0 && rowOffsetFromStart % 7 === 0;
}

export interface YearRow { age: number; existing: number; comparison: number; }

// Accumulation projection — current age → retirement age (B59..B98 logic)
export function projectAccumulation(i: ClientInputs): YearRow[] {
  const startAge = Math.min(i.age, 67);
  const targetAge = i.retirementAge;
  const contrib = netSuperContrib(i.annualIncome);

  const exReturn = existingReturnPct(i);
  const exAdmin = existingAdminPct(i);
  const exRate = exReturn - 0.025 - exAdmin;

  const wGrowth = weightedGrowthPct(i);
  const profile = inferRiskProfile(wGrowth);
  const total = totalBalance(i);
  const cmpReturn = comparisonReturnFor(profile);
  const cmpAdminPct = total > 0 ? COMPARISON_ADMIN_FLAT / total + comparisonAdminPct(total) : 0;
  const cmpAnnualPct = total > 0 ? comparisonAnnualFeePct(total) : 0;
  const cmpRate = cmpReturn - 0.025 - cmpAdminPct - cmpAnnualPct;

  // P59 = total balance - N37 (advice fee deducted upfront)
  const startEx = total;
  const startCmp = startEx - comparisonAdviceFee(total);

  const rows: YearRow[] = [{ age: startAge, existing: startEx, comparison: startCmp }];
  let age = startAge;
  let ex = startEx, cmp = startCmp;
  let offset = 0;
  while (age < targetAge) {
    age += 1;
    offset += 1;
    ex = fv1(exRate, contrib, ex);
    cmp = fv1(cmpRate, contrib, cmp);
    if (isAccumulationDipRow(offset)) { ex *= 0.9; cmp *= 0.9; }
    rows.push({ age, existing: ex, comparison: cmp });
  }
  return rows;
}

// Final balance at retirement
export function balancesAtRetirement(i: ClientInputs): { existing: number; comparison: number } {
  const rows = projectAccumulation(i);
  const last = rows[rows.length - 1];
  return { existing: last.existing, comparison: last.comparison };
}

// Withdrawal phase — starts at retirement, runs until balance ≤ 0 (or age 100)
export function projectWithdrawal(i: ClientInputs): { existing: YearRow[]; comparison: YearRow[] } {
  const start = balancesAtRetirement(i);
  const annualWithdraw = annualDesiredIncome(i.desiredIncomeAmount, i.desiredIncomeFrequency);

  const exAdmin = existingAdminPct(i);
  const profile = inferRiskProfile(i.growthAssetsPct);
  const cmpReturn = comparisonReturnFor(profile);
  const cmpAdminPct = COMPARISON_ADMIN_FLAT / i.superBalance + comparisonAdminPct(i.superBalance);

  // Existing growth in withdrawal: J25*0.5 - J22 (defensive mix, half return, full fees)
  const exFactor = (1 + i.grossReturn * 0.5 - exAdmin);
  const cmpFactor = (1 + cmpReturn * 0.5 - cmpAdminPct);

  const buildSeries = (startBal: number, factor: number): YearRow[] => {
    const out: YearRow[] = [];
    let age = i.retirementAge;
    let bal = startBal;
    out.push({ age, existing: bal, comparison: 0 });
    let offset = 0;
    while (bal > 0 && age < 100) {
      age += 1;
      offset += 1;
      bal = (bal - annualWithdraw) * (1 - 0.025) * factor;
      if (isWithdrawalDipRow(offset)) bal *= 0.95;
      if (bal < 0) bal = 0;
      out.push({ age, existing: bal, comparison: 0 });
      if (bal === 0) break;
    }
    return out;
  };

  const existing = buildSeries(start.existing, exFactor).map(r => ({ age: r.age, existing: r.existing, comparison: 0 }));
  const cmp = buildSeries(start.comparison, cmpFactor).map(r => ({ age: r.age, existing: 0, comparison: r.existing }));
  return { existing, comparison: cmp };
}

export function ageMoneyLasts(series: { age: number; balance: number }[]): number {
  // last age where balance > 0
  for (let k = series.length - 1; k >= 0; k--) if (series[k].balance > 0) return series[k].age;
  return series[0]?.age ?? 0;
}

export interface ReportSummary {
  inputs: ClientInputs;
  startingBalance: number;
  retirementAge: number;
  yearsRemaining: number;
  goalBalance: number;
  goalProgressPct: number; // existing-projected / goal
  projectedExisting: number;
  projectedComparison: number;
  potentialUplift: number;
  annualWithdrawal: number;
  totalIncomeExisting: number;
  totalIncomeComparison: number;
  ageMoneyLastsExisting: number;
  ageMoneyLastsComparison: number;
  yearsIncomeExisting: number;
  yearsIncomeComparison: number;
  riskProfile: RiskProfile;
  existingNetReturn: number;
  existingAdminPct: number;
  comparisonReturn: number;
  comparisonAdminPct: number;
  accumulationSeries: YearRow[];
  withdrawalExisting: { age: number; balance: number }[];
  withdrawalComparison: { age: number; balance: number }[];
}

export function buildSummary(i: ClientInputs): ReportSummary {
  const acc = projectAccumulation(i);
  const last = acc[acc.length - 1];
  const wd = projectWithdrawal(i);
  const wdEx = wd.existing.map(r => ({ age: r.age, balance: r.existing }));
  const wdCmp = wd.comparison.map(r => ({ age: r.age, balance: r.comparison }));
  const ageEx = ageMoneyLasts(wdEx);
  const ageCmp = ageMoneyLasts(wdCmp);
  const annual = annualDesiredIncome(i.desiredIncomeAmount, i.desiredIncomeFrequency);
  const yrsEx = Math.max(0, ageEx - i.retirementAge);
  const yrsCmp = Math.max(0, ageCmp - i.retirementAge);
  const profile = inferRiskProfile(i.growthAssetsPct);
  const exAdmin = existingAdminPct(i);
  const exReturn = existingReturnPct(i);
  const cmpReturn = comparisonReturnFor(profile);
  const cmpAdmin = COMPARISON_ADMIN_FLAT / i.superBalance + comparisonAdminPct(i.superBalance);

  return {
    inputs: i,
    startingBalance: i.superBalance + (i.secondBalance ?? 0),
    retirementAge: i.retirementAge,
    yearsRemaining: Math.max(0, i.retirementAge - i.age),
    goalBalance: i.goalBalance,
    goalProgressPct: i.goalBalance > 0 ? Math.min(1, last.existing / i.goalBalance) : 0,
    projectedExisting: last.existing,
    projectedComparison: last.comparison,
    potentialUplift: last.comparison - last.existing,
    annualWithdrawal: annual,
    totalIncomeExisting: annual * yrsEx,
    totalIncomeComparison: annual * yrsCmp,
    ageMoneyLastsExisting: ageEx,
    ageMoneyLastsComparison: ageCmp,
    yearsIncomeExisting: yrsEx,
    yearsIncomeComparison: yrsCmp,
    riskProfile: profile,
    existingNetReturn: exReturn,
    existingAdminPct: exAdmin,
    comparisonReturn: cmpReturn,
    comparisonAdminPct: cmpAdmin,
    accumulationSeries: acc,
    withdrawalExisting: wdEx,
    withdrawalComparison: wdCmp,
  };
}

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(Math.round(n || 0));
export const fmtMoneyShort = (n: number) => fmtMoney(n);
export const fmtPct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
