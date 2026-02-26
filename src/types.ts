code = '''export interface LineItem {
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
  action: "SAVE" | "MARGIN_UP" | "MARGIN_DOWN" | "OPTIMIZATION";
  note?: string;
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
};
'''

with open('/mnt/data/types.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("✅ Fichier types.ts créé (sans commentaires)")
print(f"📏 Nombre de lignes : {len(code.splitlines())}")
print("\n📝 Contenu :\n")
print(code)
