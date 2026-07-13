// Strategy paper calculation helpers.
// Reuses the exact same engine as the Super Health Check report (`@/lib/calc`)
// but runs it independently for the "existing" and "comparison" scenarios so
// each side can have its own fund figures (not just existing + 2.5%).

import {
  buildSummary,
  inferRiskProfile,
  annualDesiredIncome,
  type ClientInputs,
  type IncomeFrequency,
  type RiskProfile,
} from "@/lib/calc";

export type InsuranceStructure = "Stepped" | "Level" | "No Insurance";
export type InsuranceType = "Indemnity" | "Agreed Value" | "No Income Protection";
export type WaitingPeriod = "30 days" | "60 days" | "90 days" | "No Income Protection";
export type BenefitPeriod = "2 years" | "5 years" | "To Age 65" | "No Income Protection";

export interface StrategyScenario {
  fundName: string;
  superBalance: number;
  modelLabel: string;                 // free text (e.g. "Balanced (Default)")
  riskProfile: RiskProfile;           // dropdown value
  numInvestmentOptions: number;
  adminFeePct: number;                // decimal 0.0067 = 0.67%
  adminFeeFlat: number;               // $ per year
  adviserFee: number;                 // $ per year (existing adviser fee)
  fiveYearReturn: number;             // decimal 0.0668
}

export interface StrategyInsurance {
  provider: string;
  lifeCover: number;
  tpdCover: number;
  ipMonthly: number;
  premiumAnnual: number;
  waitingPeriod: WaitingPeriod;
  benefitPeriod: BenefitPeriod;
  structure: InsuranceStructure;
  type: InsuranceType;
}

export interface StrategyFees {
  adviceFeeFlat: number;              // upfront advice/implementation $
  annualAdvicePct: number;            // decimal 0.0165 = 1.65%
  annualFeeCap: number;               // $ cap
}

export interface StrategyPaperData {
  clientName: string;
  clientDob: string;                  // yyyy-mm-dd
  retirementAge: number;
  annualIncome: number;
  personalContributionAmount: number;
  personalContributionFrequency: IncomeFrequency;
  desiredIncomeAmount: number;
  desiredIncomeFrequency: IncomeFrequency;
  goalBalance: number;
  existing: StrategyScenario;
  comparison: StrategyScenario;
  existingInsurance: StrategyInsurance;
  comparisonInsurance: StrategyInsurance;
  fees: StrategyFees;
  researchNotes: string;
  // AI-generated narrative fields (all optional; renderer falls back to
  // sensible boilerplate when empty). Populate them via the "AI Notes" button.
  aiObservation?: string;
  aiKeyInsight?: string;
  aiPatternExisting?: string;
  aiCompoundingRecommended?: string;
}

// Growth assets % per risk profile, used to feed the calc engine so the
// dip-year mechanics and profile lookups behave correctly.
export function growthAssetsForProfile(p: RiskProfile): number {
  switch (p) {
    case "High Growth": return 0.95;
    case "Growth": return 0.78;
    case "Balanced": return 0.60;
    case "Moderate": return 0.40;
    case "Conservative": return 0.20;
  }
}

// Firm's model portfolio defaults for the comparison ("dark blue") scenario.
export function firmModelDefaults(profile: RiskProfile): StrategyScenario {
  const returnByProfile: Record<RiskProfile, number> = {
    "High Growth": 0.1300,
    "Growth":      0.1143,
    "Balanced":    0.0900,
    "Moderate":    0.0700,
    "Conservative": 0.0500,
  };
  return {
    fundName: `${profile} Fund`,
    superBalance: 0,
    modelLabel: profile,
    riskProfile: profile,
    numInvestmentOptions: 6,
    adminFeePct: 0.0067,
    adminFeeFlat: 0,
    adviserFee: 0,
    fiveYearReturn: returnByProfile[profile],
  };
}

export function ageFromDob(dob: string): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(0, age);
}

