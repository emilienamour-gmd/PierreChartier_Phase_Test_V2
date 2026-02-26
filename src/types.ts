// src/types.ts

export interface LineItem {
  id: string;
  name: string;
  spend: number;
  cpmRevenue: number;
  marginPct: number;
  kpiActual: number;
}

// NOUVEAU : Snapshot d'historique
export interface ProjectSnapshot {
  timestamp: string; // ISO date
  budgetSpent: number;
  marginPct: number;
  cpmCostActuel: number;
  cpmRevenueActual: number;
  actualKpi: number;
  gainRealized: number;
  action: "SAVE" | "MARGIN_UP" | "MARGIN_DOWN" | "OPTIMIZATION";
  note?: string;
}

export interface ProjectData {
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
  
  // NOUVEAU : Historique
  history: ProjectSnapshot[];
  createdAt?: string;
  updatedAt?: string;
}
