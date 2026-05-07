import { useState, useEffect, useRef } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, FileText, ArrowLeft, Download, User } from "lucide-react";
import jsPDF from "jspdf";
import logoSvg from "@/assets/logo.svg";

/* ─── types ─── */
interface ReportRow {
  id: string;
  client_name: string;
  inputs: Record<string, unknown> | null;
  created_at: string;
}

interface Dependent {
  name: string;
  gender: string;
  dob: string;
  age: string;
  annualSchoolFees: string;
}

interface EmploymentBlock {
  employmentStatus: string;
  hoursPerWeek: string;
  occupationTitle: string;
  industry: string;
  timeInOccupationYears: string;
  timeInOccupationMonths: string;
  timeWithEmployerYears: string;
  timeWithEmployerMonths: string;
  qualifications: string;
  ebaInPlace: string;
  dutiesPerformed: string;
  workAbove10m: string;
  workAbove10mDetails: string;
  officeAdminPct: string;
  manualFieldPct: string;
  travelPct: string;
  supervisionPct: string;
  annualLeaveDays: string;
  sickLeaveDays: string;
  longServiceDays: string;
  personalSuperContributions: string;
  annualIncome: string;
  annualBonus: string;
  annualCommissions: string;
  annualOvertime: string;
  additionalNotes: string;
}

interface SelfEmploymentBlock {
  occupationTitle: string;
  industry: string;
  qualifications: string;
  ebaInPlace: string;
  businessStructure: string;
  timeSelfEmployedYears: string;
  timeSelfEmployedMonths: string;
  businessOwnedPct: string;
  employeeCount: string;
  dutiesPerformed: string;
  workAbove10m: string;
  workAbove10mDetails: string;
  officeAdminPct: string;
  manualFieldPct: string;
  travelPct: string;
  supervisionPct: string;
  personalSuperContributions: string;
  annualIncome: string;
  annualDividends: string;
  additionalNotes: string;
}

interface AssetRow {
  asset: string;
  value: string;
  debt: string;
  owner: string;
  monthlyRepayments: string;
}

interface ExpenseRow {
  expense: string;
  weekly: string;
  monthly: string;
  quarterly: string;
  annually: string;
}

interface SuperFundRow {
  fund: string;
  accountNumber: string;
  balance: string;
}

interface InsuranceRow {
  insurer: string;
  policyNumber: string;
  coverType: string;
  sumInsured: string;
  premiumPA: string;
}

interface BeneficiaryRow {
  fullName: string;
  gender: string;
  relationship: string;
  dob: string;
  benefitPct: string;
}

interface FactFindData {
  dateCompleted: string;
  client1Name: string;
  client2Name: string;
  representativeName: string;
  // Personal details
  client1Title: string;
  client2Title: string;
  client1MiddleName: string;
  client2MiddleName: string;
  client1PreferredName: string;
  client2PreferredName: string;
  client1MaidenName: string;
  client2MaidenName: string;
  client1DOB: string;
  client2DOB: string;
  client1Gender: string;
  client2Gender: string;
  client1MaritalStatus: string;
  client2MaritalStatus: string;
  client1AustralianCitizen: string;
  client2AustralianCitizen: string;
  client1VisaDetails: string;
  client2VisaDetails: string;
  client1BankruptcyStatus: string;
  client2BankruptcyStatus: string;
  client1TFN: string;
  client2TFN: string;
  // Contact
  client1Mobile: string;
  client2Mobile: string;
  client1Home: string;
  client2Home: string;
  client1Email: string;
  client2Email: string;
  streetAddress: string;
  suburb: string;
  state: string;
  postcode: string;
  // Dependents
  noDependents: boolean;
  dependents: Dependent[];
  dependentsNotes: string;
  // Employment
  primaryEmployment1: EmploymentBlock;
  primaryEmployment2: EmploymentBlock;
  secondaryEmployment1: EmploymentBlock;
  secondaryEmployment2: EmploymentBlock;
  selfEmployment1: SelfEmploymentBlock;
  selfEmployment2: SelfEmploymentBlock;
  // Assets
  assets: AssetRow[];
  // Expenses
  expenses: ExpenseRow[];
  // Savings capacity
  client1ExpenseSplitPct: string;
  client2ExpenseSplitPct: string;
  totalAnnualCoreExpenses: string;
  dependentEducationalExpenses: string[];
  // Super funds
  client1SuperFunds: SuperFundRow[];
  client2SuperFunds: SuperFundRow[];
  // Insurance
  client1Insurance: InsuranceRow[];
  client2Insurance: InsuranceRow[];
  hospitalCover: boolean;
  extrasCover: boolean;
  noneCover: boolean;
  // Estate planning
  client1HasWill: string;
  client2HasWill: string;
  client1WillLastReviewed: string;
  client2WillLastReviewed: string;
  client1POA: string;
  client2POA: string;
  estatePlanningNotes: string;
  // Health
  client1Height: string;
  client2Height: string;
  client1Weight: string;
  client2Weight: string;
  client1BMI: string;
  client2BMI: string;
  client1SmokeVape: string;
  client2SmokeVape: string;
  client1DrinksPerWeek: string;
  client2DrinksPerWeek: string;
  client1RecreationalDrugs: string;
  client2RecreationalDrugs: string;
  client1GeneralHealth: string;
  client2GeneralHealth: string;
  healthConditionsNoneApply: boolean;
  healthConditions: Record<string, boolean>;
  healthScenariosNoneApply: boolean;
  healthScenarios: Record<string, boolean>;
  // Health detail sections (free-text for each condition)
  healthDetails: Record<string, string>;
  // Part B
  partBDateCompleted: string;
  partBAdviserName: string;
  initialReasonsForAdvice: string;
  // Objectives
  objectives: { objective: string; term: string; priority: string; amountRequired: string }[];
  // Advice goals
  adviceGoalsSuper: Record<string, boolean>;
  adviceGoalsOutside: Record<string, boolean>;
  client1RetirementAge: string;
  client2RetirementAge: string;
  client1RetirementIncome: string;
  client2RetirementIncome: string;
  emergencyFundsNow: string;
  emergencyFundsRetirement: string;
  scopeOfAdvice: string;
  scopeLimitedAreas: Record<string, boolean>;
  scopeOther: string;
  scopeLimitingExplanation: string;
  // Investment goals
  investmentGoals: Record<string, string>;
  investmentKnowledge: Record<string, string>;
  investmentExperience: Record<string, boolean>;
  investmentNotes: string;
  // Risk profile
  riskAnswers: Record<string, string>;
  client1TotalPoints: string;
  client2TotalPoints: string;
  client1RiskProfile: string;
  client2RiskProfile: string;
  riskAgree: string;
  alteredRiskProfile: string;
  alteredRiskReason: string;
  // Insurer info
  insurerEmployment: Record<string, string>;
  primaryPhysician: Record<string, string>;
  insurerContact: Record<string, string>;
  insurerNotes: string;
  // Beneficiaries
  client1NominationType: string;
  client2NominationType: string;
  client1Beneficiaries: BeneficiaryRow[];
  client2Beneficiaries: BeneficiaryRow[];
  beneficiaryNotes: string;
  // Acknowledgements
  client1FSGDate: string;
  client2FSGDate: string;
  fsgDocumentDate: string;
  soaFee: string;
  client1NoContact: boolean;
  client2NoContact: boolean;
}

const emptyEmployment = (): EmploymentBlock => ({
  employmentStatus: "", hoursPerWeek: "", occupationTitle: "", industry: "",
  timeInOccupationYears: "", timeInOccupationMonths: "", timeWithEmployerYears: "",
  timeWithEmployerMonths: "", qualifications: "", ebaInPlace: "", dutiesPerformed: "",
  workAbove10m: "", workAbove10mDetails: "", officeAdminPct: "", manualFieldPct: "",
  travelPct: "", supervisionPct: "", annualLeaveDays: "", sickLeaveDays: "",
  longServiceDays: "", personalSuperContributions: "", annualIncome: "",
  annualBonus: "", annualCommissions: "", annualOvertime: "", additionalNotes: "",
});

const emptySelfEmployment = (): SelfEmploymentBlock => ({
  occupationTitle: "", industry: "", qualifications: "", ebaInPlace: "",
  businessStructure: "", timeSelfEmployedYears: "", timeSelfEmployedMonths: "",
  businessOwnedPct: "", employeeCount: "", dutiesPerformed: "", workAbove10m: "",
  workAbove10mDetails: "", officeAdminPct: "", manualFieldPct: "", travelPct: "",
  supervisionPct: "", personalSuperContributions: "", annualIncome: "",
  annualDividends: "", additionalNotes: "",
});

const defaultAssets: AssetRow[] = [
  { asset: "Residential property", value: "", debt: "", owner: "", monthlyRepayments: "" },
  { asset: "Investment property/s", value: "", debt: "", owner: "", monthlyRepayments: "" },
  { asset: "Vehicle/s", value: "", debt: "", owner: "", monthlyRepayments: "" },
  { asset: "Personal loans", value: "", debt: "", owner: "", monthlyRepayments: "" },
  { asset: "Credit cards", value: "", debt: "", owner: "", monthlyRepayments: "" },
  { asset: "Household contents", value: "", debt: "", owner: "", monthlyRepayments: "" },
  { asset: "Savings", value: "", debt: "", owner: "", monthlyRepayments: "" },
  { asset: "Investment shares", value: "", debt: "", owner: "", monthlyRepayments: "" },
  { asset: "Superannuation- Client 1", value: "", debt: "", owner: "", monthlyRepayments: "" },
  { asset: "Superannuation- Client 2", value: "", debt: "", owner: "", monthlyRepayments: "" },
];

