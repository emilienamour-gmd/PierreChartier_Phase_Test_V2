export interface LineItem {
  id: string;
  name: string;
  spend: number;
  cpmRevenue: number;
  marginPct: number;
  kpiActual: number;
}

export interface ProjectSnapshot {
  timestamp: string;
  budgetSpent: number;
  marginPct: number;
  cpmCostActuel: number;
  cpmRevenueActual: number;
  actualKpi: number;
  gainRealized: number;
  action: "MARGIN_UP" | "MARGIN_DOWN" | "OPTIMIZATION" | "SNAPSHOT" | "DAILY_UPDATE";
  note?: string;
}

export interface MarginPeriod {
  startDate: string;
  marginPct: number;
  budgetSpentAtStart: number;
}

export interface ProjectNote {
  id: string;
  timestamp: string;
  content: string;
}

export interface DailyEntry {
  id: string;
  date: string;
  budgetSpentYesterday: number;
  cpmRevenueYesterday: number;
  marginPctYesterday: number;
  kpiYesterday: number;
  budgetSpentCumulative: number;
  appliedAt: string;
}

export interface ProjectData {
  id: string;
  name: string;
  currency: string;
  budgetTotal: number;
  budgetSpent: number;
  durationDays: number;
  cpmSoldCap: number;
  cpmRevenueActual: number;
  cpmCostActuel: number;
  margeInput: number;
  kpiType: string;
  targetKpi: number;
  actualKpi: number;
  inputMode: "CPM Cost" | "Marge %";
  lineItems: LineItem[];
  history?: ProjectSnapshot[];
  marginPeriods?: MarginPeriod[];
  notes?: ProjectNote[];
  dailyEntries?: DailyEntry[];
  uplift?: number;
  updatedAt?: string;
}

// ✅ DEFAULT_PROJECT : TOUS LES CHAMPS À ZÉRO
export const DEFAULT_PROJECT: ProjectData = {
  id: "",
  name: "Nouvelle Campagne",
  currency: "€ (EUR)",
  budgetTotal: 0,           // ← ZÉRO
  budgetSpent: 0,           // ← ZÉRO
  durationDays: 30,         // ← 30 jours par défaut
  cpmSoldCap: 0,            // ← ZÉRO
  cpmRevenueActual: 0,      // ← ZÉRO
  cpmCostActuel: 0,         // ← ZÉRO
  margeInput: 0,            // ← ZÉRO
  kpiType: "CPA",
  targetKpi: 0,             // ← ZÉRO
  actualKpi: 0,             // ← ZÉRO
  inputMode: "Marge %",
  lineItems: [],            // ← VIDE
  history: [],              // ← VIDE
  marginPeriods: [],        // ← VIDE
  notes: [],                // ← VIDE
  dailyEntries: [],         // ← VIDE
  uplift: 3.0,
  updatedAt: new Date().toISOString()
};
