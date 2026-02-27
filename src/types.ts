export interface LineItem {
  id: string;
  name: string;
  spend: number;
  cpmRevenue: number;
  marginPct: number;
  kpiActual: number;
}

// --- CORRECTION ICI ---
// On remplace 'text' par 'content' et 'date' par 'timestamp'
// pour correspondre à ton code dans CockpitYield.tsx
export interface ProjectNote {
  id: string;
  content: string; 
  timestamp: string; // Si tu utilises Date.now(), change "string" par "number" ici
}

export interface ProjectSnapshot {
  timestamp: string;
  budgetSpent: number;
  marginPct: number;
  cpmCostActuel: number;
  cpmRevenueActual: number;
  actualKpi: number;
  gainRealized: number;
  action: "SAVE" | "MARGIN_UP" | "MARGIN_DOWN" | "OPTIMIZATION";
  note?: string;
}

export interface MarginPeriod {
  startDate: string;
  marginPct: number;
  budgetSpentAtStart: number;
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
  // Le champ notes utilise maintenant la bonne interface
  notes?: ProjectNote[];
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
};