// Convert a StrategyScenario into a ClientInputs object we can pass to the
// existing calc engine. We put the whole balance in the "primary" fund and
// leave the second-account slot empty. If a scenario doesn't have its own
// balance (e.g. the comparison side left blank), fall back to the existing
// balance so the comparison always projects from a meaningful starting point.
export function scenarioToClientInputs(
  d: StrategyPaperData,
  s: StrategyScenario,
): ClientInputs {
  const age = ageFromDob(d.clientDob);
  const balance = s.superBalance > 0 ? s.superBalance : d.existing.superBalance;
  return {
    clientName: d.clientName,
    age,
    retirementAge: d.retirementAge,
    goalBalance: d.goalBalance,
    desiredIncomeAmount: d.desiredIncomeAmount,
    desiredIncomeFrequency: d.desiredIncomeFrequency,
    annualIncome: d.annualIncome,

    fundName: s.fundName,
    superBalance: balance,
    modelLabel: s.modelLabel,
    growthAssetsPct: growthAssetsForProfile(s.riskProfile),
    adminFeeFlat: s.adminFeeFlat,
    adminFeePct: s.adminFeePct,
    grossReturn: s.fiveYearReturn,
    investmentRiskProfile: s.riskProfile,

    personalContributionAmount: d.personalContributionAmount,
    personalContributionFrequency: d.personalContributionFrequency,
    personalContributionType: "dollar",
  };
}

// Employer SG (12%) and after-tax net contribution (SG × 0.85).
export function employerSG(annualIncome: number) {
  return annualIncome * 0.12;
}
export function netEmployerContrib(annualIncome: number) {
  return annualIncome * 0.12 * 0.85;
}

export interface ScenarioResult {
  projectedBalance: number;
  yearsToRetirement: number;
  ageMoneyLasts: number;             // 0 or age <= 100
  moneyNeverRunsOut: boolean;
  totalIncome: number;
  annualWithdrawal: number;
  accumulationSeries: { age: number; balance: number }[];
  withdrawalSeries: { age: number; balance: number }[];
  netReturnPct: number;
  totalAdminPct: number;
  riskProfile: RiskProfile;
}

export function runScenario(
  d: StrategyPaperData,
  s: StrategyScenario,
): ScenarioResult {
  const ci = scenarioToClientInputs(d, s);
  const summary = buildSummary(ci);
  const acc = summary.accumulationSeries.map(r => ({ age: r.age, balance: r.existing }));
  const wd = summary.withdrawalExisting;

  // Money "never runs out" if the last withdrawal year is age 100 AND balance still positive.
  const last = wd[wd.length - 1];
  const moneyNeverRunsOut = !!(last && last.balance > 0 && last.age >= 99);

  return {
    projectedBalance: summary.projectedExisting,
    yearsToRetirement: summary.yearsRemaining,
    ageMoneyLasts: summary.ageMoneyLastsExisting,
    moneyNeverRunsOut,
    totalIncome: summary.totalIncomeExisting,
    annualWithdrawal: summary.annualWithdrawal,
    accumulationSeries: acc,
    withdrawalSeries: wd,
    netReturnPct: summary.existingNetReturn,
    totalAdminPct: summary.existingAdminPct,
    riskProfile: summary.riskProfile,
  };
}

// Annual advice fee (capped)
export function annualAdviceFee(balance: number, fees: StrategyFees): number {
  if (!fees.annualAdvicePct || !fees.annualFeeCap) return 0;
  return Math.min(balance * fees.annualAdvicePct, fees.annualFeeCap);
}

export const DEFAULT_STRATEGY: StrategyPaperData = {
  clientName: "",
  clientDob: "",
  retirementAge: 65,
  annualIncome: 0,
  personalContributionAmount: 0,
  personalContributionFrequency: "Annually",
  desiredIncomeAmount: 60000,
  desiredIncomeFrequency: "Annually",
  goalBalance: 0,
  existing: {
    fundName: "",
    superBalance: 0,
    modelLabel: "Balanced (Default)",
    riskProfile: "Balanced",
    numInvestmentOptions: 1,
    adminFeePct: 0.0025,
    adminFeeFlat: 78,
    adviserFee: 0,
    fiveYearReturn: 0.0668,
  },
  comparison: firmModelDefaults("Growth"),
  existingInsurance: {
    provider: "",
    lifeCover: 0,
    tpdCover: 0,
    ipMonthly: 0,
    premiumAnnual: 0,
    waitingPeriod: "60 days",
    benefitPeriod: "2 years",
    structure: "Stepped",
    type: "Indemnity",
  },
  comparisonInsurance: {
    provider: "",
    lifeCover: 0,
    tpdCover: 0,
    ipMonthly: 0,
    premiumAnnual: 0,
    waitingPeriod: "60 days",
    benefitPeriod: "2 years",
    structure: "Stepped",
    type: "Indemnity",
  },
  fees: {
    adviceFeeFlat: 3300,
    annualAdvicePct: 0.0165,
    annualFeeCap: 5000,
  },
  researchNotes: "",
};

export { inferRiskProfile, annualDesiredIncome };
