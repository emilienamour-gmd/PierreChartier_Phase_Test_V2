export interface LineItem {
  id: string;
  name: string;
  spend: number;
  cpmRevenue: number;
  marginPct: number;
  kpiActual: number;
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
  inputMode: "CPM Cost" | "Marge %";
  cpmCostActuel: number;
  margeInput: number;
  kpiType: string;
  targetKpi: number;
  actualKpi: number;
  lineItems: LineItem[];
  lastModified: number;
}

export const DEFAULT_PROJECT: ProjectData = {
  id: "",
  name: "Nouveau Projet",
  currency: "€ (EUR)",
  budgetTotal: 0,
  budgetSpent: 0,
  durationDays: 30,
  cpmSoldCap: 0,
  cpmRevenueActual: 0,
  inputMode: "CPM Cost",
  cpmCostActuel: 0,
  margeInput: 0,
  kpiType: "CPM",
  targetKpi: 0,
  actualKpi: 0,
  lineItems: [
    { id: "1", name: "LI - Retargeting", spend: 200, cpmRevenue: 0, marginPct: 50, kpiActual: 0 },
    { id: "2", name: "LI - Prospecting", spend: 500, cpmRevenue: 0, marginPct: 25, kpiActual: 0 },
    { id: "3", name: "LI - Mobile", spend: 100, cpmRevenue: 0, marginPct: 35, kpiActual: 0 },
  ],
  lastModified: Date.now(),
};
