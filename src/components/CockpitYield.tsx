import { useState, ChangeEvent, useEffect } from "react";
import { ProjectData, LineItem, ProjectSnapshot, MarginPeriod, ProjectNote } from "../types";
import { cn } from "../utils/cn";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Settings, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Trash2, DollarSign, Percent, Target, ChevronLeft, ChevronRight, Upload, Wand2, ArrowRight, Lock, Unlock, Clock, MousePointer2, Activity, BarChart3 } from "lucide-react";
import * as XLSX from "xlsx";

interface CockpitYieldProps {
  project: ProjectData;
  onChange: (project: ProjectData) => void;
}

interface OptimizationItem extends LineItem {
  perfRatio?: number;
  perfCategory?: "dead" | "underperforming" | "ok" | "good" | "star";
  newMargin?: number;
  newCpmRevenue?: number;
  allocationScore?: number;
  capAlignmentBonus?: number;
  action?: string;
}

export function CockpitYield({ project, onChange }: CockpitYieldProps) {
  const [activeTab, setActiveTab] = useState<"analyse" | "comparateur" | "multilines" | "historique" | "notes">("analyse");
  const [dashSource, setDashSource] = useState<"sidebar" | "table">("sidebar");
  const [uplift, setUplift] = useState(project.uplift ?? 3.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [proposedOptimizations, setProposedOptimizations] = useState<OptimizationItem[] | null>(null);
  const [marginGoal, setMarginGoal] = useState<"increase" | "decrease" | null>(null);
  const [respectCpmCap, setRespectCpmCap] = useState<boolean>(true);
  const [lockedLines, setLockedLines] = useState<Set<string>>(new Set());
  const [attrClick, setAttrClick] = useState(7);
  const [attrView, setAttrView] = useState(1);

  useEffect(() => {
    // 🔥 NOUVEAU : Caler le slider sur la dernière marge des dailyEntries
    if (project.dailyEntries && project.dailyEntries.length > 0) {
      // Calculer la marge actuelle du projet
      let projectCurrentMargin = 0;
      if (project.inputMode === "CPM Cost") {
        if (project.cpmRevenueActual > 0) {
          projectCurrentMargin = ((project.cpmRevenueActual - project.cpmCostActuel) / project.cpmRevenueActual) * 100;
        }
      } else {
        projectCurrentMargin = project.margeInput;
      }
      
      // Trier par date décroissante et prendre la plus récente
      const sortedEntries = [...project.dailyEntries].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const lastEntry = sortedEntries[0];
      const lastMargin = lastEntry.marginPct || projectCurrentMargin;
      
      // Calculer l'uplift par rapport à la marge actuelle
      const calculatedUplift = lastMargin - projectCurrentMargin;
      setUplift(calculatedUplift);
    } else {
      // Sinon, utiliser project.uplift ou 3.0 par défaut
      setUplift(project.uplift ?? 3.0);
    }
  }, [project.id, project.dailyEntries, project.inputMode, project.cpmRevenueActual, project.cpmCostActuel, project.margeInput]);

  useEffect(() => {
    if (!project.updatedAt || project.budgetTotal === 0 || project.durationDays === 0) return;
    
    const lastUpdate = new Date(project.updatedAt);
    const now = new Date();
    const daysElapsed = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysElapsed > 0 && project.budgetSpent < project.budgetTotal) {
      const dailyBudget = project.budgetTotal / project.durationDays;
      const actualDailySpend = dailyBudget * 1.10;
      const additionalSpend = actualDailySpend * daysElapsed;
      const newBudgetSpent = Math.min(project.budgetTotal, project.budgetSpent + additionalSpend);
      
      if (newBudgetSpent > project.budgetSpent) {
        updateField("budgetSpent", newBudgetSpent);
      }
    }
  }, [project.id]);

  const toggleLock = (id: string) => {
    const newLocked = new Set(lockedLines);
    if (newLocked.has(id)) newLocked.delete(id);
    else newLocked.add(id);
    setLockedLines(newLocked);
  };

  const currSym = project.currency.includes("EUR") ? "€" : "$";

  const updateField = <K extends keyof ProjectData>(field: K, value: ProjectData[K]) => {
    onChange({ ...project, [field]: value, updatedAt: new Date().toISOString() });
  };

  const updateUplift = (newUplift: number) => {
    setUplift(newUplift);
    updateField("uplift", newUplift);
  };

  const createSnapshot = (action: ProjectSnapshot["action"], note?: string): ProjectSnapshot => {
    const marginPct = project.inputMode === "CPM Cost" 
      ? ((project.cpmRevenueActual - project.cpmCostActuel) / project.cpmRevenueActual) * 100
      : project.margeInput;
    
    const cpmCost = project.inputMode === "CPM Cost" 
      ? project.cpmCostActuel 
      : project.cpmRevenueActual * (1 - project.margeInput / 100);
    
    const gainRealized = project.budgetSpent * (marginPct / 100);
    
    return {
      timestamp: new Date().toISOString(),
      budgetSpent: project.budgetSpent,
      marginPct,
      cpmCostActuel: cpmCost,
      cpmRevenueActual: project.cpmRevenueActual,
      actualKpi: project.actualKpi,
      gainRealized,
      action,
      note
    };
  };

  const handleDeleteHistoryEntry = (index: number) => {
    if (!confirm("⚠️ Supprimer cette entrée de l'historique ? Cette action est irréversible.")) {
      return;
    }

    const entryToDelete = project.history?.[index];
    if (!entryToDelete) return;

    const newHistory = [...(project.history || [])];
    newHistory.splice(index, 1);

    let updatedProject = { ...project, history: newHistory };

    if (entryToDelete.action === "DAILY_UPDATE" && entryToDelete.note) {
      const dateMatch = entryToDelete.note.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        const [day, month, year] = dateMatch[1].split('/');
        const dateToDelete = `${year}-${month}-${day}`;
        
        const newDailyEntries = (project.dailyEntries || []).filter(
          entry => entry.date !== dateToDelete
        );
        
        updatedProject.dailyEntries = newDailyEntries;
        
        const newBudgetSpent = newDailyEntries.reduce((sum, e) => sum + e.budgetSpent, 0);
        updatedProject.budgetSpent = newBudgetSpent;
      }
    }

    if (entryToDelete.action === "MARGIN_UP" || entryToDelete.action === "MARGIN_DOWN") {
      const newMarginPeriods = (project.marginPeriods || []).filter(
        period => Math.abs(new Date(period.startDate).getTime() - new Date(entryToDelete.timestamp).getTime()) > 5000
      );
      
      updatedProject.marginPeriods = newMarginPeriods;
      
      if (newMarginPeriods.length > 0) {
        const lastPeriod = newMarginPeriods[newMarginPeriods.length - 1];
        updatedProject.margeInput = lastPeriod.marginPct;
      }
    }

    updatedProject.updatedAt = new Date().toISOString();
    onChange(updatedProject);
    
    alert("✅ Entrée supprimée avec succès !");
  };

  const applyMarginChange = () => {
    if (uplift === 0) {
      alert("Aucun changement de marge à appliquer.");
      return;
    }
    
    const newMarginPct = currentMarginPctCalc + uplift;
    
    const action: "MARGIN_UP" | "MARGIN_DOWN" = uplift > 0 ? "MARGIN_UP" : "MARGIN_DOWN";
    const note = uplift > 0 
      ? `Augmentation de marge : +${uplift.toFixed(1)} points (nouvelle marge : ${newMarginPct.toFixed(2)}%)` 
      : `Baisse de marge : ${uplift.toFixed(1)} points (nouvelle marge : ${newMarginPct.toFixed(2)}%)`;
    
    const snapshot: ProjectSnapshot = {
      timestamp: new Date().toISOString(),
      budgetSpent: project.budgetSpent,
      marginPct: newMarginPct,
      cpmCostActuel: project.inputMode === "CPM Cost" 
        ? project.cpmCostActuel 
        : project.cpmRevenueActual * (1 - newMarginPct / 100),
      cpmRevenueActual: project.cpmRevenueActual,
      actualKpi: project.actualKpi,
      gainRealized: project.budgetSpent * (newMarginPct / 100),
      action: action,
      note: note
    };
    
    const newPeriod: MarginPeriod = {
      startDate: new Date().toISOString(),
      marginPct: newMarginPct,
      budgetSpentAtStart: project.budgetSpent
    };
    
    const newHistory = [...(project.history || []), snapshot];
    const newMarginPeriods = [...(project.marginPeriods || []), newPeriod];
    
    onChange({
      ...project,
      history: newHistory,
      marginPeriods: newMarginPeriods,
      margeInput: newMarginPct,
      updatedAt: new Date().toISOString()
    });
    
    alert(`✅ Changement de marge enregistré !`);
  };

  const budgetRemaining = project.budgetTotal - project.budgetSpent;
  const pctProgress = project.budgetTotal > 0 ? project.budgetSpent / project.budgetTotal : 0;
  const currentDay = Math.floor(project.durationDays * pctProgress);

  let cpmCostActuelCalc = 0;
  let currentMarginPctCalc = 0;

  if (project.inputMode === "CPM Cost") {
    cpmCostActuelCalc = project.cpmCostActuel;
    if (project.cpmRevenueActual > 0) {
      currentMarginPctCalc = ((project.cpmRevenueActual - cpmCostActuelCalc) / project.cpmRevenueActual) * 100;
    }
  } else {
    currentMarginPctCalc = project.margeInput;
    cpmCostActuelCalc = project.cpmRevenueActual * (1 - project.margeInput / 100);
  }

  const calculateWeightedMargin = (): number => {
    if (!project.marginPeriods || project.marginPeriods.length === 0) {
      return currentMarginPctCalc;
    }
    
    let totalGain = 0;
    let totalSpent = 0;
    
    for (let i = 0; i < project.marginPeriods.length; i++) {
      const period = project.marginPeriods[i];
      const nextPeriod = project.marginPeriods[i + 1];
      
      const budgetInPeriod = nextPeriod 
        ? nextPeriod.budgetSpentAtStart - period.budgetSpentAtStart
        : project.budgetSpent - period.budgetSpentAtStart;
      
      const gainInPeriod = budgetInPeriod * (period.marginPct / 100);
      
      totalGain += gainInPeriod;
      totalSpent += budgetInPeriod;
    }
    
    return totalSpent > 0 ? (totalGain / totalSpent) * 100 : currentMarginPctCalc;
  };

  const displayMargin = calculateWeightedMargin();

  // 🔥 NOUVELLE FONCTION : Calcul des MOYENNES depuis dailyEntries
  const calculateDailyAverages = () => {
    if (!project.dailyEntries || project.dailyEntries.length === 0) {
      // Si pas d'entrées quotidiennes, retourner les valeurs actuelles
      return {
        avgCpmCost: cpmCostActuelCalc,
        avgCpmRevenue: project.cpmRevenueActual,
        avgMargin: currentMarginPctCalc,
        avgKpi: project.actualKpi
      };
    }

    let totalSpent = 0;
    let totalCost = 0;
    let totalRevenue = 0;
    let totalGain = 0;
    let totalKpiWeighted = 0;

    project.dailyEntries.forEach(entry => {
      const spent = entry.budgetSpent || 0;
      const margin = entry.marginPct || 0;
      const revenue = entry.cpmRevenue || 0;
      const cost = revenue * (1 - margin / 100);
      const kpi = entry.kpiActual || 0;

      totalSpent += spent;
      totalCost += cost * spent;        // ✅ CORRECT : Σ(CPM Cost × Budget)
      totalRevenue += revenue * spent;  // ✅ CORRECT : Σ(CPM Revenue × Budget)
      totalGain += spent * (margin / 100);
      totalKpiWeighted += spent * kpi;
    });

    // ✅ MOYENNES PONDÉRÉES CORRECTES : Σ(CPM × Budget) / Σ(Budget)
    const avgCpmCost = totalSpent > 0 ? totalCost / totalSpent : cpmCostActuelCalc;
    const avgCpmRevenue = project.dailyEntries.reduce((sum, e) => sum + (e.cpmRevenue || 0), 0) / project.dailyEntries.length;
    const avgMargin = totalSpent > 0 ? (totalGain / totalSpent) * 100 : currentMarginPctCalc;
    const avgKpi = totalSpent > 0 ? totalKpiWeighted / totalSpent : project.actualKpi;

    return {
      avgCpmCost,
      avgCpmRevenue,
      avgMargin,
      avgKpi
    };
  };

  const dailyAverages = calculateDailyAverages();

  const totalSpendTable = project.lineItems.reduce((acc, li) => acc + (li.spend || 0), 0);
  let wMargin = currentMarginPctCalc;
  let wCpmRev = project.cpmRevenueActual;
  let wCpmCost = cpmCostActuelCalc;
  let wKpi = project.actualKpi;

  if (totalSpendTable > 0) {
    wMargin = project.lineItems.reduce((acc, li) => acc + ((li.spend || 0) * li.marginPct), 0) / totalSpendTable;
    const totalImpTable = project.lineItems.reduce((acc, li) => acc + (li.cpmRevenue > 0 ? (li.spend || 0) / li.cpmRevenue : 0), 0);
    if (totalImpTable > 0) {
      wCpmRev = totalSpendTable / totalImpTable;
      const totalCostTable = project.lineItems.reduce((acc, li) => acc + ((li.spend || 0) * (1 - li.marginPct / 100)), 0);
      wCpmCost = totalCostTable / totalImpTable;
    }
    wKpi = project.lineItems.reduce((acc, li) => acc + ((li.spend || 0) * li.kpiActual), 0) / totalSpendTable;
  }

  // 🔥 UTILISER LES MOYENNES QUOTIDIENNES pour l'affichage
  const dispCpmCost = dashSource === "sidebar" ? dailyAverages.avgCpmCost : wCpmCost;
  const dispCpmRev = dashSource === "sidebar" ? dailyAverages.avgCpmRevenue : wCpmRev;
  const dispMargin = dashSource === "sidebar" ? dailyAverages.avgMargin : wMargin;
  const dispKpi = dashSource === "sidebar" ? dailyAverages.avgKpi : wKpi;

  const isFin = !["Viewability", "VTR", "CTR"].includes(project.kpiType);
  const margeEuroDisp = dispCpmRev - dispCpmCost;

  const gainRealized = project.budgetSpent * (currentMarginPctCalc / 100);
  const gainRemaining = budgetRemaining * (currentMarginPctCalc / 100);

  const fmtKpi = (val: number) => project.kpiType.includes("CPCV") ? val.toFixed(3) : val.toFixed(2);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const newItems: LineItem[] = data.map((row: any, idx) => ({
        id: Date.now().toString() + idx,
        name: row["Line Item"] || row["Name"] || `Line ${idx + 1}`,
        spend: Number(row["Spend"] || row["Dépense"] || 0),
        cpmRevenue: Number(row["CPM Revenue"] || row["CPM"] || project.cpmRevenueActual),
        marginPct: Number(row["Margin"] || row["Marge"] || currentMarginPctCalc),
        kpiActual: Number(row["KPI"] || row["Performance"] || project.actualKpi),
      }));

      if (newItems.length > 0) {
        updateField("lineItems", newItems);
      }
    };
    reader.readAsBinaryString(file);
  };
  const handleOptimize = () => {
    if (!marginGoal) {
      alert("Veuillez sélectionner un objectif (Augmenter ou Baisser la marge) avant d'optimiser.");
      return;
    }

    const isFin = !["Viewability", "VTR", "CTR"].includes(project.kpiType);
    
    const lockedSpend = project.lineItems.filter(li => lockedLines.has(li.id)).reduce((acc, li) => acc + (li.spend || 0), 0);
    const totalSpend = project.lineItems.reduce((acc, li) => acc + (li.spend || 0), 0);
    const availableSpend = Math.max(0, totalSpend - lockedSpend);
    
    const analyzedItems: OptimizationItem[] = project.lineItems.map(li => {
      const actual = li.kpiActual || 0;
      const target = project.targetKpi || 0.0001;
      
      let perfRatio = 1;
      let perfCategory: "dead" | "underperforming" | "ok" | "good" | "star" = "ok";
      
      if (isFin) {
        if (actual === 0) {
          perfRatio = 0;
          perfCategory = "dead";
        } else {
          perfRatio = target / actual;
          if (perfRatio >= 1.5) perfCategory = "star";
          else if (perfRatio >= 1.2) perfCategory = "good";
          else if (perfRatio >= 0.9) perfCategory = "ok";
          else if (perfRatio >= 0.7) perfCategory = "underperforming";
          else perfCategory = "dead";
        }
      } else {
        perfRatio = actual / target;
        if (perfRatio >= 1.3) perfCategory = "star";
        else if (perfRatio >= 1.1) perfCategory = "good";
        else if (perfRatio >= 0.9) perfCategory = "ok";
        else if (perfRatio >= 0.7) perfCategory = "underperforming";
        else perfCategory = "dead";
      }
      
      return { ...li, perfRatio, perfCategory };
    });
    
    let optimizedItems: OptimizationItem[] = analyzedItems.map(li => {
      let newMargin = li.marginPct;
      let newCpmRevenue = li.cpmRevenue;
      let action = "";
      
      if (lockedLines.has(li.id)) {
        return { ...li, newMargin, newCpmRevenue, action: "🔒 Verrouillée" };
      }
      
      switch (li.perfCategory) {
        case "dead":
          if (marginGoal === "increase") {
            newMargin = Math.min(95, li.marginPct + 15);
            newCpmRevenue = li.cpmRevenue * 0.8;
            action = "💀 Ligne morte → Couper";
          } else {
            newMargin = Math.max(5, li.marginPct - 10);
            newCpmRevenue = li.cpmRevenue * 0.7;
            action = "⚠️ Dernière chance → Test agressif";
          }
          break;
          
        case "underperforming":
          if (marginGoal === "increase") {
            newMargin = li.marginPct;
            newCpmRevenue = li.cpmRevenue * 0.95;
            action = "⚠️ Sous-perf → Prudence";
          } else {
            newMargin = Math.max(5, li.marginPct - 8);
            newCpmRevenue = li.cpmRevenue * 0.85;
            action = "📉 Boost KPI → Baisse agressive";
          }
          break;
          
        case "ok":
          if (marginGoal === "increase") {
            newMargin = li.marginPct + 3;
            newCpmRevenue = li.cpmRevenue * 1.02;
            action = "✓ OK → Optim modérée";
          } else {
            newMargin = Math.max(5, li.marginPct - 5);
            newCpmRevenue = li.cpmRevenue * 0.95;
            action = "📊 OK → Ajust équilibré";
          }
          break;
          
        case "good":
          if (marginGoal === "increase") {
            newMargin = li.marginPct + 6;
            newCpmRevenue = li.cpmRevenue * 1.05;
            action = "✅ Bonne → Exploiter";
          } else {
            newMargin = Math.max(10, li.marginPct - 3);
            newCpmRevenue = li.cpmRevenue * 0.98;
            action = "✅ Bonne → Maintenir";
          }
          break;
          
        case "star":
          if (marginGoal === "increase") {
            newMargin = li.marginPct + 10;
            newCpmRevenue = Math.min(
              respectCpmCap ? project.cpmSoldCap : li.cpmRevenue * 1.15,
              li.cpmRevenue * 1.1
            );
            action = "⭐ STAR → Maximiser !";
          } else {
            newMargin = li.marginPct;
            newCpmRevenue = li.cpmRevenue;
            action = "⭐ STAR → Parfait !";
          }
          break;
      }
      
      newMargin = Math.max(5, Math.min(95, newMargin));
      
      if (respectCpmCap) {
        newCpmRevenue = Math.min(project.cpmSoldCap, newCpmRevenue);
      }
      
      return { ...li, newMargin, newCpmRevenue, action };
    });
    
    const itemsWithScore: OptimizationItem[] = optimizedItems.map(item => {
      if (lockedLines.has(item.id)) {
        return { ...item, allocationScore: 0 };
      }
      
      let baseScore = 0;
      
      switch (item.perfCategory) {
        case "dead":
          baseScore = isFin ? 0.1 : 0.05;
          break;
        case "underperforming":
          baseScore = marginGoal === "increase" ? 0.3 : 0.6;
          break;
        case "ok":
          baseScore = 1.0;
          break;
        case "good":
          baseScore = marginGoal === "increase" ? 2.0 : 1.5;
          break;
        case "star":
          baseScore = marginGoal === "increase" ? 5.0 : 2.5;
          break;
      }
      
      let capBonus = 1.0;
      if (respectCpmCap) {
        const currentWeightedCpmRev = totalSpend > 0 
          ? project.lineItems.reduce((acc, l) => acc + (l.spend||0)*l.cpmRevenue, 0) / totalSpend
          : 0;
        
        const cpmRevRatio = (item.newCpmRevenue || item.cpmRevenue) / project.cpmSoldCap;
        
        if (currentWeightedCpmRev < project.cpmSoldCap) {
          capBonus = 0.8 + (cpmRevRatio * 0.4);
        } else {
          capBonus = 1.2 - (cpmRevRatio * 0.4);
        }
        
        capBonus = Math.max(0.5, Math.min(1.5, capBonus));
      }
      
      const marginFactor = marginGoal === "increase" 
        ? (1 + (item.newMargin || item.marginPct) / 100) 
        : (2 - (item.newMargin || item.marginPct) / 100);
      
      const allocationScore = baseScore * capBonus * marginFactor;
      
      return { ...item, allocationScore, capAlignmentBonus: capBonus };
    });
    
    const unlockedItems = itemsWithScore.filter(li => !lockedLines.has(li.id));
    const totalScore = unlockedItems.reduce((acc, li) => acc + (li.allocationScore || 0), 0);
    
    const finalItems: OptimizationItem[] = itemsWithScore.map(li => {
      let finalSpend = li.spend || 0;
      
      if (!lockedLines.has(li.id)) {
        const theoreticalSpend = totalScore > 0 
          ? ((li.allocationScore || 0) / totalScore) * availableSpend 
          : (li.spend || 0);
        
        finalSpend = (theoreticalSpend * 0.6) + ((li.spend || 0) * 0.4);
        
        const maxChange = (li.spend || 0) * 0.8;
        const minSpend = Math.max(0, (li.spend || 0) - maxChange);
        const maxSpend = (li.spend || 0) + maxChange;
        
        finalSpend = Math.max(minSpend, Math.min(maxSpend, finalSpend));
      }
      
      return {
        ...li,
        id: li.id,
        name: li.name,
        spend: Number(finalSpend.toFixed(2)),
        cpmRevenue: Number((li.newCpmRevenue || li.cpmRevenue).toFixed(2)),
        marginPct: Number((li.newMargin || li.marginPct).toFixed(2)),
        kpiActual: li.kpiActual,
        action: li.action,
        perfCategory: li.perfCategory,
        perfRatio: li.perfRatio
      };
    });
    
    setProposedOptimizations(finalItems);
  };

  const applyOptimizations = () => {
    if (proposedOptimizations) {
      const snapshot = createSnapshot(
        "OPTIMIZATION",
        `Optimisation multi-lines : ${marginGoal === "increase" ? "Augmentation" : "Baisse"} de marge`
      );
      
      const newHistory = [...(project.history || []), snapshot];
      
      onChange({
        ...project,
        lineItems: proposedOptimizations,
        history: newHistory,
        updatedAt: new Date().toISOString()
      });
      
      setProposedOptimizations(null);
      alert("Optimisations appliquées avec succès.");
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#f8f9fa] relative">
      {/* Parameters Sidebar */}
      <div className={cn(
        "bg-white border-r border-gray-200 overflow-y-auto shrink-0 transition-all duration-300 ease-in-out",
        isSidebarOpen ? "w-80 p-6" : "w-0 p-0 opacity-0"
      )}>
        <div className="w-64 space-y-8">
          <div className="flex items-center gap-3 text-gray-900 font-bold text-lg pb-4 border-b border-gray-100">
            <Settings className="w-5 h-5 text-blue-600" />
            Paramètres
          </div>
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="text-xs font-bold text-blue-900 mb-3 uppercase tracking-wider">
              Mode de Trading
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onChange({ ...project, inputMode: "CPM Cost" })}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                  project.inputMode === "CPM Cost"
                    ? "border-blue-600 bg-blue-100 text-blue-900 shadow-md"
                    : "border-blue-200 bg-white text-gray-600 hover:border-blue-400 hover:bg-blue-50"
                )}
              >
                <DollarSign className="w-5 h-5" />
                <span className="text-xs font-bold">Je trade en Cost</span>
              </button>
              
              <button
                onClick={() => onChange({ ...project, inputMode: "Marge %" })}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                  project.inputMode === "Marge %"
                    ? "border-emerald-600 bg-emerald-100 text-emerald-900 shadow-md"
                    : "border-emerald-200 bg-white text-gray-600 hover:border-emerald-400 hover:bg-emerald-50"
                )}
              >
                <Percent className="w-5 h-5" />
                <span className="text-xs font-bold">Je trade en Revenu</span>
              </button>
            </div>
          </div>

          {/* 1. Campagne */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">1. Campagne</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Devise</label>
              <select 
                className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={project.currency}
                onChange={(e) => updateField("currency", e.target.value)}
              >
                <option>€ (EUR)</option>
                <option>$ (USD)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                {project.inputMode === "CPM Cost" ? `Budget Total Rev (${currSym})` : `Budget Total (${currSym})`}
              </label>
              <input 
                type="number" 
                className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={project.budgetTotal}
                onChange={(e) => updateField("budgetTotal", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                {project.inputMode === "CPM Cost" ? `Budget Dépensé Rev (${currSym})` : `Budget Dépensé (${currSym})`}
              </label>
              <input 
                type="number" 
                step="0.01"
                className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={project.budgetSpent.toFixed(2)}
                onChange={(e) => updateField("budgetSpent", Number(e.target.value))}
              />
            </div>
            
            {project.inputMode === "CPM Cost" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                  Budget Dépensé Cost ({currSym})
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    className="w-full text-sm border-gray-200 bg-blue-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-bold text-blue-900"
                    value={(project.budgetSpent * (1 - currentMarginPctCalc / 100)).toFixed(2)}
                    readOnly
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded">
                    Auto
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 mt-1.5 italic">
                  = Budget Dépensé Rev × (1 - Marge {currentMarginPctCalc.toFixed(2)}%)
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Durée (Jours)</label>
              <input 
                type="range" 
                min="0" max="365"
                className="w-full accent-blue-600"
                value={project.durationDays}
                onChange={(e) => updateField("durationDays", Number(e.target.value))}
              />
              <div className="text-xs text-gray-500 mt-1 text-right font-medium">{project.durationDays} jours</div>
            </div>
            {project.durationDays > 0 && (
              <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pctProgress * 100}%` }}></div>
                <div className="text-[10px] text-gray-400 mt-1.5 text-right font-medium">Jour {currentDay}/{project.durationDays}</div>
              </div>
            )}
          </div>

          {/* 2. Finance */}
          <div className="space-y-4 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">2. Finance</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">CPM Vendu Cap ({currSym})</label>
              <input 
                type="number" step="0.1"
                className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={project.cpmSoldCap}
                onChange={(e) => updateField("cpmSoldCap", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">CPM Revenu Actuel ({currSym})</label>
              <input 
                type="number" step="0.1"
                className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={project.cpmRevenueActual}
                onChange={(e) => updateField("cpmRevenueActual", Number(e.target.value))}
              />
            </div>
          </div>

          {/* 3. Achat */}
          <div className="space-y-4 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">3. Achat</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">CPM Cost ({currSym})</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={
                    project.inputMode === "CPM Cost" 
                      ? project.cpmCostActuel.toFixed(2)
                      : cpmCostActuelCalc.toFixed(2)
                  }
                  onChange={(e) => {
                    const newCpmCost = Number(e.target.value);
                    
                    if (project.inputMode === "CPM Cost") {
                      onChange({
                        ...project,
                        cpmCostActuel: newCpmCost
                      });
                    } else {
                      const newMarge = project.cpmRevenueActual > 0 
                        ? ((project.cpmRevenueActual - newCpmCost) / project.cpmRevenueActual) * 100
                        : 0;
                      onChange({
                        ...project,
                        inputMode: "Marge %",
                        margeInput: newMarge
                      });
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Marge %</label>
                <input 
                  type="number" 
                  step="0.5"
                  className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={
                    project.inputMode === "Marge %" 
                      ? project.margeInput.toFixed(2)
                      : Math.round(currentMarginPctCalc)
                  }
                  onChange={(e) => {
                    const newMarge = Number(e.target.value);
                    
                    if (project.inputMode === "Marge %") {
                      onChange({
                        ...project,
                        margeInput: newMarge
                      });
                    } else {
                      const newCpmCost = project.cpmRevenueActual * (1 - newMarge / 100);
                      onChange({
                        ...project,
                        cpmCostActuel: newCpmCost
                      });
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* 4. KPI */}
          <div className="space-y-4 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">4. KPI Objectif</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Type de KPI</label>
              <select 
                className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={project.kpiType}
                onChange={(e) => updateField("kpiType", e.target.value)}
              >
                {["CPM", "CPC", "CPCV", "CPA", "CPV", "CTR", "Viewability", "VTR"].map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            {(project.kpiType === "CPA" || project.kpiType === "CPV" || project.kpiType === "CPL") && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 space-y-3">
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Fenêtres d'Attribution</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 font-bold flex items-center gap-1">
                      <MousePointer2 className="w-3 h-3"/> Post-Clic (J)
                    </label>
                    <input 
                      type="number" min="0" max="30"
                      className="w-full text-xs border-gray-200 bg-white rounded-md p-2 border outline-none"
                      value={attrClick}
                      onChange={(e) => setAttrClick(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3"/> Post-View (J)
                    </label>
                    <input 
                      type="number" min="0" max="30"
                      className="w-full text-xs border-gray-200 bg-white rounded-md p-2 border outline-none"
                      value={attrView}
                      onChange={(e) => setAttrView(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Objectif</label>
                <input 
                  type="number" step="0.01"
                  className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={project.targetKpi}
                  onChange={(e) => updateField("targetKpi", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Actuel</label>
                <input 
                  type="number" step="0.01"
                  className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={project.actualKpi}
                  onChange={(e) => updateField("actualKpi", Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 bg-white border border-gray-200 shadow-md rounded-r-xl p-1.5 z-10 hover:bg-gray-50 transition-all duration-300 ease-in-out",
          isSidebarOpen ? "left-80" : "left-0"
        )}
      >
        {isSidebarOpen ? <ChevronLeft className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>
      {/* Main Dashboard - SUITE DE LA PARTIE 2 */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Dashboard Yield</h2>
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
              <button 
                className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", dashSource === "sidebar" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700")}
                onClick={() => setDashSource("sidebar")}
              >
                Général
              </button>
              <button 
                className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", dashSource === "table" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700")}
                onClick={() => setDashSource("table")}
              >
                Moyennes Tableau
              </button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-4 gap-6">
            <MetricCard 
              title="CPM Cost Moyen (Net)" 
              value={`${dispCpmCost.toFixed(2)} ${currSym}`} 
              icon={DollarSign}
              accent="indigo"
            />
            <MetricCard 
              title="CPM Revenu Moyen" 
              value={`${dispCpmRev.toFixed(2)} ${currSym}`} 
              icon={TrendingUp}
              accent="indigo"
            />
            <MetricCard 
              title="Marge Moyenne" 
              value={`${dispMargin.toFixed(2)} %`}
              subValue={`${margeEuroDisp.toFixed(2)} ${currSym}`}
              icon={Percent}
              accent="emerald"
            />
            <MetricCard 
              title={`KPI ${project.kpiType} Moyen`} 
              value={isFin ? `${fmtKpi(dispKpi)} ${currSym}` : `${(dispKpi * (project.kpiType === "CTR" ? 1 : 100)).toFixed(2)} ${project.kpiType === "CTR" ? "%" : ""}`} 
              subValue={
                isFin 
                  ? (dispKpi <= project.targetKpi ? `✅ ${fmtKpi(project.targetKpi - dispKpi)} ${currSym} Avance` : `🔻 +${fmtKpi(dispKpi - project.targetKpi)} ${currSym} Retard`)
                  : (dispKpi >= project.targetKpi ? "✅ OK" : "🔻 KO")
              }
              icon={Target}
              accent={isFin ? (dispKpi <= project.targetKpi ? "emerald" : "red") : (dispKpi >= project.targetKpi ? "emerald" : "red")}
            />
          </div>

          {/* Tabs */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100 px-2 pt-2">
              {[
                { id: "analyse", label: "💰 Analyse" },
                { id: "comparateur", label: "🧮 Marge" },
                { id: "multilines", label: "🎛️ Optimisation Multi-Lines" },
                { id: "historique", label: "📜 Historique" },
                { id: "notes", label: "📝 Notes" }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={cn(
                    "px-6 py-4 text-sm font-medium transition-colors border-b-2 rounded-t-lg",
                    activeTab === t.id ? "border-blue-500 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-8">
              {activeTab === "analyse" && (
                <div className="space-y-4">
                  {isFin && project.actualKpi <= project.targetKpi ? (
                    <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-4 text-emerald-900">
                      <div className="bg-white p-2 rounded-full shadow-sm">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">CONFORT</h4>
                        <p className="text-emerald-700 mt-1">Marge de manœuvre disponible. Le KPI est atteint, vous pouvez optimiser la marge.</p>
                      </div>
                    </div>
                  ) : !isFin && project.actualKpi >= project.targetKpi ? (
                    <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-4 text-emerald-900">
                      <div className="bg-white p-2 rounded-full shadow-sm">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">CONFORT</h4>
                        <p className="text-emerald-700 mt-1">Qualité au top. Le KPI est atteint.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-4 text-red-900">
                      <div className="bg-white p-2 rounded-full shadow-sm">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">TENSION</h4>
                        <p className="text-red-700 mt-1">Optimisez la performance avant la marge. Le KPI n'est pas atteint.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "comparateur" && (
                <div className="space-y-8">
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Marge</label>
                      <span className={cn("font-bold px-3 py-1 rounded-full text-sm", uplift >= 0 ? "text-blue-600 bg-blue-100" : "text-red-600 bg-red-100")}>
                        {uplift > 0 ? "+" : ""}{uplift.toFixed(1)} Pts
                      </span>
                    </div>
                    <input 
                      type="range" min="-20" max="20" step="0.2"
                      className={cn("w-full", uplift >= 0 ? "accent-blue-600" : "accent-red-600")}
                      value={uplift}
                      onChange={(e) => updateUplift(Number(e.target.value))}
                    />

                    {(() => {
                      const newMargin = currentMarginPctCalc + uplift;
                      const tmcp = newMargin < 100 ? (newMargin / (100 - newMargin)) * 100 : 0;
                      const budgetRestant = project.budgetTotal - project.budgetSpent;
                      const costDejaDepense = project.budgetSpent * (1 - currentMarginPctCalc / 100);
                      let costDSP = 0;
                      let totalCostDSP = 0;

                      if (project.inputMode === "CPM Cost") {
                        if (uplift >= 0) {
                          costDSP = budgetRestant * (1 - newMargin / 100);
                          totalCostDSP = costDejaDepense + costDSP;
                        } else {
                          const costRestant = budgetRestant * (1 - newMargin / 100);
                          costDSP = costDejaDepense + costRestant;
                          totalCostDSP = costDSP;
                        }
                      }

                      return (
                        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                          <div>
                            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Nouvelle Marge Globale</div>
                            <div className="text-xl font-black text-gray-900">{newMargin.toFixed(2)} %</div>
                          </div>
                          <div className="text-gray-300 px-4">
                            <ArrowRight className="w-6 h-6" />
                          </div>
                          <div className="text-right">
                            {project.inputMode === "CPM Cost" ? (
                              <>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Cost dans le DSP</div>
                                <div className="text-xl font-black text-blue-600">{costDSP.toFixed(2)} {currSym}</div>
                                <div className="text-[10px] text-gray-400 mt-1">
                                  {uplift >= 0 ? "Budget restant seulement" : "Cost total (dépensé + restant)"}
                                </div>
                                {uplift > 0 && (
                                  <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                                    <div className="text-[10px] text-gray-500 font-bold uppercase">Total Budget à saisir</div>
                                    <div className="text-sm font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded inline-block mt-0.5">
                                      {totalCostDSP.toFixed(2)} {currSym}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Total Media Cost Plus</div>
                                <div className="text-xl font-black text-blue-600">{tmcp.toFixed(2)} %</div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 🎯 ALGORITHME ULTRA-EXPERT CORRECT V3 - OPTION 1 FOURCHETTE RÉDUITE */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 mt-6">
                      <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Impact sur le {project.kpiType} Objectif
                      </h4>
                      <p className="text-sm text-purple-700 mb-6">
                        Fourchette d'impact basée sur 20 ans d'expertise programmatique
                      </p>

                      {(() => {
                        const newMargin = currentMarginPctCalc + uplift;
                        const marginChangePct = Math.abs(uplift / currentMarginPctCalc);
                        const isFin = !["Viewability", "VTR", "CTR"].includes(project.kpiType);
                        const isIncreasingMargin = uplift > 0;
                        
                        // 🔥 FACTEUR ATTRIBUTION (CPA/CPV UNIQUEMENT)
                        const isAttributionKPI = project.kpiType === "CPA" || project.kpiType === "CPV";
                        const attributionFactor = isAttributionKPI 
                          ? (attrClick + attrView * 0.3) / 8
                          : 1.0;
                        
                        const isLongAttribution = attrClick > 14;
                        
                        // 🎯 COEFFICIENTS BASE PAR KPI
                        const getKPICoefficients = (kpiType: string) => {
                          const coeffs = {
                            CPCV: { 
                              marginImpact: 0.42,
                              volatility: 0.25,
                              competition: 0.35,
                              bidImpactFactor: 0.55
                            },
                            CPA: { 
                              marginImpact: 0.48,
                              volatility: 0.30,
                              competition: 0.40,
                              bidImpactFactor: 0.65
                            },
                            CPC: { 
                              marginImpact: 0.45,
                              volatility: 0.28,
                              competition: 0.38,
                              bidImpactFactor: 0.60
                            },
                            CPV: { 
                              marginImpact: 0.40,
                              volatility: 0.22,
                              competition: 0.32,
                              bidImpactFactor: 0.58
                            },
                            CPM: { 
                              marginImpact: 0.28,
                              volatility: 0.15,
                              competition: 0.22,
                              bidImpactFactor: 0.40
                            },
                            CTR: { 
                              marginImpact: 0.18,
                              volatility: 0.12,
                              competition: 0.15,
                              bidImpactFactor: 0.25
                            },
                            VTR: { 
                              marginImpact: 0.25,
                              volatility: 0.15,
                              competition: 0.20,
                              bidImpactFactor: 0.35
                            },
                            Viewability: { 
                              marginImpact: 0.12,
                              volatility: 0.08,
                              competition: 0.12,
                              bidImpactFactor: 0.20
                            }
                          };
                          return coeffs[kpiType as keyof typeof coeffs] || coeffs.CPA;
                        };
                        
                        const coeffs = getKPICoefficients(project.kpiType);
                        
                        // Appliquer facteur attribution
                        const finalMarginImpact = isAttributionKPI ? coeffs.marginImpact * attributionFactor : coeffs.marginImpact;
                        
                        // ⭐ OPTION 1 : BID STABLE
                        const option1_cpmCost = cpmCostActuelCalc;
                        const option1_cpmRevenue = option1_cpmCost / (1 - newMargin / 100);
                        
                        const option1_exceedsCap = option1_cpmRevenue > project.cpmSoldCap;
                        const option1_excessAmount = option1_exceedsCap ? option1_cpmRevenue - project.cpmSoldCap : 0;
                        const option1_excessPct = option1_exceedsCap ? (option1_excessAmount / project.cpmSoldCap) * 100 : 0;
                        
                        // ⭐ OPTION 2 : BID AJUSTÉ
                        let option2_cpmCost = cpmCostActuelCalc;
                        let option2_cpmRevenue = option1_cpmRevenue;
                        let option2_bidAdjustmentPct = 0;
                        let option2_explanation = "";
                        let option2_respectsCap = false;
                        
                        if (isIncreasingMargin) {
                          // Montée marge → Baisser bid pour respecter Cap
                          option2_cpmCost = project.cpmSoldCap * (1 - newMargin / 100);
                          option2_cpmRevenue = project.cpmSoldCap;
                          option2_bidAdjustmentPct = ((option2_cpmCost - cpmCostActuelCalc) / cpmCostActuelCalc) * 100;
                          option2_respectsCap = true;
                          
                          option2_explanation = `Pour respecter le CPM Vendu Cap (${project.cpmSoldCap.toFixed(2)} ${currSym}), ${option2_bidAdjustmentPct < 0 ? 'baissez' : 'ajustez'} votre bid à ${option2_cpmCost.toFixed(2)} ${currSym} (${option2_bidAdjustmentPct.toFixed(1)}%)`;
                        } else {
                          // Baisse marge → Monter bid pour volume
                          option2_bidAdjustmentPct = marginChangePct * coeffs.bidImpactFactor * 100;
                          option2_cpmCost = cpmCostActuelCalc * (1 + option2_bidAdjustmentPct / 100);
                          option2_cpmRevenue = option2_cpmCost / (1 - newMargin / 100);
                          
                          if (option2_cpmRevenue > project.cpmSoldCap) {
                            option2_cpmCost = project.cpmSoldCap * (1 - newMargin / 100);
                            option2_cpmRevenue = project.cpmSoldCap;
                            option2_bidAdjustmentPct = ((option2_cpmCost - cpmCostActuelCalc) / cpmCostActuelCalc) * 100;
                            option2_respectsCap = true;
                          }
                          
                          option2_explanation = option2_respectsCap
                            ? `Bid optimal pour le Cap : ${option2_cpmCost.toFixed(2)} ${currSym} (${option2_bidAdjustmentPct > 0 ? '+' : ''}${option2_bidAdjustmentPct.toFixed(1)}%)`
                            : `Pour maximiser le volume, montez votre bid à ${option2_cpmCost.toFixed(2)} ${currSym} (+${option2_bidAdjustmentPct.toFixed(1)}%)`;
                        }
                        
                        // 🔥 CALCUL VOLATILITÉ OPTION 2 - VERSION RÉDUITE (sans pari créative)
                        const bidChangeAmplitude = Math.abs(option2_bidAdjustmentPct) / 100;
                        let volatilityMultiplier = 1.0;
                        
                        // Volatilité RÉDUITE car on ne parie plus sur la créative
                        // Fourchette = uniquement incertitude marché (compétition, volatilité)
                        if (bidChangeAmplitude > 0.50) {
                          volatilityMultiplier = 1.4;  // Au lieu de 2.2
                        } else if (bidChangeAmplitude > 0.30) {
                          volatilityMultiplier = 1.3;  // Au lieu de 1.8
                        } else if (bidChangeAmplitude > 0.20) {
                          volatilityMultiplier = 1.2;  // Au lieu de 1.5
                        } else if (bidChangeAmplitude > 0.10) {
                          volatilityMultiplier = 1.15; // Au lieu de 1.3
                        }
                        
                        // Niveau du nouveau bid (impact réduit aussi)
                        const avgMarketCpm = 3.0;
                        const option2_bidRatio = option2_cpmCost / avgMarketCpm;
                        
                        if (option2_bidRatio < 0.3) {
                          volatilityMultiplier *= 1.2;  // Au lieu de 1.5
                        } else if (option2_bidRatio < 0.5) {
                          volatilityMultiplier *= 1.15; // Au lieu de 1.3
                        } else if (option2_bidRatio < 0.7) {
                          volatilityMultiplier *= 1.1;  // Au lieu de 1.2
                        }
                        
                        const isHighBidChange = Math.abs(option2_bidAdjustmentPct) > 20;
                        
                        // ========================================
                        // 🔥 CALCUL KPIs PROJETÉS - CORRECTION OPTION 1
                        // ========================================
                        
                        let option1_kpi_optimistic, option1_kpi_pessimistic;
                        let option2_kpi_optimistic, option2_kpi_pessimistic;
                        
                        // 🎯 BASE COMMUNE : Impact mathématique de la marge
                        const marginImpactDirection = isFin ? (isIncreasingMargin ? 1 : -1) : (isIncreasingMargin ? -1 : 1);
                        const baseMarginImpact = 1 + (marginChangePct * finalMarginImpact * marginImpactDirection);
                        
                        // ========================================
        // 🔥 OPTION 1 : CALCUL MATHÉMATIQUE EXACT
        // ========================================
        
        // Bid stable = MÊME inventaire = MÊME conversion rate
        // → Impact PUREMENT MATHÉMATIQUE du ratio CPM Revenue
        
        const currentCpmRevenue = project.cpmRevenueActual;
        const currentCpmCost = cpmCostActuelCalc;
        
        // Nouvelle CPM Revenue avec la nouvelle marge
        const newCpmRevenue_option1 = currentCpmCost / (1 - newMargin / 100);
        
        // Ratio CPM Revenue (impact mathématique pur)
        const cpmRevenueRatio = newCpmRevenue_option1 / currentCpmRevenue;
        
        // Impact EXACT sur le KPI (financier)
        let option1_kpi_exact: number;
        
        if (isFin) {
          // KPI financier : CPCV = CPM / (completion_rate × 1000)
          // Même inventaire → même completion_rate
          // Donc CPCV_new / CPCV_old = CPM_new / CPM_old
          option1_kpi_exact = project.actualKpi * cpmRevenueRatio;
        } else {
          // KPI qualité : léger impact créative (marge monte = qualité baisse légèrement)
          const qualityImpact = isIncreasingMargin ? 0.98 : 1.02;
          option1_kpi_exact = project.actualKpi * qualityImpact;
        }
        
        // 🔥 FOURCHETTE MINIMALE : ±3-5% (variations naturelles conversion rate)
        // PAS de volatilité inventaire car bid INCHANGÉ
        let option1_uncertainty: number;
        
        if (isFin) {
          // KPI financier : ±3% (variations naturelles du taux de complétion)
          option1_uncertainty = option1_kpi_exact * 0.03;
        } else {
          // KPI qualité : ±5% (variations créatives)
          option1_uncertainty = option1_kpi_exact * 0.05;
        }
        
        option1_kpi_optimistic = option1_kpi_exact - option1_uncertainty;
        option1_kpi_pessimistic = option1_kpi_exact + option1_uncertainty;
                        
                        // 🎯 BID IMPACT pour Option 2 - PUREMENT MATHÉMATIQUE (sans pari créative)
                        const bidImpactDirection = isFin ? 1 : -1;
                        const bidImpactMagnitude = Math.abs(option2_bidAdjustmentPct) / 100;
                        
                        // Impact CERTAIN du changement d'inventaire
                        // Pas de "pari créative", juste la réalité du shift d'inventaire
                        const inventoryShiftImpact = bidImpactMagnitude * coeffs.bidImpactFactor * bidImpactDirection;
                        
                        // OPTION 2 : Calcul déterministe
                        // 1. Impact marge (mathématique)
                        const option2_center_base = project.actualKpi * baseMarginImpact;
                        
                        // 2. Impact inventaire (CERTAIN, pas optimiste/pessimiste)
                        const inventoryImpact = project.actualKpi * inventoryShiftImpact;
                        
                        // 3. Centre = impact marge + impact inventaire
                        const option2_center = option2_center_base + inventoryImpact;
                        
                        // 🔥 FOURCHETTE RÉDUITE : uniquement incertitude marché (compétition, volatilité)
                        // Plus de "créative forte vs faible", juste l'incertitude normale du programmatique
                        const marketUncertainty = project.actualKpi * (coeffs.volatility + coeffs.competition);
                        
                        // Volatilité légèrement augmentée si gros changement de bid (marché imprévisible)
                        const adjustedVolatility = marketUncertainty * Math.min(volatilityMultiplier, 1.4);
                        
                        option2_kpi_optimistic = option2_center - (adjustedVolatility / 2);
                        option2_kpi_pessimistic = option2_center + (adjustedVolatility / 2);
                        
                        // Vérifier si objectif atteint
                        const targetKpi = project.targetKpi;
                        const option1_meetsTarget_optimistic = isFin ? option1_kpi_optimistic <= targetKpi : option1_kpi_optimistic >= targetKpi;
                        const option1_meetsTarget_pessimistic = isFin ? option1_kpi_pessimistic <= targetKpi : option1_kpi_pessimistic >= targetKpi;
                        const option2_meetsTarget_optimistic = isFin ? option2_kpi_optimistic <= targetKpi : option2_kpi_optimistic >= targetKpi;
                        const option2_meetsTarget_pessimistic = isFin ? option2_kpi_pessimistic <= targetKpi : option2_kpi_pessimistic >= targetKpi;
                        
                        // Calculer les ranges pour affichage
                        const option1_range = option1_kpi_pessimistic - option1_kpi_optimistic;
                        const option2_range = option2_kpi_pessimistic - option2_kpi_optimistic;
                        
                        // ========================================
                        // EXPLICATIONS ULTRA-EXPERTES PAR KPI
                        // ========================================
                        
                        const getKPIExplanations = (kpiType: string, isIncreasing: boolean) => {
                          const explanations: any = {
                            CPCV: {
                              up: { 
                                impact: "Marge monte → Bid baisse → Inventaire moins premium. Completion rate CHUTE (shift mathématique vers outstream, banner vidéo). Impact CERTAIN : CPCV grimpe.",
                                option2: "Baisser modérément permet de rester sur mid-tier. Limite la dégradation.",
                                range: "Fourchette = incertitude marché (compétition, volatilité). PAS de pari créative."
                              },
                              down: { 
                                impact: "Marge baisse → Bid monte → Accès inventaire PREMIUM (in-stream, player grand format). Completion rate MONTE (shift mathématique certain). CPCV BAISSE.",
                                option2: "Monter agressivement = dominer l'inventaire premium. Effet garanti.",
                                range: "Fourchette = incertitude marché normale. Impact inventaire est CERTAIN."
                              }
                            },
                            CPA: {
                              up: { 
                                impact: isLongAttribution 
                                  ? `🔥 CRITIQUE (J+${attrClick}) : Reach baisse → MOINS d'impressions sur toute la fenêtre → Conversions BAISSENT mathématiquement (reach = volume). CPA MONTE.`
                                  : `🔥 CRITIQUE : Reach baisse → MOINS impressions dans fenêtre J+${attrClick} clic / J+${attrView} view → Conversions baissent mathématiquement. CPA MONTE.`,
                                option2: `Ajuster bid maintient VOLUME. Impact mathématique prévisible pour ${attrClick} jours.`,
                                range: "Fourchette = volatilité compétition (enchères fluctuantes). Pas de pari créative."
                              },
                              down: { 
                                impact: isLongAttribution 
                                  ? `🚀 OPPORTUNITÉ (J+${attrClick}) : Reach MASSIF ${attrClick} jours → Multi-touch sur TOUTE fenêtre → Conversions MONTENT mathématiquement. CPA BAISSE.`
                                  : `🚀 BOOST : Reach ↑ → Plus impressions fenêtre J+${attrClick} → Multi-touch maximisé → Conversions ↑ mathématiquement. CPA baisse.`,
                                option2: "Baisse marge + boost bid = MULTIPLICATEUR conversions. Effet déterministe.",
                                range: "Fourchette = volatilité marché (niveau compétition variable). Impact reach CERTAIN."
                              }
                            },
                            CPC: {
                              up: { 
                                impact: "Baisser bid = perte positions premium → CTR BAISSE (mathématique) → Moins clics pour même coût → CPC MONTE.",
                                option2: "Modéré = rester mid-funnel. Éviter l'effondrement total.",
                                range: "Fourchette = volatilité marché (compétition variable). Pas de pari créative."
                              },
                              down: { 
                                impact: "Monter bid = positions PREMIUM (above-fold, native) → CTR ↑ (mathématique) → Plus clics même coût → CPC BAISSE.",
                                option2: "Agressif = domination premium. Effet garanti.",
                                range: "Fourchette = incertitude compétition. Impact positions CERTAIN."
                              }
                            },
                            CPV: {
                              up: { 
                                impact: isLongAttribution 
                                  ? `🔥 CRITIQUE (J+${attrClick}) : Shift vers LOW-INTENT → Visites trash (bounce élevé) CERTAIN → CPV grimpe.`
                                  : `🔥 QUALITÉ BAISSE : Moins placements contextuels → LOW-INTENT mathématique → CPV monte.`,
                                option2: `Ajuster = mid-tier QUALIFIÉ. Impact déterministe.`,
                                range: "Fourchette = volatilité marché (niveau fraud variable). Pas de pari créative."
                              },
                              down: { 
                                impact: isLongAttribution 
                                  ? `🚀 OPPORTUNITÉ (J+${attrClick}) : Premium intent-based → ULTRA-QUALIFIÉ mathématiquement → CPV BAISSE.`
                                  : `🚀 QUALITÉ MONTE : Meilleur contextuel → ULTRA-QUALIFIÉ certain → CPV baisse.`,
                                option2: "Baisse + boost = volume QUALIFIÉ. Effet garanti.",
                                range: "Fourchette = volatilité marché normale. Impact qualité CERTAIN."
                              }
                            },
                            CPM: {
                              up: { 
                                impact: "Baisser bid = inventaire RÉSIDUEL → Fill rate CHUTE → CPM peut monter (paradoxe résiduel).",
                                option2: "Ajuster = inventaire standard. Impact prévisible.",
                                range: "Fourchette = volatilité fill rate (inventaire variable)."
                              },
                              down: { 
                                impact: "Monter bid = inventaire PREMIUM → Fill rate ÉLEVÉ → CPM baisse (économies d'échelle).",
                                option2: "Hausser = premium, fill rate max. Effet garanti.",
                                range: "Fourchette = volatilité marché normale."
                              }
                            },
                            CTR: {
                              up: { 
                                impact: "Bid plus bas = visibilité réduite (below-fold) → CTR BAISSE (mathématique).",
                                option2: "Éviter l'invisible total.",
                                range: "Fourchette = volatilité positions (enchères variables)."
                              },
                              down: { 
                                impact: "Bid plus haut = visibilité ↑ (above-fold) → CTR ↑ (mathématique).",
                                option2: "Hausser = premium. Effet certain.",
                                range: "Fourchette = volatilité marché normale."
                              }
                            },
                            VTR: {
                              up: { 
                                impact: "Moins bid = shift OUTSTREAM low → VTR chute (mathématique).",
                                option2: "Ajuster = in-stream mid. Impact prévisible.",
                                range: "Fourchette = volatilité inventaire."
                              },
                              down: { 
                                impact: "Plus bid = IN-STREAM premium → VTR ↑ (mathématique).",
                                option2: "Hausser = in-stream. Effet garanti.",
                                range: "Fourchette = volatilité marché normale."
                              }
                            },
                            Viewability: {
                              up: { 
                                impact: "Viewability dépend peu du bid (technique). Impact FAIBLE.",
                                option2: "Minimal.",
                                range: "Fourchette = stabilité technique."
                              },
                              down: { 
                                impact: "Plus bid = léger premium → Impact MARGINAL.",
                                option2: "Un peu.",
                                range: "Fourchette = quasi nulle."
                              }
                            }
                          };
                          return explanations[kpiType]?.[isIncreasing ? 'up' : 'down'] || explanations.CPA[isIncreasing ? 'up' : 'down'];
                        };
                        
                        const kpiExplanations = getKPIExplanations(project.kpiType, isIncreasingMargin);
                        
                        return (
                          <div className="space-y-6">
                            {/* ALERTES */}
                            {isLongAttribution && isAttributionKPI && (
                              <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-orange-900 mb-2">
                                  <AlertTriangle className="w-5 h-5" />
                                  <span className="font-black">FENÊTRE ATTRIBUTION LONGUE (J+{attrClick})</span>
                                </div>
                                <p className="text-sm text-orange-700">
                                  Sensibilité EXTRÊME au bid. Impact MULTIPLIÉ ×{attributionFactor.toFixed(2)} sur {project.kpiType}.
                                </p>
                              </div>
                            )}
                            
                            {isHighBidChange && (
                              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-amber-900 mb-2">
                                  <AlertTriangle className="w-5 h-5" />
                                  <span className="font-black">CHANGEMENT BID IMPORTANT (Option 2)</span>
                                </div>
                                <p className="text-sm text-amber-700">
                                  Option 2 propose un changement de bid de {option2_bidAdjustmentPct > 0 ? '+' : ''}{option2_bidAdjustmentPct.toFixed(1)}% 
                                  → Fourchette ÉLARGIE ×{volatilityMultiplier.toFixed(2)} (incertitude marché : compétition variable, volatilité)
                                </p>
                              </div>
                            )}

                            {/* COMPARAISON OPTIONS */}
                            <div className="grid grid-cols-2 gap-4">
                              {/* OPTION 1 */}
                              <div className="bg-white border-2 border-purple-200 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-black">1</div>
                                  <div>
                                    <h5 className="font-bold text-purple-900">Bid Stable</h5>
                                    <p className="text-xs text-purple-600">Impact 100% mathématique</p>
                                  </div>
                                </div>
                                
                                <div className="space-y-3">
                                  <div className="bg-purple-50 rounded-lg p-3">
                                    <div className="text-xs text-purple-600 mb-1">CPM Cost (Bid)</div>
                                    <div className="text-lg font-black text-purple-900">{option1_cpmCost.toFixed(2)} {currSym}</div>
                                    <div className="text-xs text-emerald-600 mt-1 font-bold">
                                      → INCHANGÉ (même inventaire)
                                    </div>
                                  </div>
                                  
                                  <div className={cn("rounded-lg p-3", option1_exceedsCap ? "bg-red-50 border-2 border-red-300" : "bg-gray-50")}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="text-xs text-gray-500">CPM Revenu</div>
                                      {option1_exceedsCap && (
                                        <div className="flex items-center gap-1 text-red-600">
                                          <AlertTriangle className="w-3 h-3" />
                                          <span className="text-[9px] font-black">ALERTE CAP</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className={cn("text-sm font-bold", option1_exceedsCap ? "text-red-700" : "text-gray-900")}>
                                      {option1_cpmRevenue.toFixed(2)} {currSym}
                                    </div>
                                    {option1_exceedsCap && (
                                      <div className="mt-2 pt-2 border-t border-red-200">
                                        <div className="text-[10px] text-red-600 font-bold">
                                          Dépasse {option1_excessAmount.toFixed(2)} {currSym} (+{option1_excessPct.toFixed(1)}%)
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
                                    <div className="text-xs font-bold text-blue-900 mb-3 flex items-center justify-between">
                                      <span>{project.kpiType} Projeté</span>
                                      <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full">EXACT</span>
                                    </div>
                                    
                                    <div className={cn("mb-2 p-2 rounded border", option1_meetsTarget_optimistic ? "bg-emerald-50 border-emerald-300" : "bg-orange-50 border-orange-300")}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-gray-600">😊 Optimiste</span>
                                        {option1_meetsTarget_optimistic ? <span className="text-emerald-600 text-xs">✓</span> : <span className="text-orange-600 text-xs">⚠</span>}
                                      </div>
                                      <div className={cn("text-lg font-black", option1_meetsTarget_optimistic ? "text-emerald-600" : "text-orange-600")}>
                                        {fmtKpi(option1_kpi_optimistic)}
                                      </div>
                                    </div>
                                    
                                    <div className={cn("p-2 rounded border", option1_meetsTarget_pessimistic ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300")}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-gray-600">😰 Pessimiste</span>
                                        {option1_meetsTarget_pessimistic ? <span className="text-emerald-600 text-xs">✓</span> : <span className="text-red-600 text-xs">✗</span>}
                                      </div>
                                      <div className={cn("text-lg font-black", option1_meetsTarget_pessimistic ? "text-emerald-600" : "text-red-600")}>
                                        {fmtKpi(option1_kpi_pessimistic)}
                                      </div>
                                    </div>
                                    
                                    <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                                      Objectif : <strong>{fmtKpi(targetKpi)}</strong><br/>
                                      Range : <strong>{fmtKpi(option1_range)}</strong>
                                      <div className="text-[10px] text-blue-700 font-bold mt-1">
                                       {isFin ? "Ratio CPM exact" : "Variations créatives"} (±{isFin ? "3" : "5"}%)
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* OPTION 2 */}
                              <div className="bg-white border-2 border-pink-200 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-lg flex items-center justify-center font-black">2</div>
                                  <div>
                                    <h5 className="font-bold text-pink-900">Bid Ajusté</h5>
                                    <p className="text-xs text-pink-600">{option2_respectsCap ? "Respecte Cap" : "Calcul déterministe"}</p>
                                  </div>
                                </div>
                                
                                <div className="space-y-3">
                                  <div className="bg-pink-50 rounded-lg p-3">
                                    <div className="text-xs text-pink-600 mb-1 flex items-center gap-1">CPM Cost (Bid) 🎯</div>
                                    <div className="text-lg font-black text-pink-900">{option2_cpmCost.toFixed(2)} {currSym}</div>
                                    <div className={cn("text-xs font-bold mt-1 flex items-center gap-1", option2_cpmCost < cpmCostActuelCalc ? "text-red-600" : "text-emerald-600")}>
                                      {option2_cpmCost < cpmCostActuelCalc ? "↓" : "↑"} {Math.abs(option2_bidAdjustmentPct).toFixed(1)}%
                                      <span className="text-[9px] bg-pink-100 px-1.5 py-0.5 rounded text-pink-700">
                                        {option2_respectsCap ? "CAP OK" : "OPTIMAL"}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className={cn("rounded-lg p-3", option2_respectsCap ? "bg-emerald-50 border-2 border-emerald-300" : "bg-gray-50")}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="text-xs text-gray-500">CPM Revenu</div>
                                      {option2_respectsCap && (
                                        <div className="flex items-center gap-1 text-emerald-600">
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span className="text-[9px] font-black">CAP OK</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-sm font-bold text-gray-900">{option2_cpmRevenue.toFixed(2)} {currSym}</div>
                                    {option2_respectsCap && (
                                      <div className="text-[10px] text-emerald-600 font-bold mt-1">
                                        = Cap ({project.cpmSoldCap.toFixed(2)} {currSym})
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-lg p-4">
                                    <div className="text-xs font-bold text-emerald-900 mb-3 flex items-center justify-between">
                                      <span>{project.kpiType} Projeté</span>
                                      <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full">DÉTERMINISTE</span>
                                    </div>
                                    
                                    <div className={cn("mb-2 p-2 rounded border", option2_meetsTarget_optimistic ? "bg-emerald-50 border-emerald-300" : "bg-orange-50 border-orange-300")}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-gray-600">😊 Optimiste</span>
                                        {option2_meetsTarget_optimistic ? <span className="text-emerald-600 text-xs">✓</span> : <span className="text-orange-600 text-xs">⚠</span>}
                                      </div>
                                      <div className={cn("text-lg font-black", option2_meetsTarget_optimistic ? "text-emerald-600" : "text-orange-600")}>
                                        {fmtKpi(option2_kpi_optimistic)}
                                      </div>
                                    </div>
                                    
                                    <div className={cn("p-2 rounded border", option2_meetsTarget_pessimistic ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300")}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-gray-600">😰 Pessimiste</span>
                                        {option2_meetsTarget_pessimistic ? <span className="text-emerald-600 text-xs">✓</span> : <span className="text-red-600 text-xs">✗</span>}
                                      </div>
                                      <div className={cn("text-lg font-black", option2_meetsTarget_pessimistic ? "text-emerald-600" : "text-red-600")}>
                                        {fmtKpi(option2_kpi_pessimistic)}
                                      </div>
                                    </div>
                                    
                                    <div className="mt-2 pt-2 border-t border-emerald-200">
                                      <div className="text-[10px] text-emerald-700 font-bold">
                                        ⚙️ Volatilité ×{volatilityMultiplier.toFixed(2)} (incertitude marché : compétition, volatilité)
                                      </div>
                                    </div>
                                    
                                    <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                                      Objectif : <strong>{fmtKpi(targetKpi)}</strong><br/>
                                      Range : <strong className="text-pink-600">{fmtKpi(option2_range)}</strong>
                                      {option2_range > option1_range && <span className="text-pink-600 ml-1">({((option2_range / option1_range) * 100).toFixed(0)}% plus large)</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* EXPLICATIONS EXPERTES */}
                            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-5">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shrink-0">💡</div>
                                <div className="flex-1">
                                  <h5 className="font-black text-indigo-900 mb-3 text-sm">
                                    Analyse {project.kpiType} - 20 Ans Expertise Programmatique
                                    {isAttributionKPI && <span className="text-xs ml-2 bg-orange-500 text-white px-2 py-0.5 rounded-full">J+{attrClick} / J+{attrView}</span>}
                                  </h5>
                                  
                                  <div className="space-y-3 text-sm text-indigo-800">
                                    <div className="bg-white/60 rounded-lg p-3 border border-indigo-100">
                                      <p className="font-bold mb-1.5 text-indigo-900">
                                        {isIncreasingMargin ? "🔺 Impact Montée Marge" : "🔻 Impact Baisse Marge"}
                                      </p>
                                      <p className="text-xs leading-relaxed">{kpiExplanations.impact}</p>
                                    </div>
                                    
                                    <div className="bg-pink-50/60 rounded-lg p-3 border border-pink-200">
                                      <p className="font-bold mb-1.5 text-pink-900">🎯 Option 2 (Bid Ajusté)</p>
                                      <p className="text-xs leading-relaxed">{option2_explanation}. {kpiExplanations.option2}</p>
                                    </div>
                                    
                                    <div className="bg-yellow-50/60 rounded-lg p-3 border border-yellow-200">
                                      <p className="font-bold mb-1.5 text-yellow-900">📊 Fourchette (Incertitude Marché)</p>
                                      <p className="text-xs leading-relaxed">{kpiExplanations.range}</p>
                                    </div>
                                    
                                    <div className="bg-purple-50/60 rounded-lg p-3 border border-purple-200">
                                      <p className="font-bold mb-1.5 text-purple-900">📐 Comparaison Volatilité</p>
                                      <p className="text-xs leading-relaxed">
                                        <strong>Option 1 (Bid Stable):</strong> Range = {fmtKpi(option1_range)} <strong className="text-purple-700">(±{isFin ? "3" : "5"}% seulement !)</strong> → Bid INCHANGÉ = MÊME inventaire = Impact purement mathématique.<br/>
                                        <strong>Option 2 (Bid Ajusté):</strong> Range = {fmtKpi(option2_range)} <strong className="text-purple-700">({((option2_range / option1_range) * 100).toFixed(0)}% plus large)</strong> → Bid change de {option2_bidAdjustmentPct > 0 ? '+' : ''}{option2_bidAdjustmentPct.toFixed(1)}% = NOUVEL inventaire + incertitude marché (compétition variable, volatilité). Impact inventaire CERTAIN, fourchette = volatilité marché uniquement.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                         
                    <div className="flex justify-end mt-6">
                      <button 
                        onClick={applyMarginChange}
                        disabled={uplift === 0}
                        className={cn(
                          "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm",
                          uplift === 0 
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                            : uplift > 0 
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-amber-600 text-white hover:bg-amber-700"
                        )}
                      >
                        {uplift > 0 ? (<><TrendingUp className="w-4 h-4" />📈 Appliquer Hausse</>) : uplift < 0 ? (<><TrendingDown className="w-4 h-4" />📉 Appliquer Baisse</>) : (<><Minus className="w-4 h-4" />Aucun changement</>)}
                      </button>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Projection des Gains</h3>
                          <p className="text-sm text-gray-500">Évolution de la marge cumulée</p>
                        </div>
                        <div className={cn("border rounded-xl px-6 py-3 text-right", uplift >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100")}>
                          <div className={cn("font-bold text-xs uppercase tracking-wider mb-1", uplift >= 0 ? "text-emerald-800" : "text-red-800")}>
                            Gain Potentiel
                          </div>
                          <div className={cn("text-2xl font-black", uplift >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {uplift > 0 ? "+" : ""}{(budgetRemaining * (uplift / 100)).toLocaleString()} {currSym}
                          </div>
                        </div>
                      </div>

                      <div className="h-80 w-full bg-gray-50 rounded-xl p-4 border border-gray-100">
                        {(() => {
                          const gainPotentiel = budgetRemaining * (uplift / 100);
                          const data = [];
                          for (let i = 0; i <= project.durationDays; i++) {
                            if (i <= currentDay) {
                              data.push({ day: i, Acquis: (gainRealized / currentDay) * i });
                            } else {
                              const stepsRemaining = project.durationDays - currentDay;
                              const step = i - currentDay;
                              data.push({
                                day: i,
                                Actuel: gainRealized + (gainRemaining / stepsRemaining) * step,
                                Optimisé: gainRealized + ((gainRemaining + gainPotentiel) / stepsRemaining) * step
                              });
                            }
                          }
                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}${currSym}`} />
                                <Tooltip 
                                  contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                  formatter={(value: number) => [`${value.toFixed(0)} ${currSym}`]}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                <Line type="monotone" dataKey="Acquis" stroke="#0f172a" strokeWidth={3} dot={false} />
                                <Line type="monotone" dataKey="Actuel" stroke="#94a3b8" strokeWidth={3} strokeDasharray="5 5" dot={false} />
                                <Line type="monotone" dataKey="Optimisé" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "multilines" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Gestion des Line Items</h3>
                    <div className="flex gap-3">
                      <label className="cursor-pointer flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
                        <Upload className="w-4 h-4" />
                        Importer Excel
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                      </label>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                    <div className="mb-4">
                      <h4 className="font-bold text-blue-900 mb-1">Objectif d'optimisation</h4>
                      <p className="text-sm text-blue-700">Choisissez votre stratégie avant de lancer l'algorithme.</p>
                    </div>
                    <div className="flex gap-2 mb-4">
                      <button 
                        onClick={() => setMarginGoal("increase")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-colors", marginGoal === "increase" ? "bg-blue-600 text-white shadow-md" : "bg-white text-blue-600 border border-blue-200 hover:bg-blue-100")}
                      >
                        📈 Augmenter la Marge
                      </button>
                      <button 
                        onClick={() => setMarginGoal("decrease")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-colors", marginGoal === "decrease" ? "bg-amber-500 text-white shadow-md" : "bg-white text-amber-600 border border-amber-200 hover:bg-amber-50")}
                      >
                        📉 Baisser la Marge (Boost KPI)
                      </button>
                    </div>
                    
                    <div className="border-t border-blue-200 pt-4">
                      <h4 className="font-bold text-blue-900 mb-2 text-sm">⚙️ Contrainte CPM Vendu Cap</h4>
                      <p className="text-xs text-blue-700 mb-3">Le CPM Vendu Cap est à <strong>{project.cpmSoldCap.toFixed(2)} {currSym}</strong></p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setRespectCpmCap(true)}
                          className={cn("flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors", respectCpmCap ? "bg-emerald-600 text-white shadow-md" : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50")}
                        >
                          🛡️ Respecter le CPM Vendu
                          <div className="text-[10px] font-normal mt-1 opacity-90">Optimisation avec CPM moyen = Cap</div>
                        </button>
                        <button 
                          onClick={() => setRespectCpmCap(false)}
                          className={cn("flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors", !respectCpmCap ? "bg-purple-600 text-white shadow-md" : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-50")}
                        >
                          🚀 Ne pas respecter le CPM Vendu
                          <div className="text-[10px] font-normal mt-1 opacity-90">Optimisation flexible (sans contrainte)</div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={handleOptimize}
                      className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <Wand2 className="w-4 h-4" />
                      Lancer l'Optimisation
                    </button>
                  </div>

                  {proposedOptimizations && (
                    <>
                      <div className="overflow-x-auto rounded-xl border border-blue-200 shadow-sm">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-blue-800 uppercase bg-blue-50 border-b border-blue-200">
                            <tr>
                              <th className="px-6 py-4 font-bold">Line Item</th>
                              <th className="px-6 py-4 font-bold">Action</th>
                              <th className="px-6 py-4 font-bold">Nouvelle Dépense</th>
                              <th className="px-6 py-4 font-bold">CPM Revenu</th>
                              <th className="px-6 py-4 font-bold">Nouvelle Marge %</th>
                              <th className="px-6 py-4 font-bold">KPI Actuel</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-100">
                            {proposedOptimizations.map((li) => {
                              const original = project.lineItems.find(o => o.id === li.id);
                              const spendDiff = original ? (li.spend || 0) - (original.spend || 0) : 0;
                              const marginDiff = original ? li.marginPct - original.marginPct : 0;
                              const cpmRevDiff = original ? li.cpmRevenue - original.cpmRevenue : 0;
                              
                              return (
                                <tr key={li.id} className="bg-white hover:bg-blue-50/50 transition-colors">
                                  <td className="px-6 py-4 font-medium text-gray-900">{li.name}</td>
                                  <td className="px-6 py-4">
                                    <div className="text-xs font-bold text-gray-700 bg-gray-50 px-3 py-1 rounded-lg inline-block">
                                      {(() => {
                                        const opt = proposedOptimizations.find(o => o.id === li.id) as OptimizationItem;
                                        return opt?.action || "—";
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-900 font-bold">
                                        {li.spend.toFixed(2)} {currSym}
                                      </span>
                                      {spendDiff !== 0 && (
                                        <span className={cn("text-xs font-medium whitespace-nowrap", spendDiff > 0 ? "text-emerald-600" : "text-red-600")}>
                                          ({spendDiff > 0 ? "+" : ""}{spendDiff.toFixed(2)} {currSym})
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-900">{li.cpmRevenue.toFixed(2)}</span>
                                      {cpmRevDiff !== 0 && (
                                        <span className={cn("text-xs font-medium", cpmRevDiff > 0 ? "text-emerald-600" : "text-red-600")}>
                                          ({cpmRevDiff > 0 ? "+" : ""}{cpmRevDiff.toFixed(2)})
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-900">{li.marginPct.toFixed(2)}%</span>
                                      {marginDiff !== 0 && (
                                        <span className={cn("text-xs font-medium ml-1", marginDiff > 0 ? "text-emerald-600" : "text-red-600")}>
                                          ({marginDiff > 0 ? "+" : ""}{marginDiff.toFixed(2)}%)
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-gray-600">{li.kpiActual}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
                          <div className="bg-indigo-100 p-2 rounded-lg">
                            <Activity className="w-5 h-5 text-indigo-600" />
                          </div>
                          <h4 className="text-lg font-bold text-gray-900">Impact Projeté</h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            {(() => {
                              const oldTotalSpend = project.lineItems.reduce((acc, l) => acc + (l.spend || 0), 0);
                              const oldWeightedMargin = oldTotalSpend > 0 ? project.lineItems.reduce((acc, l) => acc + (l.spend||0)*l.marginPct, 0) / oldTotalSpend : 0;
                              const oldWeightedCpmRev = oldTotalSpend > 0 ? project.lineItems.reduce((acc, l) => acc + (l.spend||0)*l.cpmRevenue, 0) / oldTotalSpend : 0;
                              
                              const newTotalSpend = proposedOptimizations.reduce((acc, l) => acc + (l.spend || 0), 0);
                              const newWeightedMargin = newTotalSpend > 0 ? proposedOptimizations.reduce((acc, l) => acc + (l.spend||0)*l.marginPct, 0) / newTotalSpend : 0;
                              const newWeightedCpmRev = newTotalSpend > 0 ? proposedOptimizations.reduce((acc, l) => acc + (l.spend||0)*l.cpmRevenue, 0) / newTotalSpend : 0;
                              
                              const marginDiff = newWeightedMargin - oldWeightedMargin;
                              const cpmRevDiff = newWeightedCpmRev - oldWeightedCpmRev;
                              const capDiff = newWeightedCpmRev - project.cpmSoldCap;
                              
                              const isFin = !["Viewability", "VTR", "CTR"].includes(project.kpiType);
                              const kpiOptimistic = isFin ? project.actualKpi * 0.9 : project.actualKpi * 1.1;
                              const kpiPessimistic = isFin ? project.actualKpi * 1.05 : project.actualKpi * 0.95;

                              return (
                                <div className="space-y-6">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                      <div className="text-xs text-gray-500 mb-1">Nouvelle Marge Globale</div>
                                      <div className={cn("text-xl font-black", marginDiff >= 0 ? "text-blue-600" : "text-amber-600")}>
                                        {newWeightedMargin.toFixed(2)} %
                                      </div>
                                      <div className="text-xs text-gray-400 mt-1">
                                        ({marginDiff > 0 ? "+" : ""}{marginDiff.toFixed(2)} pts)
                                      </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                      <div className="text-xs text-gray-500 mb-1">Total Dépense</div>
                                      <div className="text-xl font-black text-gray-900">
                                        {newTotalSpend.toFixed(2)} {currSym}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className={cn("p-3 rounded-lg border", 
                                      respectCpmCap && Math.abs(capDiff) <= 0.1 ? "bg-emerald-50 border-emerald-200" : "bg-indigo-50 border-indigo-100"
                                    )}>
                                      <div className="text-xs font-bold text-indigo-800 mb-1 flex items-center justify-between">
                                        <span>CPM Revenu Moyen</span>
                                        {respectCpmCap && Math.abs(capDiff) <= 0.1 && <span className="text-emerald-600">✓</span>}
                                      </div>
                                      <div className="text-lg font-black text-indigo-600">
                                        {newWeightedCpmRev.toFixed(2)} {currSym}
                                      </div>
                                      <div className="text-xs text-indigo-500 mt-1">
                                        {respectCpmCap && (
                                          <>Cap: {project.cpmSoldCap.toFixed(2)} {currSym} (écart: {capDiff > 0 ? "+" : ""}{capDiff.toFixed(2)})</>
                                        )}
                                      </div>
                                    </div>
                                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                      <div className="text-xs font-bold text-emerald-800 mb-1">Projection KPI</div>
                                      <div className="flex justify-between items-end">
                                        <div className="text-xs text-emerald-600">
                                          Pess: <strong>{fmtKpi(kpiPessimistic)}</strong>
                                        </div>
                                        <div className="text-xs text-emerald-600">
                                          Opt: <strong>{fmtKpi(kpiOptimistic)}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg text-xs text-gray-600 leading-relaxed border border-gray-100 flex flex-col justify-center">
                            <h5 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><BarChart3 className="w-4 h-4"/> Analyse Stratégique</h5>
                            {respectCpmCap ? (
                              <div>
                                <p className="mb-2">
                                  🛡️ <strong>Mode Respecter le Cap</strong> : L'algorithme répartit intelligemment les budgets pour atteindre le CPM Vendu Cap en moyenne pondérée.
                                </p>
                                <p>
                                  Les lignes performantes reçoivent plus de budget et peuvent monter jusqu'au Cap, tandis que les lignes moins performantes compensent avec des CPM Revenue plus bas.
                                </p>
                              </div>
                            ) : (
                              <p>
                                🚀 <strong>Mode Liberté totale</strong> : {marginGoal === "increase" 
                                  ? "Consolidation des acquis. Le budget est réalloué vers les lignes à forte rentabilité." 
                                  : "Offensive de volume. Sacrifier de la marge pour aller chercher plus de conversions."}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-6">
                        <button 
                          onClick={() => setProposedOptimizations(null)}
                          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                        >
                          Annuler
                        </button>
                        <button 
                          onClick={applyOptimizations}
                          className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          ✅ Appliquer
                        </button>
                      </div>
                    </>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-gray-200 mt-8">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 font-bold">Line Item</th>
                          <th className="px-6 py-4 font-bold">Dépense Jour</th>
                          <th className="px-6 py-4 font-bold">CPM Revenu</th>
                          <th className="px-6 py-4 font-bold">Marge %</th>
                          <th className="px-6 py-4 font-bold">KPI ({project.kpiType})</th>
                          <th className="px-6 py-4 font-bold"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {project.lineItems.map((li, idx) => (
                          <tr key={li.id} className="hover:bg-gray-50 transition-colors bg-white">
                            <td className="px-6 py-3 flex items-center gap-2">
                              <button 
                                onClick={() => toggleLock(li.id)}
                                className={cn("p-1.5 rounded-md transition-colors", lockedLines.has(li.id) ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400 hover:bg-gray-200")}
                              >
                                {lockedLines.has(li.id) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                              </button>
                              <input 
                                type="text" 
                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-gray-900"
                                value={li.name}
                                onChange={(e) => {
                                  const newItems = [...project.lineItems];
                                  newItems[idx].name = e.target.value;
                                  updateField("lineItems", newItems);
                                }}
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="number" 
                                className="w-24 bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-600"
                                value={li.spend}
                                onChange={(e) => {
                                  const newItems = [...project.lineItems];
                                  newItems[idx].spend = Number(e.target.value);
                                  updateField("lineItems", newItems);
                                }}
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="number" step="0.1"
                                className="w-24 bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-600"
                                value={li.cpmRevenue}
                                onChange={(e) => {
                                  const newItems = [...project.lineItems];
                                  newItems[idx].cpmRevenue = Number(e.target.value);
                                  updateField("lineItems", newItems);
                                }}
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="number" step="0.5"
                                className="w-24 bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-600"
                                value={li.marginPct}
                                onChange={(e) => {
                                  const newItems = [...project.lineItems];
                                  newItems[idx].marginPct = Number(e.target.value);
                                  updateField("lineItems", newItems);
                                }}
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="number" step="0.01"
                                className="w-24 bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-600"
                                value={li.kpiActual}
                                onChange={(e) => {
                                  const newItems = [...project.lineItems];
                                  newItems[idx].kpiActual = Number(e.target.value);
                                  updateField("lineItems", newItems);
                                }}
                              />
                            </td>
                            <td className="px-6 py-3 text-right">
                              <button 
                                onClick={() => {
                                  const newItems = project.lineItems.filter((_, i) => i !== idx);
                                  updateField("lineItems", newItems);
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button 
                    onClick={() => {
                      updateField("lineItems", [
                        ...project.lineItems, 
                        { id: Date.now().toString(), name: "Nouvelle Ligne", spend: 0, cpmRevenue: project.cpmRevenueActual, marginPct: currentMarginPctCalc, kpiActual: project.actualKpi }
                      ]);
                    }}
                    className="text-sm text-blue-600 font-bold hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-lg transition-colors"
                  >
                    + Ajouter une ligne
                  </button>
                </div>
              )}

              {activeTab === "historique" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">Historique des Modifications</h3>
                    <div className="text-sm text-gray-500">
                      {project.history?.length || 0} entrée(s)
                    </div>
                  </div>

                  {(!project.history || project.history.length === 0) ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                      <div className="text-gray-400 text-4xl mb-3">📜</div>
                      <h4 className="font-bold text-gray-700 mb-1">Aucun historique</h4>
                      <p className="text-sm text-gray-500">
                        Les modifications futures seront enregistrées ici automatiquement.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                        <div className="space-y-6">
                          {[...project.history].reverse().map((snap, idx) => {
                            const date = new Date(snap.timestamp);
                            const isRecent = (Date.now() - date.getTime()) < 24 * 60 * 60 * 1000;
                            
                            return (
                              <div key={idx} className="relative pl-16">
                                <div className={cn(
                                  "absolute left-6 w-4 h-4 rounded-full border-4",
                                  snap.action === "MARGIN_UP" ? "bg-emerald-500 border-emerald-100" :
                                  snap.action === "MARGIN_DOWN" ? "bg-amber-500 border-amber-100" :
                                  snap.action === "OPTIMIZATION" ? "bg-blue-500 border-blue-100" :
                                  "bg-gray-400 border-gray-100"
                                )}></div>
                                
                                <div className={cn(
                                  "bg-white border rounded-xl p-5 shadow-sm",
                                  isRecent && "border-blue-300 bg-blue-50/30"
                                )}>
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "px-3 py-1 rounded-full text-xs font-bold",
                                        snap.action === "MARGIN_UP" ? "bg-emerald-100 text-emerald-700" :
                                        snap.action === "MARGIN_DOWN" ? "bg-amber-100 text-amber-700" :
                                        snap.action === "OPTIMIZATION" ? "bg-blue-100 text-blue-700" :
                                        "bg-gray-100 text-gray-700"
                                      )}>
                                        {snap.action === "MARGIN_UP" ? "📈 MONTÉE MARGE" :
                                         snap.action === "MARGIN_DOWN" ? "📉 BAISSE MARGE" :
                                         snap.action === "OPTIMIZATION" ? "🎛️ OPTIMISATION" :
                                         snap.action === "DAILY_UPDATE" ? "📅 SUIVI QUOTIDIEN" :
                                         "💾 SAUVEGARDE"}
                                      </div>
                                      {isRecent && (
                                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                                          RÉCENT
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="text-xs text-gray-500 font-medium">
                                        {date.toLocaleDateString('fr-FR', { 
                                          day: '2-digit', 
                                          month: 'short', 
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </div>
                                      <button
                                        onClick={() => handleDeleteHistoryEntry(project.history!.length - 1 - idx)}
                                        className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                                        title="Supprimer cette entrée"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-4 gap-4 mb-3">
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                      <div className="text-xs text-gray-500 mb-1">Marge</div>
                                      <div className="text-lg font-black text-gray-900">
                                        {snap.marginPct.toFixed(2)} %
                                      </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                      <div className="text-xs text-gray-500 mb-1">
                                        {snap.action === "DAILY_UPDATE" ? "Budget de l'entrée" : "Budget Cumulé"}
                                      </div>
                                      <div className="text-lg font-black text-gray-900">
                                        {snap.budgetSpent.toLocaleString()} {currSym}
                                      </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                      <div className="text-xs text-gray-500 mb-1">CPM Cost</div>
                                      <div className="text-lg font-black text-gray-900">
                                        {snap.cpmCostActuel.toFixed(2)} {currSym}
                                      </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                      <div className="text-xs text-gray-500 mb-1">Gain Réalisé</div>
                                      <div className="text-lg font-black text-emerald-600">
                                        {snap.gainRealized.toFixed(0)} {currSym}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {snap.note && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
                                      <strong>Note :</strong> {snap.note}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-white border border-gray-100 rounded-xl p-6 mt-8">
                        <h4 className="font-bold text-gray-900 mb-4">Évolution de la Marge</h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart 
                              data={project.history.map(snap => ({
                                date: new Date(snap.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
                                marge: snap.marginPct,
                                gain: snap.gainRealized
                              }))}
                              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis 
                                yAxisId="left"
                                tick={{ fontSize: 12, fill: '#64748b' }} 
                                axisLine={false} 
                                tickLine={false}
                                tickFormatter={(val) => `${val.toFixed(0)}%`}
                              />
                              <YAxis 
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: 12, fill: '#64748b' }} 
                                axisLine={false} 
                                tickLine={false}
                                tickFormatter={(val) => `${val.toFixed(2)}${currSym}`}
                              />
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number, name: string) => {
                                  if (name === `Gain (${currSym})`) {
                                    return [`${value.toFixed(2)} ${currSym}`, name];
                                  }
                                  return [`${value.toFixed(2)}%`, name];
                                }}
                              />
                              <Legend />
                              <Line 
                                yAxisId="left"
                                type="monotone" 
                                dataKey="marge" 
                                stroke="#3b82f6" 
                                strokeWidth={3} 
                                name="Marge %"
                                dot={{ r: 4 }}
                              />
                              <Line 
                                yAxisId="right"
                                type="monotone" 
                                dataKey="gain" 
                                stroke="#10b981" 
                                strokeWidth={3} 
                                name={`Gain (${currSym})`}
                                dot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === "notes" && (
                <div className="space-y-6">
                  {!project?.id ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
                      <div className="text-4xl mb-3">⚠️</div>
                      <h4 className="font-bold text-amber-900 mb-2">Projet non sauvegardé</h4>
                      <p className="text-sm text-amber-700">
                        Vous devez sauvegarder votre projet avant de pouvoir ajouter des notes.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">Notes de campagne</h3>
                        <div className="text-sm text-gray-500">
                          {project.notes?.length || 0} note(s)
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">✍️</span>
                          Ajouter une note
                        </h4>
                        <textarea
                          id="note-input"
                          placeholder="Écrivez votre note ici..."
                          className="w-full h-32 text-sm border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                        />
                        <div className="flex justify-end mt-3">
                          <button
                            onClick={() => {
                              const input = document.getElementById('note-input') as HTMLTextAreaElement;
                              const content = input?.value.trim();
                              
                              if (!content) {
                                alert("Veuillez écrire une note avant de sauvegarder.");
                                return;
                              }
                              
                              const newNote: ProjectNote = {
                                id: Date.now().toString(),
                                timestamp: new Date().toISOString(),
                                content
                              };
                              
                              const updatedNotes = [...(project.notes || []), newNote];
                              
                              onChange({
                                ...project,
                                notes: updatedNotes,
                                updatedAt: new Date().toISOString()
                              });
                              
                              input.value = '';
                              alert("✅ Note sauvegardée !");
                            }}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                          >
                            💾 Sauvegarder la note
                          </button>
                        </div>
                      </div>

                      {(!project.notes || project.notes.length === 0) ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                          <div className="text-4xl mb-3">📝</div>
                          <h4 className="font-bold text-gray-700 mb-1">Aucune note</h4>
                          <p className="text-sm text-gray-500">
                            Ajoutez votre première note pour documenter vos optimisations.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {[...project.notes].reverse().map((note) => {
                            const date = new Date(note.timestamp);
                            const isToday = date.toDateString() === new Date().toDateString();
                            
                            return (
                              <div key={note.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                      📝
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        {date.toLocaleDateString('fr-FR', { 
                                          weekday: 'long',
                                          day: 'numeric', 
                                          month: 'long', 
                                          year: 'numeric'
                                        })}
                                      </div>
                                      <div className="text-xs text-gray-400 mt-0.5">
                                        {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        {isToday && (
                                          <span className="ml-2 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                            AUJOURD'HUI
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (confirm("Supprimer cette note ?")) {
                                        const updatedNotes = project.notes?.filter(n => n.id !== note.id) || [];
                                        onChange({
                                          ...project,
                                          notes: updatedNotes,
                                          updatedAt: new Date().toISOString()
                                        });
                                      }
                                    }}
                                    className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {note.content}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function MetricCard({ title, value, subValue, accent, icon: Icon }: { title: string, value: string, subValue?: string, accent: "indigo" | "emerald" | "red", icon: any }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[110px]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{title}</div>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          accent === "indigo" ? "bg-blue-50 text-blue-600" :
          accent === "emerald" ? "bg-emerald-50 text-emerald-600" :
          "bg-red-50 text-red-600"
        )}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-black text-gray-900">{value}</div>
        {subValue && (
          <div className={cn("text-xs font-bold mt-1.5 flex items-center gap-1", 
            accent === "emerald" ? "text-emerald-500" : 
            accent === "red" ? "text-red-500" : "text-gray-500"
          )}>
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}
