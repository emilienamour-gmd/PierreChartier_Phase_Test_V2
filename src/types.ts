# Je vais créer les fichiers modifiés pour toi

# 1. Modification de types.ts (ajouter uplift à ProjectData)
types_ts = """// src/types.ts

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
  history: ProjectSnapshot[];
  createdAt?: string;
  updatedAt?: string;
  
  // 🆕 NOUVEAU : Sauvegarde de la position du slider de marge
  uplift?: number;
}

export const DEFAULT_PROJECT: ProjectData = {
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
  uplift: 3.0, // 🆕 Valeur par défaut du slider
};
"""

with open("types.ts", "w", encoding="utf-8") as f:
    f.write(types_ts)

print("✅ types.ts modifié avec succès!")
print("\n📝 Changements apportés:")
print("  - Ajout de 'uplift?: number;' dans ProjectData")
print("  - Ajout de 'uplift: 3.0' dans DEFAULT_PROJECT")
