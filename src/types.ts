export interface LineItem {
  id: string;
  name: string;
  spend: number;
  cpmRevenue: number;
  marginPct: number;
  kpiActual: number;
  
  allocationScore?: number;
  capAlignmentBonus?: number;
  perfRatio?: number;
  newCpmRevenue?: number;
  newMargin?: number;
}

export interface ProjectNote {
  id: string;
  content: string; 
  timestamp: string;
}

export interface ProjectSnapshot {
  timestamp: string;
  budgetSpent: number;
  marginPct: number;
  cpmCostActuel: number;
  cpmRevenueActual: number;
  actualKpi: number;
  gainRealized: number;
  action: "SAVE" | "MARGIN_UP" | "MARGIN_DOWN" | "OPTIMIZATION" | "DAILY_UPDATE";
  note?: string;
}

export interface MarginPeriod {
  startDate: string;
  marginPct: number;
  budgetSpentAtStart: number;
}

// ✅ NOUVELLE INTERFACE : Suivi quotidien
export interface DailyEntry {
  id: string;
  date: string; // Format ISO : "2026-02-27"
  budgetSpentYesterday: number; // Budget dépensé la veille
  cpmRevenueYesterday: number; // CPM Revenue moyen sur la veille
  marginPctYesterday: number; // Marge % moyenne sur la veille
  kpiYesterday: number; // KPI réalisé la veille
  budgetSpentCumulative: number; // Budget cumulé jusqu'à ce jour
  appliedAt: string; // Timestamp d'application
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
  inputMode: "CPM Cost" | "Marge %";
  kpiType: string;
  targetKpi: number;
  actualKpi: number;
  lineItems: LineItem[];
  history: ProjectSnapshot[];
  createdAt?: string;
  updatedAt?: string;
  lastModified: number;
  uplift?: number;
  marginPeriods?: MarginPeriod[];
  notes?: ProjectNote[];
  dailyEntries?: DailyEntry[]; // ✅ NOUVEAU : Suivi quotidien
}

export const DEFAULT_PROJECT: ProjectData = {
  id: "",
  name: "Nouveau Projet",
  currency: "EUR",
  budgetTotal: 0,
  budgetSpent: 0,
  durationDays: 30,
  cpmSoldCap: 0,
  cpmRevenueActual: 0,
  cpmCostActuel: 0,
  margeInput: 0,
  inputMode: "CPM Cost",
  kpiType: "CPC",
  targetKpi: 0,
  actualKpi: 0,
  lineItems: [],
  history: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastModified: 0,
  uplift: 3.0,
  marginPeriods: [],
  notes: [],
  dailyEntries: [], // ✅ NOUVEAU
};