const defaultExpenses: ExpenseRow[] = [
  { expense: "Rent (if applicable)", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Groceries / Alcohol / Cigarettes", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Gas, electricity, water", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Rates / Body corporate", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Phone & Internet", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Petrol / Running costs", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Medical", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Personal / Health insurance", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Clothing", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Entertainment", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Subscriptions (TV, Gym, Sports)", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Holidays", weekly: "", monthly: "", quarterly: "", annually: "" },
  { expense: "Other", weekly: "", monthly: "", quarterly: "", annually: "" },
];

const HEALTH_CONDITIONS = [
  "Asthma/Respiratory", "Back / Neck / Spine", "Cancers- Internal",
  "Cancer/s- External", "Diabetes", "Epilepsy",
  "Eyesight / Hearing / Speech conditions", "Gastric Sleeve / Weight Loss",
  "Gout / IBS / Crohn's Disease / Diverticulitis / Colitis",
  "High Blood Pressure / High Cholesterol", "Mental Health",
  "Muscle / Joint / Bone Injuries", "Sleep Apnea", "Thyroid Disorder",
];

const HEALTH_SCENARIOS = [
  "Family history - Immediate family only",
  "Dangerous hobbies or sports",
];

const emptyFactFind = (): FactFindData => ({
  dateCompleted: new Date().toISOString().slice(0, 10),
  client1Name: "", client2Name: "", representativeName: "",
  client1Title: "", client2Title: "",
  client1MiddleName: "", client2MiddleName: "",
  client1PreferredName: "", client2PreferredName: "",
  client1MaidenName: "", client2MaidenName: "",
  client1DOB: "", client2DOB: "",
  client1Gender: "", client2Gender: "",
  client1MaritalStatus: "", client2MaritalStatus: "",
  client1AustralianCitizen: "", client2AustralianCitizen: "",
  client1VisaDetails: "", client2VisaDetails: "",
  client1BankruptcyStatus: "", client2BankruptcyStatus: "",
  client1TFN: "", client2TFN: "",
  client1Mobile: "", client2Mobile: "",
  client1Home: "", client2Home: "",
  client1Email: "", client2Email: "",
  streetAddress: "", suburb: "", state: "", postcode: "",
  noDependents: false,
  dependents: [{ name: "", gender: "", dob: "", age: "", annualSchoolFees: "" }],
  dependentsNotes: "",
  primaryEmployment1: emptyEmployment(),
  primaryEmployment2: emptyEmployment(),
  secondaryEmployment1: emptyEmployment(),
  secondaryEmployment2: emptyEmployment(),
  selfEmployment1: emptySelfEmployment(),
  selfEmployment2: emptySelfEmployment(),
  assets: [...defaultAssets],
  expenses: [...defaultExpenses],
  client1ExpenseSplitPct: "", client2ExpenseSplitPct: "",
  totalAnnualCoreExpenses: "",
  dependentEducationalExpenses: ["", "", "", "", "", ""],
  client1SuperFunds: [{ fund: "", accountNumber: "", balance: "" }],
  client2SuperFunds: [{ fund: "", accountNumber: "", balance: "" }],
  client1Insurance: [{ insurer: "", policyNumber: "", coverType: "", sumInsured: "", premiumPA: "" }],
  client2Insurance: [{ insurer: "", policyNumber: "", coverType: "", sumInsured: "", premiumPA: "" }],
  hospitalCover: false, extrasCover: false, noneCover: false,
  client1HasWill: "", client2HasWill: "",
  client1WillLastReviewed: "", client2WillLastReviewed: "",
  client1POA: "", client2POA: "",
  estatePlanningNotes: "",
  client1Height: "", client2Height: "",
  client1Weight: "", client2Weight: "",
  client1BMI: "", client2BMI: "",
  client1SmokeVape: "", client2SmokeVape: "",
  client1DrinksPerWeek: "", client2DrinksPerWeek: "",
  client1RecreationalDrugs: "", client2RecreationalDrugs: "",
  client1GeneralHealth: "", client2GeneralHealth: "",
  healthConditionsNoneApply: false,
  healthConditions: Object.fromEntries(HEALTH_CONDITIONS.map(c => [c, false])),
  healthScenariosNoneApply: false,
  healthScenarios: Object.fromEntries(HEALTH_SCENARIOS.map(s => [s, false])),
  healthDetails: {},
  partBDateCompleted: "", partBAdviserName: "", initialReasonsForAdvice: "",
  objectives: [
    { objective: "", term: "", priority: "", amountRequired: "" },
    { objective: "", term: "", priority: "", amountRequired: "" },
    { objective: "", term: "", priority: "", amountRequired: "" },
    { objective: "", term: "", priority: "", amountRequired: "" },
  ],
  adviceGoalsSuper: {
    "Insurance Inside Super": false,
    "Retirement Planning": false,
    "Super Optimisation": false,
  },
  adviceGoalsOutside: {
    "Grow Wealth": false,
    "Manage Cash Flow and Debt": false,
    "Plan for Major Life Events": false,
    "Plan for Retirement and Aged Care": false,
    "Other": false,
  },
  client1RetirementAge: "", client2RetirementAge: "",
  client1RetirementIncome: "", client2RetirementIncome: "",
  emergencyFundsNow: "", emergencyFundsRetirement: "",
  scopeOfAdvice: "",
  scopeLimitedAreas: {
    "Aged Care Planning": false, "Budgeting and Cash Flow": false,
    "Debt Management": false, "Estate Planning": false,
    "Investment Advice": false, "Personal Insurance": false,
    "Retirement Planning": false, "Superannuation": false,
  },
  scopeOther: "", scopeLimitingExplanation: "",
  investmentGoals: {},
  investmentKnowledge: {},
  investmentExperience: {
    "Derivatives": false, "Exchange-Traded Funds (ETFs)": false,
    "Managed Funds": false, "Property": false,
    "Shares": false, "Term Deposits": false,
  },
  investmentNotes: "",
  riskAnswers: {},
  client1TotalPoints: "", client2TotalPoints: "",
  client1RiskProfile: "", client2RiskProfile: "",
  riskAgree: "", alteredRiskProfile: "", alteredRiskReason: "",
  insurerEmployment: {}, primaryPhysician: {}, insurerContact: {},
  insurerNotes: "",
  client1NominationType: "", client2NominationType: "",
  client1Beneficiaries: [{ fullName: "", gender: "", relationship: "", dob: "", benefitPct: "" }],
  client2Beneficiaries: [{ fullName: "", gender: "", relationship: "", dob: "", benefitPct: "" }],
  beneficiaryNotes: "",
  client1FSGDate: "", client2FSGDate: "", fsgDocumentDate: "", soaFee: "",
  client1NoContact: false, client2NoContact: false,
});

/* ─── Section tabs ─── */
const SECTIONS = [
  "Cover Page",
  "Personal Details",
  "Dependents",
  "Primary Employment",
  "Secondary Employment",
  "Self-Employment",
  "Assets & Liabilities",
  "Living Expenses",
  "Super Funds & Insurance",
  "Estate Planning",
  "Health Details",
  "Health Conditions Detail",
  "Part B - Adviser Section",
  "Objectives",
  "Advice Goals & Scope",
  "Investment Goals",
  "Risk Profile",
  "Insurer Information",
  "Beneficiaries",
  "Acknowledgements",
] as const;

/* ─── Component ─── */
export default function FactFind() {
  const { profile, loading } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ReportRow | null>(null);
  const [data, setData] = useState<FactFindData>(emptyFactFind());
  const [activeSection, setActiveSection] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: reps } = await supabase
        .from("reports")
        .select("id,client_name,inputs,created_at")
        .order("created_at", { ascending: false });
      if (reps) setReports(reps as ReportRow[]);
    })();
  }, [profile]);

  const filteredReports = reports.filter(r =>
    r.client_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectClient = (r: ReportRow) => {
    setSelectedClient(r);
    const inp = (r.inputs || {}) as Record<string, unknown>;
    const ff = emptyFactFind();
    ff.client1Name = String(inp.clientName || r.client_name || "");
    ff.client1Email = String(inp.clientEmail || "");
    ff.client1Mobile = String(inp.clientPhone || "");
    ff.dateCompleted = new Date().toISOString().slice(0, 10);
    // Pre-fill super info if available
    if (inp.fundName) {
      ff.client1SuperFunds = [{ fund: String(inp.fundName), accountNumber: "", balance: String(inp.superBalance || "") }];
    }
    setData(ff);
  };

  const updateData = (patch: Partial<FactFindData>) => setData(prev => ({ ...prev, ...patch }));

  /* ─── PDF Export ─── */
  const exportPDF = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const W = 210, H = 297;
      const margin = 15;
      const contentW = W - margin * 2;
      let y = 0;

      const addPage = () => { pdf.addPage(); y = margin; };
      const checkSpace = (need: number) => { if (y + need > H - margin) addPage(); };

      // Colours
      const navy = [15, 23, 42];
      const cyan = [0, 188, 212];
      const white = [255, 255, 255];
      const lightGray = [241, 245, 249];
      const darkText = [30, 41, 59];

      // Helper: section header
      const sectionHeader = (title: string) => {
        checkSpace(16);
        pdf.setFillColor(navy[0], navy[1], navy[2]);
        pdf.rect(margin, y, contentW, 10, "F");
        pdf.setTextColor(white[0], white[1], white[2]);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text(title.toUpperCase(), margin + 4, y + 7);
        y += 14;
        pdf.setTextColor(darkText[0], darkText[1], darkText[2]);
        pdf.setFont("helvetica", "normal");
      };

      // Helper: dual column row
      const dualRow = (label: string, v1: string, v2: string, bg = false) => {
        checkSpace(8);
        if (bg) {
          pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
          pdf.rect(margin, y - 1, contentW, 7, "F");
        }
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text(label, margin + 2, y + 4);
        pdf.setTextColor(darkText[0], darkText[1], darkText[2]);
        pdf.text(v1 || "—", margin + 65, y + 4);
        pdf.text(v2 || "—", margin + 125, y + 4);
        y += 7;
      };

      const singleRow = (label: string, value: string, bg = false) => {
        checkSpace(8);
        if (bg) {
          pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
          pdf.rect(margin, y - 1, contentW, 7, "F");
        }
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text(label, margin + 2, y + 4);
        pdf.setTextColor(darkText[0], darkText[1], darkText[2]);
        const lines = pdf.splitTextToSize(value || "—", contentW - 70);
        pdf.text(lines, margin + 65, y + 4);
        y += 7 * Math.max(1, lines.length);
      };

      // ── COVER PAGE ──
      pdf.setFillColor(navy[0], navy[1], navy[2]);
      pdf.rect(0, 0, W, H, "F");
      // Logo area
      pdf.setFillColor(cyan[0], cyan[1], cyan[2]);
      pdf.roundedRect(W / 2 - 20, 40, 40, 40, 8, 8, "F");
      pdf.setTextColor(navy[0], navy[1], navy[2]);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("ALO", W / 2, 67, { align: "center" });

      pdf.setTextColor(white[0], white[1], white[2]);
      pdf.setFontSize(36);
      pdf.setFont("helvetica", "bold");
      pdf.text("FACT FIND", W / 2, 110, { align: "center" });

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.text("PART A", W / 2, 125, { align: "center" });

      // Client info box
      pdf.setFillColor(255, 255, 255, 0.1);
      pdf.setDrawColor(cyan[0], cyan[1], cyan[2]);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin + 20, 145, contentW - 40, 60, 4, 4, "S");

      pdf.setFontSize(10);
      pdf.setTextColor(cyan[0], cyan[1], cyan[2]);
      pdf.text("Date Completed", margin + 30, 158);
      pdf.text("Client 1 Name", margin + 30, 172);
      pdf.text("Client 2 Name", margin + 30, 186);
      pdf.text("Representative Name", margin + 30, 200);

      pdf.setTextColor(white[0], white[1], white[2]);
      pdf.text(data.dateCompleted, margin + 80, 158);
      pdf.text(data.client1Name, margin + 80, 172);
      pdf.text(data.client2Name, margin + 80, 186);
      pdf.text(data.representativeName, margin + 80, 200);

      // Important notice
      pdf.setFontSize(7);
      pdf.setTextColor(200, 200, 200);
      const notice = "The factual information provided in this section is collected prior to any advice discussion and is reviewed by a licensed financial adviser before any advice is provided. This information alone does not constitute personal financial advice.";
      const noticeLines = pdf.splitTextToSize(notice, contentW - 40);
      pdf.text(noticeLines, margin + 20, 230);

      // ── PERSONAL DETAILS ──
      addPage();
      sectionHeader("Personal Details");
      // Column headers
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text("", margin + 2, y + 4);
      pdf.text("Client 1", margin + 65, y + 4);
      pdf.text("Client 2", margin + 125, y + 4);
      y += 7;
      pdf.setFont("helvetica", "normal");

      const personalFields = [
        ["Title", data.client1Title, data.client2Title],
        ["Client name", data.client1Name, data.client2Name],
        ["Middle name", data.client1MiddleName, data.client2MiddleName],
        ["Preferred name", data.client1PreferredName, data.client2PreferredName],
        ["Maiden name", data.client1MaidenName, data.client2MaidenName],
        ["Date of Birth", data.client1DOB, data.client2DOB],
        ["Gender", data.client1Gender, data.client2Gender],
        ["Marital status", data.client1MaritalStatus, data.client2MaritalStatus],
        ["Australian citizen", data.client1AustralianCitizen, data.client2AustralianCitizen],
        ["Visa details", data.client1VisaDetails, data.client2VisaDetails],
        ["Bankruptcy status", data.client1BankruptcyStatus, data.client2BankruptcyStatus],
        ["Tax file number", data.client1TFN, data.client2TFN],
      ];
      personalFields.forEach(([l, v1, v2], i) => dualRow(l, v1, v2, i % 2 === 0));

      y += 4;
      sectionHeader("Contact Details");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("", margin + 2, y + 4);
      pdf.text("Client 1", margin + 65, y + 4);
      pdf.text("Client 2", margin + 125, y + 4);
      y += 7;
      pdf.setFont("helvetica", "normal");

      const contactFields = [
        ["Mobile", data.client1Mobile, data.client2Mobile],
        ["Home", data.client1Home, data.client2Home],
        ["Email", data.client1Email, data.client2Email],
      ];
      contactFields.forEach(([l, v1, v2], i) => dualRow(l, v1, v2, i % 2 === 0));
      singleRow("Street address", data.streetAddress);
      singleRow("Suburb", data.suburb, true);
      singleRow("State / Postcode", `${data.state}  ${data.postcode}`);

      // Dependents
      y += 4;
      sectionHeader("Dependents");
      if (data.noDependents) {
        singleRow("", "No dependents");
      } else {
        data.dependents.forEach((d, i) => {
          if (d.name) {
            dualRow(`Dependent ${i + 1}`, `${d.name} (${d.gender})`, `DOB: ${d.dob} | Fees: ${d.annualSchoolFees}`, i % 2 === 0);
          }
        });
      }

      // Employment
      const printEmployment = (title: string, e: EmploymentBlock) => {
        addPage();
        sectionHeader(title);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text("", margin + 2, y + 4);
        pdf.text("Client 1", margin + 65, y + 4);
        y += 7;
        pdf.setFont("helvetica", "normal");
        const fields = [
          ["Employment status", e.employmentStatus],
          ["Hours worked per week", e.hoursPerWeek],
          ["Occupation/Title", e.occupationTitle],
          ["Industry", e.industry],
          ["Time in occupation", `${e.timeInOccupationYears}y ${e.timeInOccupationMonths}m`],
          ["Time with employer", `${e.timeWithEmployerYears}y ${e.timeWithEmployerMonths}m`],
          ["Qualifications", e.qualifications],
          ["EBA in place", e.ebaInPlace],
          ["Duties performed", e.dutiesPerformed],
          ["Work above 10m/underground", e.workAbove10m],
          ["Office/Admin %", e.officeAdminPct],
          ["Manual/Field %", e.manualFieldPct],
          ["Travel %", e.travelPct],
          ["Supervision %", e.supervisionPct],
          ["Annual leave days", e.annualLeaveDays],
          ["Sick leave days", e.sickLeaveDays],
          ["Long service leave days", e.longServiceDays],
          ["Personal super contributions", e.personalSuperContributions],
          ["Annual income", e.annualIncome],
          ["Annual bonus", e.annualBonus],
          ["Annual commissions", e.annualCommissions],
          ["Annual overtime", e.annualOvertime],
        ];
        fields.forEach(([l, v], i) => singleRow(l, v, i % 2 === 0));
        if (e.additionalNotes) { y += 2; singleRow("Additional notes", e.additionalNotes); }
      };

      printEmployment("Primary Employment Details - Client 1", data.primaryEmployment1);
      printEmployment("Primary Employment Details - Client 2", data.primaryEmployment2);
      printEmployment("Secondary Employment Details - Client 1", data.secondaryEmployment1);
      printEmployment("Secondary Employment Details - Client 2", data.secondaryEmployment2);

      // Self employment
      const printSelf = (title: string, s: SelfEmploymentBlock) => {
        addPage();
        sectionHeader(title);
        const fields = [
          ["Occupation/Title", s.occupationTitle],
          ["Industry", s.industry],
          ["Qualifications", s.qualifications],
          ["Business structure", s.businessStructure],
          ["Time self-employed", `${s.timeSelfEmployedYears}y ${s.timeSelfEmployedMonths}m`],
          ["% business owned", s.businessOwnedPct],
          ["Number of employees", s.employeeCount],
          ["Duties performed", s.dutiesPerformed],
          ["Work above 10m", s.workAbove10m],
          ["Office/Admin %", s.officeAdminPct],
          ["Manual/Field %", s.manualFieldPct],
          ["Annual income", s.annualIncome],
          ["Annual dividends", s.annualDividends],
        ];
        fields.forEach(([l, v], i) => singleRow(l, v, i % 2 === 0));
      };
      printSelf("Self-Employment Details - Client 1", data.selfEmployment1);
      printSelf("Self-Employment Details - Client 2", data.selfEmployment2);

      // Assets
      addPage();
      sectionHeader("Assets & Liabilities");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text("Asset", margin + 2, y + 4);
      pdf.text("Value", margin + 55, y + 4);
      pdf.text("Debt", margin + 80, y + 4);
      pdf.text("Owner", margin + 105, y + 4);
      pdf.text("Monthly Repay.", margin + 140, y + 4);
      y += 7;
      pdf.setFont("helvetica", "normal");
      data.assets.forEach((a, i) => {
        checkSpace(8);
        if (i % 2 === 0) {
          pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
          pdf.rect(margin, y - 1, contentW, 7, "F");
        }
        pdf.setFontSize(7);
        pdf.text(a.asset, margin + 2, y + 4);
        pdf.text(a.value, margin + 55, y + 4);
        pdf.text(a.debt, margin + 80, y + 4);
        pdf.text(a.owner, margin + 105, y + 4);
        pdf.text(a.monthlyRepayments, margin + 140, y + 4);
        y += 7;
      });

      // Expenses
      y += 4;
      sectionHeader("Living Expenses");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text("Expense", margin + 2, y + 4);
      pdf.text("Weekly", margin + 65, y + 4);
      pdf.text("Monthly", margin + 90, y + 4);
      pdf.text("Quarterly", margin + 115, y + 4);
      pdf.text("Annually", margin + 145, y + 4);
      y += 7;
      pdf.setFont("helvetica", "normal");
      data.expenses.forEach((e, i) => {
        checkSpace(8);
        if (i % 2 === 0) {
          pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
          pdf.rect(margin, y - 1, contentW, 7, "F");
        }
        pdf.setFontSize(7);
        pdf.text(e.expense, margin + 2, y + 4);
        pdf.text(e.weekly, margin + 65, y + 4);
        pdf.text(e.monthly, margin + 90, y + 4);
        pdf.text(e.quarterly, margin + 115, y + 4);
        pdf.text(e.annually, margin + 145, y + 4);
        y += 7;
      });

      // Super & Insurance
      addPage();
      sectionHeader("Existing Superannuation Funds - Client 1");
      data.client1SuperFunds.forEach((sf, i) => {
        singleRow(`Fund ${i + 1}`, `${sf.fund} | Acc: ${sf.accountNumber} | Balance: ${sf.balance}`, i % 2 === 0);
      });
      y += 4;
      sectionHeader("Existing Superannuation Funds - Client 2");
      data.client2SuperFunds.forEach((sf, i) => {
        singleRow(`Fund ${i + 1}`, `${sf.fund} | Acc: ${sf.accountNumber} | Balance: ${sf.balance}`, i % 2 === 0);
      });
      y += 4;
      sectionHeader("Existing Personal Insurances - Client 1");
      data.client1Insurance.forEach((ins, i) => {
        singleRow(`Policy ${i + 1}`, `${ins.insurer} | #${ins.policyNumber} | ${ins.coverType} | $${ins.sumInsured} | $${ins.premiumPA}/yr`, i % 2 === 0);
      });
      y += 4;
      sectionHeader("Existing Personal Insurances - Client 2");
      data.client2Insurance.forEach((ins, i) => {
        singleRow(`Policy ${i + 1}`, `${ins.insurer} | #${ins.policyNumber} | ${ins.coverType} | $${ins.sumInsured} | $${ins.premiumPA}/yr`, i % 2 === 0);
      });

      // Estate Planning
      y += 4;
      sectionHeader("Estate Planning");
      dualRow("Will in place?", data.client1HasWill, data.client2HasWill);
      dualRow("Last reviewed?", data.client1WillLastReviewed, data.client2WillLastReviewed, true);
      dualRow("Power of Attorney?", data.client1POA, data.client2POA);

      // Health
      addPage();
      sectionHeader("Health Details & Medical History");
      dualRow("Height (cm)", data.client1Height, data.client2Height);
      dualRow("Weight (kg)", data.client1Weight, data.client2Weight, true);
      dualRow("BMI", data.client1BMI, data.client2BMI);
      dualRow("Smoke or vape?", data.client1SmokeVape, data.client2SmokeVape, true);
      dualRow("Drinks per week", data.client1DrinksPerWeek, data.client2DrinksPerWeek);
      dualRow("Recreational drugs?", data.client1RecreationalDrugs, data.client2RecreationalDrugs, true);
      dualRow("General health", data.client1GeneralHealth, data.client2GeneralHealth);

      y += 4;
      sectionHeader("Conditions");
      HEALTH_CONDITIONS.forEach((c, i) => {
        if (data.healthConditions[c]) singleRow("✓ " + c, "", i % 2 === 0);
      });
      HEALTH_SCENARIOS.forEach((s, i) => {
        if (data.healthScenarios[s]) singleRow("✓ " + s, "", i % 2 === 0);
      });

      // Health condition details
      Object.entries(data.healthDetails).forEach(([key, val]) => {
        if (val && val.trim()) {
          checkSpace(20);
          sectionHeader(key);
          const lines = pdf.splitTextToSize(val, contentW - 10);
          pdf.setFontSize(8);
          pdf.text(lines, margin + 2, y + 4);
          y += lines.length * 4 + 4;
        }
      });

      // Part B
      addPage();
      pdf.setFillColor(navy[0], navy[1], navy[2]);
      pdf.rect(0, 0, W, 50, "F");
      pdf.setTextColor(white[0], white[1], white[2]);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("FACT FIND — PART B", W / 2, 25, { align: "center" });
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Financial Adviser Section", W / 2, 38, { align: "center" });
      y = 60;
      pdf.setTextColor(darkText[0], darkText[1], darkText[2]);
      singleRow("Date Completed", data.partBDateCompleted);
      singleRow("Adviser Name", data.partBAdviserName, true);
      singleRow("Reasons for Advice", data.initialReasonsForAdvice);

      // Objectives
      y += 4;
      sectionHeader("Objectives");
      data.objectives.forEach((o, i) => {
        if (o.objective) {
          singleRow(`Objective ${i + 1}`, `${o.objective} | Term: ${o.term} | Priority: ${o.priority} | $${o.amountRequired}`, i % 2 === 0);
        }
      });

      // Advice Goals
      y += 4;
      sectionHeader("Advice Goals");
      Object.entries(data.adviceGoalsSuper).forEach(([k, v]) => {
        if (v) singleRow("Super: " + k, "✓");
      });
      Object.entries(data.adviceGoalsOutside).forEach(([k, v]) => {
        if (v) singleRow("Outside Super: " + k, "✓");
      });
      dualRow("Retirement date/age", data.client1RetirementAge, data.client2RetirementAge, true);
      dualRow("Expected retirement income", data.client1RetirementIncome, data.client2RetirementIncome);

      // Risk Profile
      addPage();
      sectionHeader("Risk Profile Results");
      dualRow("Total points", data.client1TotalPoints, data.client2TotalPoints);
      dualRow("Risk profile", data.client1RiskProfile, data.client2RiskProfile, true);
      singleRow("Agreement", data.riskAgree);

      // Beneficiaries
      y += 4;
      sectionHeader("Nomination of Beneficiaries");
      singleRow("Client 1 nomination type", data.client1NominationType);
      data.client1Beneficiaries.forEach((b, i) => {
        if (b.fullName) singleRow(`Beneficiary ${i + 1}`, `${b.fullName} | ${b.relationship} | ${b.benefitPct}%`, i % 2 === 0);
      });
      y += 4;
      singleRow("Client 2 nomination type", data.client2NominationType);
      data.client2Beneficiaries.forEach((b, i) => {
        if (b.fullName) singleRow(`Beneficiary ${i + 1}`, `${b.fullName} | ${b.relationship} | ${b.benefitPct}%`, i % 2 === 0);
      });

      // Acknowledgements
      addPage();
      sectionHeader("Acknowledgements");
      dualRow("FSG provided date", data.client1FSGDate, data.client2FSGDate);
      singleRow("SOA Fee", `$${data.soaFee}`);

      const fileName = `FactFind_${data.client1Name.replace(/\s+/g, "_") || "Client"}_${data.dateCompleted}.pdf`;
      pdf.save(fileName);
      toast.success("Fact Find PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <CRMLayout><div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading...</p></div></CRMLayout>;

  /* ─── Client Selection Screen ─── */
  if (!selectedClient) {
    return (
      <CRMLayout>
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan to-cyan/60 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Fact Find</h1>
            <p className="text-muted-foreground">Select a client to start or continue a Fact Find</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              className="pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="grid gap-3">
            {filteredReports.map(r => (
              <button
                key={r.id}
                onClick={() => selectClient(r)}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left w-full"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              </button>
            ))}
            {filteredReports.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No clients found. Generate a report first to populate the client list.</p>
            )}
          </div>
        </div>
      </CRMLayout>
    );
  }

  /* ─── Form Helpers ─── */
  const Field = ({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) => (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );

  const DualField = ({ label, v1, v2, onChange1, onChange2 }: { label: string; v1: string; v2: string; onChange1: (v: string) => void; onChange2: (v: string) => void }) => (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-end">
      <Label className="text-xs text-muted-foreground self-center">{label}</Label>
      <Input value={v1} onChange={e => onChange1(e.target.value)} className="h-8 text-sm" placeholder="Client 1" />
      <Input value={v2} onChange={e => onChange2(e.target.value)} className="h-8 text-sm" placeholder="Client 2" />
    </div>
  );

  /* ─── Section Renderers ─── */

  const SectionDivider = ({ title }: { title: string }) => (
    <div className="relative -mx-6 px-6 py-4 mt-8 mb-4" style={{ background: "linear-gradient(160deg, hsl(215 65% 14%) 0%, hsl(215 60% 18%) 45%, hsl(210 55% 24%) 100%)" }}>
      <h3 className="text-white font-bold text-sm tracking-wide uppercase">{title}</h3>
    </div>
  );

  const renderAllSections = () => (
    <div className="space-y-2">
      {/* Cover fields */}
      <div className="space-y-4">
        <Field label="Date Completed" value={data.dateCompleted} onChange={v => updateData({ dateCompleted: v })} />
        <Field label="Client 1 Name" value={data.client1Name} onChange={v => updateData({ client1Name: v })} />
        <Field label="Client 2 Name" value={data.client2Name} onChange={v => updateData({ client2Name: v })} />
        <Field label="Representative Name" value={data.representativeName} onChange={v => updateData({ representativeName: v })} />
        <div className="p-4 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <p className="font-semibold mb-1">Important Notice</p>
          <p>The factual information provided in this section is collected prior to any advice discussion and is reviewed by a licensed financial adviser before any advice is provided. This information alone does not constitute personal financial advice. Any recommendations will be based on a full assessment of your circumstances and formalised in a Statement of Advice (SoA).</p>
        </div>
      </div>

      case 1: // Personal Details
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 pb-2 border-b">
              <div />
              <p className="text-xs font-semibold text-center">Client 1</p>
              <p className="text-xs font-semibold text-center">Client 2</p>
            </div>
            <DualField label="Title" v1={data.client1Title} v2={data.client2Title} onChange1={v => updateData({ client1Title: v })} onChange2={v => updateData({ client2Title: v })} />
            <DualField label="Client name" v1={data.client1Name} v2={data.client2Name} onChange1={v => updateData({ client1Name: v })} onChange2={v => updateData({ client2Name: v })} />
            <DualField label="Middle name" v1={data.client1MiddleName} v2={data.client2MiddleName} onChange1={v => updateData({ client1MiddleName: v })} onChange2={v => updateData({ client2MiddleName: v })} />
            <DualField label="Preferred name" v1={data.client1PreferredName} v2={data.client2PreferredName} onChange1={v => updateData({ client1PreferredName: v })} onChange2={v => updateData({ client2PreferredName: v })} />
            <DualField label="Maiden name (if applicable)" v1={data.client1MaidenName} v2={data.client2MaidenName} onChange1={v => updateData({ client1MaidenName: v })} onChange2={v => updateData({ client2MaidenName: v })} />
            <DualField label="Date of Birth" v1={data.client1DOB} v2={data.client2DOB} onChange1={v => updateData({ client1DOB: v })} onChange2={v => updateData({ client2DOB: v })} />
            <DualField label="Gender" v1={data.client1Gender} v2={data.client2Gender} onChange1={v => updateData({ client1Gender: v })} onChange2={v => updateData({ client2Gender: v })} />
            <DualField label="Marital status" v1={data.client1MaritalStatus} v2={data.client2MaritalStatus} onChange1={v => updateData({ client1MaritalStatus: v })} onChange2={v => updateData({ client2MaritalStatus: v })} />
            <DualField label="Australian citizen" v1={data.client1AustralianCitizen} v2={data.client2AustralianCitizen} onChange1={v => updateData({ client1AustralianCitizen: v })} onChange2={v => updateData({ client2AustralianCitizen: v })} />
            <DualField label="If no, Visa details" v1={data.client1VisaDetails} v2={data.client2VisaDetails} onChange1={v => updateData({ client1VisaDetails: v })} onChange2={v => updateData({ client2VisaDetails: v })} />
            <DualField label="Bankruptcy status" v1={data.client1BankruptcyStatus} v2={data.client2BankruptcyStatus} onChange1={v => updateData({ client1BankruptcyStatus: v })} onChange2={v => updateData({ client2BankruptcyStatus: v })} />
            <DualField label="Tax file number" v1={data.client1TFN} v2={data.client2TFN} onChange1={v => updateData({ client1TFN: v })} onChange2={v => updateData({ client2TFN: v })} />

            <div className="pt-4 border-t">
              <h3 className="font-semibold text-sm mb-3">Contact Details</h3>
              <div className="space-y-3">
                <DualField label="Mobile" v1={data.client1Mobile} v2={data.client2Mobile} onChange1={v => updateData({ client1Mobile: v })} onChange2={v => updateData({ client2Mobile: v })} />
                <DualField label="Home" v1={data.client1Home} v2={data.client2Home} onChange1={v => updateData({ client1Home: v })} onChange2={v => updateData({ client2Home: v })} />
                <DualField label="Email" v1={data.client1Email} v2={data.client2Email} onChange1={v => updateData({ client1Email: v })} onChange2={v => updateData({ client2Email: v })} />
                <Field label="Street address" value={data.streetAddress} onChange={v => updateData({ streetAddress: v })} />
                <Field label="Suburb" value={data.suburb} onChange={v => updateData({ suburb: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={data.state} onChange={v => updateData({ state: v })} />
                  <Field label="Postcode" value={data.postcode} onChange={v => updateData({ postcode: v })} />
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Dependents
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={data.noDependents} onCheckedChange={v => updateData({ noDependents: !!v })} />
              <Label className="text-sm">No dependents</Label>
            </div>
            {!data.noDependents && (
              <>
                <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-muted-foreground">
                  <span>Name</span><span>Gender</span><span>Date of Birth</span><span>Age</span><span>Annual School Fees</span>
                </div>
                {data.dependents.map((d, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2">
                    <Input className="h-8 text-sm" value={d.name} onChange={e => { const deps = [...data.dependents]; deps[i] = { ...d, name: e.target.value }; updateData({ dependents: deps }); }} />
                    <Input className="h-8 text-sm" value={d.gender} onChange={e => { const deps = [...data.dependents]; deps[i] = { ...d, gender: e.target.value }; updateData({ dependents: deps }); }} />
                    <Input className="h-8 text-sm" value={d.dob} onChange={e => { const deps = [...data.dependents]; deps[i] = { ...d, dob: e.target.value }; updateData({ dependents: deps }); }} />
                    <Input className="h-8 text-sm" value={d.age} onChange={e => { const deps = [...data.dependents]; deps[i] = { ...d, age: e.target.value }; updateData({ dependents: deps }); }} />
                    <Input className="h-8 text-sm" value={d.annualSchoolFees} onChange={e => { const deps = [...data.dependents]; deps[i] = { ...d, annualSchoolFees: e.target.value }; updateData({ dependents: deps }); }} placeholder="$" />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateData({ dependents: [...data.dependents, { name: "", gender: "", dob: "", age: "", annualSchoolFees: "" }] })}>
                  + Add Dependent
                </Button>
              </>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Additional notes</Label>
              <Textarea value={data.dependentsNotes} onChange={e => updateData({ dependentsNotes: e.target.value })} className="text-sm" rows={3} />
            </div>
          </div>
        );

      case 3: // Primary Employment
      case 4: // Secondary Employment
        {
          const isPrimary = activeSection === 3;
          const titlePrefix = isPrimary ? "Primary" : "Secondary";
          const emp1Key = isPrimary ? "primaryEmployment1" : "secondaryEmployment1";
          const emp2Key = isPrimary ? "primaryEmployment2" : "secondaryEmployment2";
          const emp1 = data[emp1Key];
          const emp2 = data[emp2Key];

          const updateEmp = (clientNum: 1 | 2, field: keyof EmploymentBlock, value: string) => {
            const key = clientNum === 1 ? emp1Key : emp2Key;
            const current = clientNum === 1 ? emp1 : emp2;
            updateData({ [key]: { ...current, [field]: value } } as any);
          };

          const renderEmploymentFields = (emp: EmploymentBlock, clientNum: 1 | 2) => (
            <div className="space-y-3 p-4 rounded-lg border">
              <h4 className="font-semibold text-sm">Client {clientNum}</h4>
              <Field label="Employment status" value={emp.employmentStatus} onChange={v => updateEmp(clientNum, "employmentStatus", v)} />
              <Field label="Hours worked per week" value={emp.hoursPerWeek} onChange={v => updateEmp(clientNum, "hoursPerWeek", v)} />
              <Field label="Occupation/Title" value={emp.occupationTitle} onChange={v => updateEmp(clientNum, "occupationTitle", v)} />
              <Field label="Industry" value={emp.industry} onChange={v => updateEmp(clientNum, "industry", v)} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Time in occupation (Years)" value={emp.timeInOccupationYears} onChange={v => updateEmp(clientNum, "timeInOccupationYears", v)} />
                <Field label="Months" value={emp.timeInOccupationMonths} onChange={v => updateEmp(clientNum, "timeInOccupationMonths", v)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Time with employer (Years)" value={emp.timeWithEmployerYears} onChange={v => updateEmp(clientNum, "timeWithEmployerYears", v)} />
                <Field label="Months" value={emp.timeWithEmployerMonths} onChange={v => updateEmp(clientNum, "timeWithEmployerMonths", v)} />
              </div>
              <Field label="Relevant qualifications" value={emp.qualifications} onChange={v => updateEmp(clientNum, "qualifications", v)} />
              <Field label="Are any EBA's in place?" value={emp.ebaInPlace} onChange={v => updateEmp(clientNum, "ebaInPlace", v)} />
              <div>
                <Label className="text-xs text-muted-foreground">Duties performed (day-to-day)</Label>
                <Textarea value={emp.dutiesPerformed} onChange={e => updateEmp(clientNum, "dutiesPerformed", e.target.value)} className="text-sm" rows={2} />
              </div>
              <Field label="Do you work above 10m or underground?" value={emp.workAbove10m} onChange={v => updateEmp(clientNum, "workAbove10m", v)} />
              {emp.workAbove10m?.toLowerCase().includes("yes") && (
                <Field label="Details" value={emp.workAbove10mDetails} onChange={v => updateEmp(clientNum, "workAbove10mDetails", v)} />
              )}
              <h5 className="font-semibold text-xs mt-2">Working Conditions (%)</h5>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Office / Admin %" value={emp.officeAdminPct} onChange={v => updateEmp(clientNum, "officeAdminPct", v)} />
                <Field label="Manual / Field work %" value={emp.manualFieldPct} onChange={v => updateEmp(clientNum, "manualFieldPct", v)} />
                <Field label="Travel %" value={emp.travelPct} onChange={v => updateEmp(clientNum, "travelPct", v)} />
                <Field label="Supervision %" value={emp.supervisionPct} onChange={v => updateEmp(clientNum, "supervisionPct", v)} />
              </div>
              <h5 className="font-semibold text-xs mt-2">Leave Information</h5>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Annual leave days" value={emp.annualLeaveDays} onChange={v => updateEmp(clientNum, "annualLeaveDays", v)} />
                <Field label="Sick leave days" value={emp.sickLeaveDays} onChange={v => updateEmp(clientNum, "sickLeaveDays", v)} />
                <Field label="Long service leave" value={emp.longServiceDays} onChange={v => updateEmp(clientNum, "longServiceDays", v)} />
              </div>
              <h5 className="font-semibold text-xs mt-2">Income Details</h5>
              <Field label="Personal super contributions?" value={emp.personalSuperContributions} onChange={v => updateEmp(clientNum, "personalSuperContributions", v)} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Annual income" value={emp.annualIncome} onChange={v => updateEmp(clientNum, "annualIncome", v)} />
                <Field label="Annual bonus" value={emp.annualBonus} onChange={v => updateEmp(clientNum, "annualBonus", v)} />
                <Field label="Annual commissions" value={emp.annualCommissions} onChange={v => updateEmp(clientNum, "annualCommissions", v)} />
                <Field label="Annual overtime" value={emp.annualOvertime} onChange={v => updateEmp(clientNum, "annualOvertime", v)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Additional notes</Label>
                <Textarea value={emp.additionalNotes} onChange={e => updateEmp(clientNum, "additionalNotes", e.target.value)} className="text-sm" rows={2} />
              </div>
            </div>
          );

          return (
            <div className="space-y-4">
              <h3 className="font-semibold">{titlePrefix} Employment Details</h3>
              {renderEmploymentFields(emp1, 1)}
              {renderEmploymentFields(emp2, 2)}
            </div>
          );
        }

      case 5: // Self-Employment
        {
          const renderSelf = (se: SelfEmploymentBlock, clientNum: 1 | 2) => {
            const key = clientNum === 1 ? "selfEmployment1" : "selfEmployment2";
            const updateSE = (field: keyof SelfEmploymentBlock, value: string) => {
              updateData({ [key]: { ...se, [field]: value } } as any);
            };
            return (
              <div className="space-y-3 p-4 rounded-lg border">
                <h4 className="font-semibold text-sm">Client {clientNum}</h4>
                <Field label="Occupation/Title" value={se.occupationTitle} onChange={v => updateSE("occupationTitle", v)} />
                <Field label="Industry" value={se.industry} onChange={v => updateSE("industry", v)} />
                <Field label="Relevant qualifications" value={se.qualifications} onChange={v => updateSE("qualifications", v)} />
                <Field label="Business structure" value={se.businessStructure} onChange={v => updateSE("businessStructure", v)} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Time self-employed (Years)" value={se.timeSelfEmployedYears} onChange={v => updateSE("timeSelfEmployedYears", v)} />
                  <Field label="Months" value={se.timeSelfEmployedMonths} onChange={v => updateSE("timeSelfEmployedMonths", v)} />
                </div>
                <Field label="% of business owned" value={se.businessOwnedPct} onChange={v => updateSE("businessOwnedPct", v)} />
                <Field label="How many employees" value={se.employeeCount} onChange={v => updateSE("employeeCount", v)} />
                <div>
                  <Label className="text-xs text-muted-foreground">Duties performed (day-to-day)</Label>
                  <Textarea value={se.dutiesPerformed} onChange={e => updateSE("dutiesPerformed", e.target.value)} className="text-sm" rows={2} />
                </div>
                <Field label="Work above 10m or underground?" value={se.workAbove10m} onChange={v => updateSE("workAbove10m", v)} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Office/Admin %" value={se.officeAdminPct} onChange={v => updateSE("officeAdminPct", v)} />
                  <Field label="Manual/Field %" value={se.manualFieldPct} onChange={v => updateSE("manualFieldPct", v)} />
                  <Field label="Travel %" value={se.travelPct} onChange={v => updateSE("travelPct", v)} />
                  <Field label="Supervision %" value={se.supervisionPct} onChange={v => updateSE("supervisionPct", v)} />
                </div>
                <Field label="Personal super contributions?" value={se.personalSuperContributions} onChange={v => updateSE("personalSuperContributions", v)} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Annual income" value={se.annualIncome} onChange={v => updateSE("annualIncome", v)} />
                  <Field label="Annual dividends" value={se.annualDividends} onChange={v => updateSE("annualDividends", v)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Additional notes</Label>
                  <Textarea value={se.additionalNotes} onChange={e => updateSE("additionalNotes", e.target.value)} className="text-sm" rows={2} />
                </div>
              </div>
            );
          };
          return (
            <div className="space-y-4">
              <h3 className="font-semibold">Self-Employment Details</h3>
              {renderSelf(data.selfEmployment1, 1)}
              {renderSelf(data.selfEmployment2, 2)}
            </div>
          );
        }

      case 6: // Assets & Liabilities
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Assets & Liabilities</h3>
            <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-muted-foreground">
              <span>Asset</span><span>Value</span><span>Debt</span><span>Owner</span><span>Monthly Repay.</span>
            </div>
            {data.assets.map((a, i) => (
              <div key={i} className="grid grid-cols-5 gap-2">
                <Input className="h-8 text-xs" value={a.asset} onChange={e => { const assets = [...data.assets]; assets[i] = { ...a, asset: e.target.value }; updateData({ assets }); }} />
                <Input className="h-8 text-xs" placeholder="$" value={a.value} onChange={e => { const assets = [...data.assets]; assets[i] = { ...a, value: e.target.value }; updateData({ assets }); }} />
                <Input className="h-8 text-xs" placeholder="$" value={a.debt} onChange={e => { const assets = [...data.assets]; assets[i] = { ...a, debt: e.target.value }; updateData({ assets }); }} />
                <Input className="h-8 text-xs" value={a.owner} onChange={e => { const assets = [...data.assets]; assets[i] = { ...a, owner: e.target.value }; updateData({ assets }); }} />
                <Input className="h-8 text-xs" placeholder="$" value={a.monthlyRepayments} onChange={e => { const assets = [...data.assets]; assets[i] = { ...a, monthlyRepayments: e.target.value }; updateData({ assets }); }} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => updateData({ assets: [...data.assets, { asset: "", value: "", debt: "", owner: "", monthlyRepayments: "" }] })}>
              + Add Asset Row
            </Button>
          </div>
        );

      case 7: // Living Expenses
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Living Expenses</h3>
            <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-muted-foreground">
              <span>Expense</span><span>Weekly</span><span>Monthly</span><span>Quarterly</span><span>Annually</span>
            </div>
            {data.expenses.map((e, i) => (
              <div key={i} className="grid grid-cols-5 gap-2">
                <Input className="h-8 text-xs" value={e.expense} readOnly />
                <Input className="h-8 text-xs" placeholder="$" value={e.weekly} onChange={ev => { const expenses = [...data.expenses]; expenses[i] = { ...e, weekly: ev.target.value }; updateData({ expenses }); }} />
                <Input className="h-8 text-xs" placeholder="$" value={e.monthly} onChange={ev => { const expenses = [...data.expenses]; expenses[i] = { ...e, monthly: ev.target.value }; updateData({ expenses }); }} />
                <Input className="h-8 text-xs" placeholder="$" value={e.quarterly} onChange={ev => { const expenses = [...data.expenses]; expenses[i] = { ...e, quarterly: ev.target.value }; updateData({ expenses }); }} />
                <Input className="h-8 text-xs" placeholder="$" value={e.annually} onChange={ev => { const expenses = [...data.expenses]; expenses[i] = { ...e, annually: ev.target.value }; updateData({ expenses }); }} />
              </div>
            ))}
            <div className="pt-4 border-t space-y-3">
              <h4 className="font-semibold text-sm">Savings Capacity</h4>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Client 1 living expense split %" value={data.client1ExpenseSplitPct} onChange={v => updateData({ client1ExpenseSplitPct: v })} />
                <Field label="Client 2 living expense split %" value={data.client2ExpenseSplitPct} onChange={v => updateData({ client2ExpenseSplitPct: v })} />
              </div>
              <Field label="Total annual core expenses" value={data.totalAnnualCoreExpenses} onChange={v => updateData({ totalAnnualCoreExpenses: v })} />
              <h5 className="text-xs font-semibold text-muted-foreground">Dependent Educational Expenses</h5>
              {data.dependentEducationalExpenses.map((de, i) => (
                <Field key={i} label={`Dependent ${i + 1}`} value={de} onChange={v => { const arr = [...data.dependentEducationalExpenses]; arr[i] = v; updateData({ dependentEducationalExpenses: arr }); }} />
              ))}
            </div>
          </div>
        );

      case 8: // Super Funds & Insurance
        {
          const renderSuperFunds = (funds: SuperFundRow[], clientNum: 1 | 2) => {
            const key = clientNum === 1 ? "client1SuperFunds" : "client2SuperFunds";
            return (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Client {clientNum} - Superannuation Funds</h4>
                {funds.map((sf, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <Input className="h-8 text-xs" placeholder="Fund name" value={sf.fund} onChange={e => { const arr = [...funds]; arr[i] = { ...sf, fund: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" placeholder="Account number" value={sf.accountNumber} onChange={e => { const arr = [...funds]; arr[i] = { ...sf, accountNumber: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" placeholder="Balance" value={sf.balance} onChange={e => { const arr = [...funds]; arr[i] = { ...sf, balance: e.target.value }; updateData({ [key]: arr } as any); }} />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateData({ [key]: [...funds, { fund: "", accountNumber: "", balance: "" }] } as any)}>+ Add Fund</Button>
              </div>
            );
          };

          const renderInsurance = (ins: InsuranceRow[], clientNum: 1 | 2) => {
            const key = clientNum === 1 ? "client1Insurance" : "client2Insurance";
            return (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Client {clientNum} - Personal Insurances</h4>
                {ins.map((p, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2">
                    <Input className="h-8 text-xs" placeholder="Insurer" value={p.insurer} onChange={e => { const arr = [...ins]; arr[i] = { ...p, insurer: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" placeholder="Policy #" value={p.policyNumber} onChange={e => { const arr = [...ins]; arr[i] = { ...p, policyNumber: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" placeholder="Cover type" value={p.coverType} onChange={e => { const arr = [...ins]; arr[i] = { ...p, coverType: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" placeholder="Sum insured" value={p.sumInsured} onChange={e => { const arr = [...ins]; arr[i] = { ...p, sumInsured: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" placeholder="Premium p.a" value={p.premiumPA} onChange={e => { const arr = [...ins]; arr[i] = { ...p, premiumPA: e.target.value }; updateData({ [key]: arr } as any); }} />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateData({ [key]: [...ins, { insurer: "", policyNumber: "", coverType: "", sumInsured: "", premiumPA: "" }] } as any)}>+ Add Policy</Button>
              </div>
            );
          };

          return (
            <div className="space-y-6">
              {renderSuperFunds(data.client1SuperFunds, 1)}
              {renderSuperFunds(data.client2SuperFunds, 2)}
              <div className="border-t pt-4" />
              {renderInsurance(data.client1Insurance, 1)}
              {renderInsurance(data.client2Insurance, 2)}
              <div className="pt-4 border-t space-y-2">
                <h4 className="font-semibold text-sm">Private Health Cover</h4>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={data.hospitalCover} onCheckedChange={v => updateData({ hospitalCover: !!v })} /> Hospital cover</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={data.extrasCover} onCheckedChange={v => updateData({ extrasCover: !!v })} /> Extras</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={data.noneCover} onCheckedChange={v => updateData({ noneCover: !!v })} /> None</label>
                </div>
              </div>
            </div>
          );
        }

      case 9: // Estate Planning
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Estate Planning</h3>
            <DualField label="Do you have a Will?" v1={data.client1HasWill} v2={data.client2HasWill} onChange1={v => updateData({ client1HasWill: v })} onChange2={v => updateData({ client2HasWill: v })} />
            <DualField label="When was it last reviewed?" v1={data.client1WillLastReviewed} v2={data.client2WillLastReviewed} onChange1={v => updateData({ client1WillLastReviewed: v })} onChange2={v => updateData({ client2WillLastReviewed: v })} />
            <DualField label="Enduring Power of Attorney?" v1={data.client1POA} v2={data.client2POA} onChange1={v => updateData({ client1POA: v })} onChange2={v => updateData({ client2POA: v })} />
            <div>
              <Label className="text-xs text-muted-foreground">Additional notes</Label>
              <Textarea value={data.estatePlanningNotes} onChange={e => updateData({ estatePlanningNotes: e.target.value })} className="text-sm" rows={3} />
            </div>
          </div>
        );

      case 10: // Health Details
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Health Details & Medical History</h3>
            <DualField label="Height (cm)" v1={data.client1Height} v2={data.client2Height} onChange1={v => updateData({ client1Height: v })} onChange2={v => updateData({ client2Height: v })} />
            <DualField label="Weight (kg)" v1={data.client1Weight} v2={data.client2Weight} onChange1={v => updateData({ client1Weight: v })} onChange2={v => updateData({ client2Weight: v })} />
            <DualField label="BMI" v1={data.client1BMI} v2={data.client2BMI} onChange1={v => updateData({ client1BMI: v })} onChange2={v => updateData({ client2BMI: v })} />
            <DualField label="Smoke or vape?" v1={data.client1SmokeVape} v2={data.client2SmokeVape} onChange1={v => updateData({ client1SmokeVape: v })} onChange2={v => updateData({ client2SmokeVape: v })} />
            <DualField label="Standard drinks per week?" v1={data.client1DrinksPerWeek} v2={data.client2DrinksPerWeek} onChange1={v => updateData({ client1DrinksPerWeek: v })} onChange2={v => updateData({ client2DrinksPerWeek: v })} />
            <DualField label="Recreational drug use?" v1={data.client1RecreationalDrugs} v2={data.client2RecreationalDrugs} onChange1={v => updateData({ client1RecreationalDrugs: v })} onChange2={v => updateData({ client2RecreationalDrugs: v })} />
            <DualField label="General health condition" v1={data.client1GeneralHealth} v2={data.client2GeneralHealth} onChange1={v => updateData({ client1GeneralHealth: v })} onChange2={v => updateData({ client2GeneralHealth: v })} />

            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-3">Do any of the following conditions apply?</h4>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox checked={data.healthConditionsNoneApply} onCheckedChange={v => updateData({ healthConditionsNoneApply: !!v })} />
                <Label className="text-sm">None apply</Label>
              </div>
              {!data.healthConditionsNoneApply && (
                <div className="grid grid-cols-2 gap-2">
                  {HEALTH_CONDITIONS.map(c => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={data.healthConditions[c]} onCheckedChange={v => updateData({ healthConditions: { ...data.healthConditions, [c]: !!v } })} />
                      {c}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-3">Do any of the following scenarios apply?</h4>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox checked={data.healthScenariosNoneApply} onCheckedChange={v => updateData({ healthScenariosNoneApply: !!v })} />
                <Label className="text-sm">None apply</Label>
              </div>
              {!data.healthScenariosNoneApply && (
                <div className="space-y-2">
                  {HEALTH_SCENARIOS.map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={data.healthScenarios[s]} onCheckedChange={v => updateData({ healthScenarios: { ...data.healthScenarios, [s]: !!v } })} />
                      {s}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 11: // Health Conditions Detail
        {
          const activeConditions = HEALTH_CONDITIONS.filter(c => data.healthConditions[c]);
          const activeScenarios = HEALTH_SCENARIOS.filter(s => data.healthScenarios[s]);
          const allActive = [...activeConditions, ...activeScenarios];

          if (allActive.length === 0) {
            return (
              <div className="text-center py-8 text-muted-foreground">
                <p>No health conditions selected. Go back to Health Details to select conditions that apply.</p>
              </div>
            );
          }

          return (
            <div className="space-y-6">
              <h3 className="font-semibold">Health Condition Details</h3>
              <p className="text-xs text-muted-foreground">Provide detailed information for each selected condition. Include age diagnosed, medications, symptoms, treatments, and any additional notes.</p>
              {allActive.map(condition => (
                <div key={condition} className="space-y-2 p-4 rounded-lg border">
                  <h4 className="font-semibold text-sm">{condition}</h4>
                  <Textarea
                    value={data.healthDetails[condition] || ""}
                    onChange={e => updateData({ healthDetails: { ...data.healthDetails, [condition]: e.target.value } })}
                    className="text-sm"
                    rows={6}
                    placeholder={`Enter details for ${condition}...\n\nInclude:\n- Age diagnosed\n- Current symptoms\n- Medications (name, dosage, frequency)\n- Any hospitalisations\n- Treatment history\n- Additional notes`}
                  />
                </div>
              ))}
            </div>
          );
        }

      case 12: // Part B
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h3 className="font-semibold">FACT FIND — Part B</h3>
              <p className="text-xs text-muted-foreground mt-1">Financial Adviser Section</p>
            </div>
            <Field label="Date Completed" value={data.partBDateCompleted} onChange={v => updateData({ partBDateCompleted: v })} />
            <Field label="Adviser Name" value={data.partBAdviserName} onChange={v => updateData({ partBAdviserName: v })} />
            <div>
              <Label className="text-xs text-muted-foreground">Initial Reasons For Seeking Advice</Label>
              <Textarea value={data.initialReasonsForAdvice} onChange={e => updateData({ initialReasonsForAdvice: e.target.value })} className="text-sm" rows={4} />
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <p className="font-semibold mb-1">Important Notice</p>
              <p>This section is to be completed by a licensed financial adviser following a discussion with you. The purpose is to record your goals, preferences, and relevant personal circumstances to help formulate advice that is in your best interests.</p>
            </div>
          </div>
        );

      case 13: // Objectives
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Objectives</h3>
            {data.objectives.map((o, i) => (
              <div key={i} className="p-4 rounded-lg border space-y-3">
                <h4 className="text-sm font-semibold">Objective {i + 1}</h4>
                <Field label="Objective" value={o.objective} onChange={v => { const objs = [...data.objectives]; objs[i] = { ...o, objective: v }; updateData({ objectives: objs }); }} />
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Term" value={o.term} onChange={v => { const objs = [...data.objectives]; objs[i] = { ...o, term: v }; updateData({ objectives: objs }); }} />
                  <Field label="Priority (1-9)" value={o.priority} onChange={v => { const objs = [...data.objectives]; objs[i] = { ...o, priority: v }; updateData({ objectives: objs }); }} />
                  <Field label="Amount Required" value={o.amountRequired} onChange={v => { const objs = [...data.objectives]; objs[i] = { ...o, amountRequired: v }; updateData({ objectives: objs }); }} />
                </div>
              </div>
            ))}
          </div>
        );

      case 14: // Advice Goals & Scope
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Advice Goals (Fundable Through Superannuation)</h3>
              {Object.keys(data.adviceGoalsSuper).map(k => (
                <label key={k} className="flex items-center gap-2 text-sm mb-2">
                  <Checkbox checked={data.adviceGoalsSuper[k]} onCheckedChange={v => updateData({ adviceGoalsSuper: { ...data.adviceGoalsSuper, [k]: !!v } })} />
                  {k}
                </label>
              ))}
            </div>
            <div>
              <h3 className="font-semibold mb-3">Advice Goals (Fundable Outside of Superannuation)</h3>
              {Object.keys(data.adviceGoalsOutside).map(k => (
                <label key={k} className="flex items-center gap-2 text-sm mb-2">
                  <Checkbox checked={data.adviceGoalsOutside[k]} onCheckedChange={v => updateData({ adviceGoalsOutside: { ...data.adviceGoalsOutside, [k]: !!v } })} />
                  {k}
                </label>
              ))}
            </div>
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-3">Retirement Objectives</h4>
              <DualField label="Planned retirement date/age" v1={data.client1RetirementAge} v2={data.client2RetirementAge} onChange1={v => updateData({ client1RetirementAge: v })} onChange2={v => updateData({ client2RetirementAge: v })} />
              <DualField label="Expected retirement income (p.a)" v1={data.client1RetirementIncome} v2={data.client2RetirementIncome} onChange1={v => updateData({ client1RetirementIncome: v })} onChange2={v => updateData({ client2RetirementIncome: v })} />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Field label="Emergency cash requirements (Now)" value={data.emergencyFundsNow} onChange={v => updateData({ emergencyFundsNow: v })} />
                <Field label="Emergency cash requirements (Retirement)" value={data.emergencyFundsRetirement} onChange={v => updateData({ emergencyFundsRetirement: v })} />
              </div>
            </div>
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-3">Scope of Advice Agreement</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" checked={data.scopeOfAdvice === "full"} onChange={() => updateData({ scopeOfAdvice: "full" })} />
                  Full Comprehensive Advice
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" checked={data.scopeOfAdvice === "limited"} onChange={() => updateData({ scopeOfAdvice: "limited" })} />
                  Limited / Scaled Advice
                </label>
              </div>
              {data.scopeOfAdvice === "limited" && (
                <div className="mt-3 space-y-2">
                  {Object.keys(data.scopeLimitedAreas).map(k => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={data.scopeLimitedAreas[k]} onCheckedChange={v => updateData({ scopeLimitedAreas: { ...data.scopeLimitedAreas, [k]: !!v } })} />
                      {k}
                    </label>
                  ))}
                  <Field label="Other" value={data.scopeOther} onChange={v => updateData({ scopeOther: v })} />
                  <div>
                    <Label className="text-xs text-muted-foreground">Why are you choosing not to receive advice on other areas?</Label>
                    <Textarea value={data.scopeLimitingExplanation} onChange={e => updateData({ scopeLimitingExplanation: e.target.value })} className="text-sm" rows={3} />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 15: // Investment Goals
        return (
          <div className="space-y-6">
            <h3 className="font-semibold">Specific Investment Goals</h3>
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Administration Vehicle</h4>
              {["The Basic platform has features suitable to me", "The Wrap platform has features suitable to me", "I want to invest via a Self-Managed Superannuation Fund"].map(item => (
                <DualField key={item} label={item} v1={data.investmentGoals[`c1_${item}`] || ""} v2={data.investmentGoals[`c2_${item}`] || ""} onChange1={v => updateData({ investmentGoals: { ...data.investmentGoals, [`c1_${item}`]: v } })} onChange2={v => updateData({ investmentGoals: { ...data.investmentGoals, [`c2_${item}`]: v } })} />
              ))}
              <h4 className="font-semibold text-sm">Investment Vehicle</h4>
              {["Direct shares", "Managed funds", "SMA"].map(item => (
                <DualField key={item} label={`I would like assets in ${item}`} v1={data.investmentGoals[`c1_vehicle_${item}`] || ""} v2={data.investmentGoals[`c2_vehicle_${item}`] || ""} onChange1={v => updateData({ investmentGoals: { ...data.investmentGoals, [`c1_vehicle_${item}`]: v } })} onChange2={v => updateData({ investmentGoals: { ...data.investmentGoals, [`c2_vehicle_${item}`]: v } })} />
              ))}
              <h4 className="font-semibold text-sm">Investment Knowledge & Experience</h4>
              <DualField label="Level of knowledge" v1={data.investmentKnowledge.c1_level || ""} v2={data.investmentKnowledge.c2_level || ""} onChange1={v => updateData({ investmentKnowledge: { ...data.investmentKnowledge, c1_level: v } })} onChange2={v => updateData({ investmentKnowledge: { ...data.investmentKnowledge, c2_level: v } })} />
              <h5 className="text-xs font-semibold text-muted-foreground">Previously invested in:</h5>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(data.investmentExperience).map(k => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={data.investmentExperience[k]} onCheckedChange={v => updateData({ investmentExperience: { ...data.investmentExperience, [k]: !!v } })} />
                    {k}
                  </label>
                ))}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea value={data.investmentNotes} onChange={e => updateData({ investmentNotes: e.target.value })} className="text-sm" rows={3} />
              </div>
            </div>
          </div>
        );

      case 16: // Risk Profile
        {
          const questions = [
            { q: "1. How long is the period of your investment?", options: ["Less than 1 year (0)", "1 to 2 years (1)", "2 to 4 years (2)", "4 to 7 years (3)", "7 to 10 years (4)", "More than 10 years (5)"] },
            { q: "2. Willingness to accept financial risks?", options: ["Not at all (0)", "Low (3)", "Moderate (7)", "High (12)", "Very high (15)"] },
            { q: "3. Comfortable with long-term investments that fall in value?", options: ["Not at all (0)", "Reasonably comfortable (5)", "Very comfortable (10)"] },
            { q: "4. How reliant on income from this investment?", options: ["Need all income (0)", "Need most income (2)", "Need some income (5)", "May need some (7)", "Will not need income (10)"] },
            { q: "5. Which best summarises your objective?", options: ["Preservation of capital (0)", "Consistent income with security (2)", "Steady income and some growth (4)", "Balance of income and growth (6)", "Capital growth more important (8)", "Maximum capital growth (10)"] },
            { q: "6. At what point concerned about investment?", options: ["Any fall (0)", "Fall of 5% (3)", "Fall of 10% (6)", "Fall of 20% (12)", "Fall of more than 25% (15)"] },
            { q: "7. If value fell 25% in one month, would you:", options: ["Move immediately (0)", "Consider moving within 3 months (3)", "Move half within 6 months (6)", "Stay invested with concern (9)", "Stay invested unconcerned (12)"] },
            { q: "8. Importance of growth exceeding inflation?", options: ["Not important (0)", "Slightly important (3)", "Fairly important (7)", "Very important (10)"] },
            { q: "9. Understanding of investment markets?", options: ["Very little (0)", "Not very familiar (2)", "Understand markets fluctuate (5)", "Experienced in some (8)", "Experienced and knowledgeable (10)"] },
          ];

          return (
            <div className="space-y-6">
              <h3 className="font-semibold">Risk Profile Questionnaire</h3>
              {questions.map((q, qi) => (
                <div key={qi} className="p-4 rounded-lg border space-y-3">
                  <p className="text-sm font-medium">{q.q}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Client 1</Label>
                      <Select value={data.riskAnswers[`c1_q${qi}`] || ""} onValueChange={v => updateData({ riskAnswers: { ...data.riskAnswers, [`c1_q${qi}`]: v } })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {q.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Client 2</Label>
                      <Select value={data.riskAnswers[`c2_q${qi}`] || ""} onValueChange={v => updateData({ riskAnswers: { ...data.riskAnswers, [`c2_q${qi}`]: v } })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {q.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t space-y-3">
                <h4 className="font-semibold text-sm">Results</h4>
                <DualField label="Total points" v1={data.client1TotalPoints} v2={data.client2TotalPoints} onChange1={v => updateData({ client1TotalPoints: v })} onChange2={v => updateData({ client2TotalPoints: v })} />
                <DualField label="Risk profile" v1={data.client1RiskProfile} v2={data.client2RiskProfile} onChange1={v => updateData({ client1RiskProfile: v })} onChange2={v => updateData({ client2RiskProfile: v })} />
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="riskAgree" checked={data.riskAgree === "agree"} onChange={() => updateData({ riskAgree: "agree" })} />
                    I/We agree with the category assigned
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="riskAgree" checked={data.riskAgree === "disagree"} onChange={() => updateData({ riskAgree: "disagree" })} />
                    I/We do not agree with the category assigned
                  </label>
                </div>
                {data.riskAgree === "disagree" && (
                  <>
                    <Field label="Altered risk profile" value={data.alteredRiskProfile} onChange={v => updateData({ alteredRiskProfile: v })} />
                    <div>
                      <Label className="text-xs text-muted-foreground">Reason for altered risk profile</Label>
                      <Textarea value={data.alteredRiskReason} onChange={e => updateData({ alteredRiskReason: e.target.value })} className="text-sm" rows={3} />
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        }

      case 17: // Insurer Information
        {
          const empFields = [
            "daysWorkedPerWeek", "weeksWorkedPerYear", "employerName",
            "employerStreet", "employerSuburb", "employerState", "employerPostcode",
            "expectEarnAsMuch", "plansToChangeOccupation",
          ];
          const empLabels = [
            "Days worked per week", "Weeks worked per year", "Employer name",
            "Street address", "Suburb", "State", "Postcode",
            "Expect to earn as much this year?", "Plans to change occupation or hours?",
          ];
          const physFields = [
            "physicianName", "practiceName", "practicePhone",
            "practiceStreet", "practiceSuburb", "practiceState", "practicePostcode",
          ];
          const physLabels = [
            "Physician name", "Practice name", "Practice phone number",
            "Street address", "Suburb", "State", "Postcode",
          ];
          const contactFields = ["preferredDay", "preferredTime"];
          const contactLabels = ["Insurer preferred contact day?", "Insurer preferred contact time?"];

          return (
            <div className="space-y-6">
              <h3 className="font-semibold">Information for Insurer</h3>
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Employment</h4>
                {empFields.map((f, i) => (
                  <DualField key={f} label={empLabels[i]}
                    v1={data.insurerEmployment[`c1_${f}`] || ""}
                    v2={data.insurerEmployment[`c2_${f}`] || ""}
                    onChange1={v => updateData({ insurerEmployment: { ...data.insurerEmployment, [`c1_${f}`]: v } })}
                    onChange2={v => updateData({ insurerEmployment: { ...data.insurerEmployment, [`c2_${f}`]: v } })}
                  />
                ))}
              </div>
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-semibold text-sm">Primary Physician</h4>
                {physFields.map((f, i) => (
                  <DualField key={f} label={physLabels[i]}
                    v1={data.primaryPhysician[`c1_${f}`] || ""}
                    v2={data.primaryPhysician[`c2_${f}`] || ""}
                    onChange1={v => updateData({ primaryPhysician: { ...data.primaryPhysician, [`c1_${f}`]: v } })}
                    onChange2={v => updateData({ primaryPhysician: { ...data.primaryPhysician, [`c2_${f}`]: v } })}
                  />
                ))}
              </div>
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-semibold text-sm">Insurer Contact</h4>
                {contactFields.map((f, i) => (
                  <DualField key={f} label={contactLabels[i]}
                    v1={data.insurerContact[`c1_${f}`] || ""}
                    v2={data.insurerContact[`c2_${f}`] || ""}
                    onChange1={v => updateData({ insurerContact: { ...data.insurerContact, [`c1_${f}`]: v } })}
                    onChange2={v => updateData({ insurerContact: { ...data.insurerContact, [`c2_${f}`]: v } })}
                  />
                ))}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Additional notes</Label>
                <Textarea value={data.insurerNotes} onChange={e => updateData({ insurerNotes: e.target.value })} className="text-sm" rows={3} />
              </div>
            </div>
          );
        }

      case 18: // Beneficiaries
        {
          const renderBeneficiaries = (bens: BeneficiaryRow[], clientNum: 1 | 2) => {
            const key = clientNum === 1 ? "client1Beneficiaries" : "client2Beneficiaries";
            const nomKey = clientNum === 1 ? "client1NominationType" : "client2NominationType";
            return (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Client {clientNum}</h4>
                <div className="space-y-2">
                  {["No nomination", "Non-binding nomination", "Binding nomination", "Non-lapsing nomination"].map(t => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`nom_${clientNum}`} checked={data[nomKey] === t} onChange={() => updateData({ [nomKey]: t } as any)} />
                      {t}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-muted-foreground">
                  <span>Full Name</span><span>Gender</span><span>Relationship</span><span>Date of Birth</span><span>Benefit %</span>
                </div>
                {bens.map((b, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2">
                    <Input className="h-8 text-xs" value={b.fullName} onChange={e => { const arr = [...bens]; arr[i] = { ...b, fullName: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" value={b.gender} onChange={e => { const arr = [...bens]; arr[i] = { ...b, gender: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" value={b.relationship} onChange={e => { const arr = [...bens]; arr[i] = { ...b, relationship: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" value={b.dob} onChange={e => { const arr = [...bens]; arr[i] = { ...b, dob: e.target.value }; updateData({ [key]: arr } as any); }} />
                    <Input className="h-8 text-xs" value={b.benefitPct} onChange={e => { const arr = [...bens]; arr[i] = { ...b, benefitPct: e.target.value }; updateData({ [key]: arr } as any); }} placeholder="%" />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateData({ [key]: [...bens, { fullName: "", gender: "", relationship: "", dob: "", benefitPct: "" }] } as any)}>+ Add Beneficiary</Button>
              </div>
            );
          };

          return (
            <div className="space-y-6">
              <h3 className="font-semibold">Nomination of Beneficiaries</h3>
              {renderBeneficiaries(data.client1Beneficiaries, 1)}
              <div className="border-t pt-4" />
              {renderBeneficiaries(data.client2Beneficiaries, 2)}
              <div>
                <Label className="text-xs text-muted-foreground">Additional notes</Label>
                <Textarea value={data.beneficiaryNotes} onChange={e => updateData({ beneficiaryNotes: e.target.value })} className="text-sm" rows={3} />
              </div>
            </div>
          );
        }

      case 19: // Acknowledgements
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Acknowledgements</h3>
            <DualField label="Financial Services Guide provided date" v1={data.client1FSGDate} v2={data.client2FSGDate} onChange1={v => updateData({ client1FSGDate: v })} onChange2={v => updateData({ client2FSGDate: v })} />
            <Field label="Date of Financial Services Guide" value={data.fsgDocumentDate} onChange={v => updateData({ fsgDocumentDate: v })} />
            <Field label="SOA preparation fee ($)" value={data.soaFee} onChange={v => updateData({ soaFee: v })} />

            <div className="p-4 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-3">
              <p className="font-semibold">Client Declaration</p>
              <p>I declare that the information provided in this fact find is complete and accurate to the best of my knowledge. I understand that if I do not fully or accurately complete the fact find, then any recommendation or advice given may be inappropriate to my needs.</p>
              <p className="font-semibold">Privacy</p>
              <p>I understand that personal information will be used for the purpose of providing financial advice and handled in accordance with the Privacy Policy.</p>
              <p className="font-semibold">Tax File Number Authority</p>
              <p>I agree to the collection and retention of my Tax File Number (TFN). I understand it will be used in connection with providing financial product and strategy recommendations.</p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={data.client1NoContact} onCheckedChange={v => updateData({ client1NoContact: !!v })} />
                Client 1 - No call/no contact
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={data.client2NoContact} onCheckedChange={v => updateData({ client2NoContact: !!v })} />
                Client 2 - No call/no contact
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  /* ─── Main Form View ─── */
  return (
    <CRMLayout>
      <div className="flex h-full">
        {/* Section Nav */}
        <div className="w-64 border-r bg-muted/30 overflow-y-auto flex-shrink-0">
          <div className="p-4">
            <Button variant="ghost" size="sm" className="mb-4 text-xs" onClick={() => setSelectedClient(null)}>
              <ArrowLeft className="w-3 h-3 mr-1" /> Back to Clients
            </Button>
            <div className="space-y-1">
              {SECTIONS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setActiveSection(i)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeSection === i
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Fact Find — {data.client1Name || "Client"}</h2>
              <p className="text-xs text-muted-foreground">{SECTIONS[activeSection]}</p>
            </div>
            <div className="flex gap-2">
              {activeSection > 0 && (
                <Button variant="outline" size="sm" onClick={() => setActiveSection(prev => prev - 1)}>
                  Previous
                </Button>
              )}
              {activeSection < SECTIONS.length - 1 && (
                <Button variant="outline" size="sm" onClick={() => setActiveSection(prev => prev + 1)}>
                  Next
                </Button>
              )}
              <Button size="sm" onClick={exportPDF} disabled={exporting} className="gap-1">
                <Download className="w-3.5 h-3.5" />
                {exporting ? "Exporting..." : "Download PDF"}
              </Button>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-6 max-w-3xl">
            {renderSection()}
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
