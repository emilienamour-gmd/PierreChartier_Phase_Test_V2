// types.ts - Interfaces TypeScript pour l'application

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
  action: "MARGIN_UP" | "MARGIN_DOWN" | "OPTIMIZATION" | "DAILY_UPDATE" | "MANUAL";
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

// 🆕 NOUVELLE INTERFACE : Entrée quotidienne pour le suivi campagne
export interface DailyEntry {
  date: string; // Format ISO "YYYY-MM-DD"
  budgetSpent: number; // Budget dépensé ce jour-là
  cpmRevenue: number; // CPM Revenu du jour
  marginPct: number; // Marge % du jour
  kpiActual: number; // KPI actuel du jour
  impressions?: number; // Impressions (optionnel)
  clicks?: number; // Clics (optionnel)
  conversions?: number; // Conversions (optionnel)
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
  kpiType: string;
  targetKpi: number;
  actualKpi: number;
  inputMode: "CPM Cost" | "Marge %";
  margeInput: number;
  uplift: number;
  lineItems: LineItem[];
  history?: ProjectSnapshot[];
  marginPeriods?: MarginPeriod[];
  notes?: ProjectNote[];
  dailyEntries?: DailyEntry[]; // 🆕 Ajout du suivi quotidien
  createdAt?: string;
  updatedAt?: string;
  lastModified?: number;
}

export const DEFAULT_PROJECT: ProjectData = {
  id: "",
  name: "Nouveau Projet",
  currency: "€ (EUR)",
  budgetTotal: 50000,
  budgetSpent: 0,
  durationDays: 30,
  cpmSoldCap: 8.0,
  cpmRevenueActual: 8.0,
  cpmCostActuel: 6.4,
  kpiType: "CPC",
  targetKpi: 0.5,
  actualKpi: 0.45,
  inputMode: "Marge %",
  margeInput: 20,
  uplift: 3.0,
  lineItems: [],
  history: [],
  marginPeriods: [],
  notes: [],
  dailyEntries: [], // 🆕 Initialisation vide
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
