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
  title: string;          // ✅ AJOUTÉ
  content: string;
  createdAt: string;      // ✅ AJOUTÉ
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
  budgetTotal: number;
  budgetSpent: number;
  durationDays: number;
  currency: string;
  cpmSoldCap: number;
  cpmRevenueActual: number;
  cpmCostActuel: number;
  margeInput: number;
  targetKpi: number;
  actualKpi: number;
  kpiType: string;
  inputMode: "CPM Cost" | "Marge %";
  uplift?: number;
  lineItems: LineItem[];
  history?: ProjectSnapshot[];
  marginPeriods?: MarginPeriod[];
  notes?: ProjectNote[];
  dailyEntries?: DailyEntry[];
  updatedAt?: string;
}
