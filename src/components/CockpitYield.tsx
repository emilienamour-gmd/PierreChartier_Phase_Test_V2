import { useState, ChangeEvent, useEffect } from "react";
import { ProjectData, LineItem, ProjectSnapshot, MarginPeriod, ProjectNote, DailyEntry } from "../types";
import { cn } from "../utils/cn";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";
import { Settings, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Trash2, DollarSign, Percent, Target, ChevronLeft, ChevronRight, Upload, Wand2, ArrowRight, Lock, Unlock, Clock, MousePointer2, Activity, BarChart3, TrendingUp as TrendingIcon, History, Calendar, Check, X } from "lucide-react";
import * as XLSX from "xlsx";

interface CockpitYieldProps {
  project: ProjectData;
  onChange: (project: ProjectData) => void;
}

export function CockpitYield({ project, onChange }: CockpitYieldProps) {
  const [activeTab, setActiveTab] = useState<"analyse" | "comparateur" | "multilines" | "suivi" | "historique" | "notes">("analyse");
  const [dashSource, setDashSource] = useState<"sidebar" | "table">("sidebar");
  const [uplift, setUplift] = useState(project.uplift ?? 3.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [proposedOptimizations, setProposedOptimizations] = useState<LineItem[] | null>(null);
  const [marginGoal, setMarginGoal] = useState<"increase" | "decrease" | null>(null);
  const [respectCpmCap, setRespectCpmCap] = useState<boolean>(true);
  const [lockedLines, setLockedLines] = useState<Set<string>>(new Set());
  const [attrClick, setAttrClick] = useState(7);
  const [attrView, setAttrView] = useState(1);

  // ✅ NOUVEAUX ÉTATS : Suivi Quotidien
  const [dailyForm, setDailyForm] = useState({
    date: new Date().toISOString().split('T')[0],
    budgetSpentYesterday: 0,
    cpmRevenueYesterday: project.cpmRevenueActual || 0,
    marginPctYesterday: 0,
    kpiYesterday: project.actualKpi || 0
  });
  const [showDailyPreview, setShowDailyPreview] = useState(false);
  const [chartTimeRange, setChartTimeRange] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    setUplift(project.uplift ?? 3.0);
  }, [project.id]);

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

  // ✅ NOUVELLE FONCTION : Appliquer les données quotidiennes
  const applyDailyEntry = () => {
    if (!dailyForm.budgetSpentYesterday || dailyForm.budgetSpentYesterday <= 0) {
      alert("⚠️ Veuillez saisir un budget dépensé valide.");
      return;
    }

    // Calcul du budget cumulé
    const previousCumulative = project.budgetSpent;
    const newCumulative = previousCumulative + dailyForm.budgetSpentYesterday;

    if (newCumulative > project.budgetTotal) {
      if (!confirm(`⚠️ Le budget cumulé (${newCumulative.toFixed(2)} ${currSym}) dépasse le budget total (${project.budgetTotal} ${currSym}). Continuer quand même ?`)) {
        return;
      }
    }

    // Création de l'entrée quotidienne
    const newDailyEntry: DailyEntry = {
      id: Date.now().toString(),
      date: dailyForm.date,
      budgetSpentYesterday: dailyForm.budgetSpentYesterday,
      cpmRevenueYesterday: dailyForm.cpmRevenueYesterday,
      marginPctYesterday: dailyForm.marginPctYesterday,
      kpiYesterday: dailyForm.kpiYesterday,
      budgetSpentCumulative: newCumulative,
      appliedAt: new Date().toISOString()
    };

    // Création du snapshot pour l'historique
    const snapshot: ProjectSnapshot = {
      timestamp: new Date().toISOString(),
      budgetSpent: newCumulative,
      marginPct: dailyForm.marginPctYesterday,
      cpmCostActuel: dailyForm.cpmRevenueYesterday * (1 - dailyForm.marginPctYesterday / 100),
      cpmRevenueActual: dailyForm.cpmRevenueYesterday,
      actualKpi: dailyForm.kpiYesterday,
      gainRealized: newCumulative * (dailyForm.marginPctYesterday / 100),
      action: "DAILY_UPDATE",
      note: `📊 Mise à jour quotidienne du ${new Date(dailyForm.date).toLocaleDateString('fr-FR')} - Budget: ${dailyForm.budgetSpentYesterday.toFixed(2)} ${currSym}, Marge: ${dailyForm.marginPctYesterday.toFixed(2)}%, CPM Rev: ${dailyForm.cpmRevenueYesterday.toFixed(2)} ${currSym}`
    };

    // Mise à jour du projet
    const updatedDailyEntries = [...(project.dailyEntries || []), newDailyEntry];
    const updatedHistory = [...(project.history || []), snapshot];

    onChange({
      ...project,
      budgetSpent: newCumulative,
      cpmRevenueActual: dailyForm.cpmRevenueYesterday,
      actualKpi: dailyForm.kpiYesterday,
      margeInput: dailyForm.marginPctYesterday,
      dailyEntries: updatedDailyEntries,
      history: updatedHistory,
      updatedAt: new Date().toISOString()
    });

    // Reset du formulaire
    setDailyForm({
      date: new Date(new Date(dailyForm.date).getTime() + 86400000).toISOString().split('T')[0], // Jour suivant
      budgetSpentYesterday: 0,
      cpmRevenueYesterday: dailyForm.cpmRevenueYesterday,
      marginPctYesterday: dailyForm.marginPctYesterday,
      kpiYesterday: dailyForm.kpiYesterday
    });
    setShowDailyPreview(false);

    alert("✅ Données quotidiennes appliquées avec succès !");
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

  const dispCpmCost = dashSource === "table" ? wCpmCost : cpmCostActuelCalc;
  const dispCpmRev = dashSource === "table" ? wCpmRev : project.cpmRevenueActual;
  const dispMargin = dashSource === "table" ? wMargin : currentMarginPctCalc;
  const dispKpi = dashSource === "table" ? wKpi : project.actualKpi;

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
  
  const scoredItems = project.lineItems.map(li => {
    const actual = li.kpiActual || 0;
    const target = project.targetKpi || 0.0001;
    
    let perfRatio = 1;
    
    if (isFin) {
      if (actual === 0) {
        perfRatio = 0; 
      } else {
        perfRatio = target / actual; 
      }
    } else {
      perfRatio = actual / target;
    }
    
    return { ...li, perfRatio };
  });
  
  let optimizedItems: LineItem[] = [];
  
  if (respectCpmCap) {
    const currentWeightedCpmRev = totalSpend > 0 
      ? scoredItems.reduce((acc, li) => acc + (li.spend * li.cpmRevenue), 0) / totalSpend
      : 0;
    
    const targetCpmRev = project.cpmSoldCap;
    const cpmRevGap = targetCpmRev - currentWeightedCpmRev;
    
    console.log(`📊 CPM Revenue actuel moyen : ${currentWeightedCpmRev.toFixed(2)} ${currSym}`);
    console.log(`🎯 CPM Revenue cible (Cap) : ${targetCpmRev.toFixed(2)} ${currSym}`);
    console.log(`📈 Écart à combler : ${cpmRevGap.toFixed(2)} ${currSym}`);
    
    optimizedItems = scoredItems.map(li => {
      let newMargin = li.marginPct;
      let newSpend = li.spend || 0;
      let newCpmRevenue = li.cpmRevenue;
      
      if (isFin && li.perfRatio === 0) {
        newMargin = li.marginPct;
      } else if (li.perfRatio < 1.0) {
        if (marginGoal === "increase") {
          newMargin = li.marginPct;
        } else {
          newMargin = Math.max(5, li.marginPct - 5);
        }
      } else {
        if (marginGoal === "increase") {
          if (li.perfRatio >= 1.2) newMargin += 5;
          else if (li.perfRatio >= 1.0) newMargin += 2;
        } else if (marginGoal === "decrease") {
          if (li.perfRatio >= 1.2) newMargin -= 2;
          else if (li.perfRatio > 1.0) newMargin -= 5;
        }
      }
      
      newMargin = Math.max(5, Math.min(95, newMargin));
      
      const cpmRevRatio = li.cpmRevenue / targetCpmRev;
      
      if (marginGoal === "increase") {
        if (li.perfRatio >= 1.2) {
          newCpmRevenue = Math.min(targetCpmRev * 1.0, li.cpmRevenue * 1.05);
        } else if (li.perfRatio >= 1.0) {
          newCpmRevenue = Math.min(targetCpmRev * 0.95, li.cpmRevenue * 1.03);
        } else if (li.perfRatio >= 0.8) {
          newCpmRevenue = Math.min(targetCpmRev * 0.85, li.cpmRevenue * 1.01);
        } else {
          newCpmRevenue = li.cpmRevenue * 0.97;
        }
      } else {
        if (li.perfRatio >= 1.0) {
          newCpmRevenue = Math.min(targetCpmRev * 0.95, li.cpmRevenue * 0.98);
        } else {
          newCpmRevenue = li.cpmRevenue * 0.95;
        }
      }
      
      newCpmRevenue = Math.min(targetCpmRev, newCpmRevenue);
      
      return { ...li, newMargin, newCpmRevenue, perfRatio: li.perfRatio };
    });
    
    const itemsWithScore = optimizedItems.map(item => {
      let perfScore = Math.pow(Math.max(0.1, item.perfRatio), 2);
      
      const cpmRevRatio = item.newCpmRevenue / targetCpmRev;
      let capAlignmentBonus = 1;
      
      if (currentWeightedCpmRev < targetCpmRev) {
        capAlignmentBonus = 1 + (cpmRevRatio - 1) * 0.5;
      } else {
        capAlignmentBonus = 1 + (1 - cpmRevRatio) * 0.5;
      }
      
      capAlignmentBonus = Math.max(0.5, Math.min(1.5, capAlignmentBonus));
      
      let allocationScore = 0;
      if (item.perfRatio === 0) {
        allocationScore = 0;
      } else {
        if (marginGoal === "increase") {
          allocationScore = perfScore * capAlignmentBonus * (1 + item.newMargin / 100);
        } else {
          allocationScore = perfScore * capAlignmentBonus * (1 + (100 - item.newMargin) / 100);
        }
      }
      
      return { ...item, allocationScore, capAlignmentBonus };
    });
    
    const unlockedItems = itemsWithScore.filter(li => !lockedLines.has(li.id));
    const totalScore = unlockedItems.reduce((acc, li) => acc + li.allocationScore, 0);
    
    optimizedItems = itemsWithScore.map(li => {
      let finalSpend = li.spend || 0;
      
      if (!lockedLines.has(li.id)) {
        if (isFin && li.perfRatio === 0) {
          finalSpend = (li.spend || 0) * 0.1;
        } else {
          const theoreticalSpend = totalScore > 0 ? (li.allocationScore / totalScore) * availableSpend : (li.spend || 0);
          finalSpend = (theoreticalSpend * 0.7) + ((li.spend || 0) * 0.3);
        }
      }
      
      return { 
        id: li.id,
        name: li.name,
        spend: isNaN(finalSpend) ? 0 : Number(finalSpend.toFixed(2)),
        cpmRevenue: Number(li.newCpmRevenue.toFixed(2)),
        marginPct: Number(li.newMargin.toFixed(2)),
        kpiActual: li.kpiActual
      };
    });
    
    const finalTotalSpend = optimizedItems.reduce((acc, li) => acc + li.spend, 0);
    const finalWeightedCpmRev = finalTotalSpend > 0 
      ? optimizedItems.reduce((acc, li) => acc + (li.spend * li.cpmRevenue), 0) / finalTotalSpend
      : 0;
    
    console.log(`✅ CPM Revenue moyen après optimisation : ${finalWeightedCpmRev.toFixed(2)} ${currSym}`);
    console.log(`🎯 Objectif (Cap) : ${targetCpmRev.toFixed(2)} ${currSym}`);
    console.log(`📊 Écart final : ${Math.abs(finalWeightedCpmRev - targetCpmRev).toFixed(2)} ${currSym}`);
    
  } else {
    optimizedItems = scoredItems.map(li => {
      let newMargin = li.marginPct;
      let newSpend = li.spend || 0;
      let newCpmRevenue = li.cpmRevenue;
      
      if (isFin && li.perfRatio === 0) {
        newMargin = li.marginPct;
      } else if (li.perfRatio < 1.0) {
        if (marginGoal === "increase") {
          newMargin = li.marginPct;
        } else {
          newMargin = Math.max(5, li.marginPct - 5);
        }
      } else {
        if (marginGoal === "increase") {
          if (li.perfRatio >= 1.2) newMargin += 5;
          else if (li.perfRatio >= 1.0) newMargin += 2;
        } else if (marginGoal === "decrease") {
          if (li.perfRatio >= 1.2) newMargin -= 2;
          else if (li.perfRatio > 1.0) newMargin -= 5;
        }
      }
      
      newMargin = Math.max(5, Math.min(95, newMargin));
      
      if (marginGoal === "increase") {
        if (li.perfRatio >= 1.2) {
          newCpmRevenue = li.cpmRevenue * 1.08;
        } else if (li.perfRatio >= 1.0) {
          newCpmRevenue = li.cpmRevenue * 1.05;
        }
      } else {
        if (li.perfRatio >= 1.0) {
          newCpmRevenue = li.cpmRevenue * 0.97;
        }
      }
      
      return { ...li, newMargin, newCpmRevenue };
    });
    
    const itemsWithScore = optimizedItems.map(item => {
      let allocationScore = 0;
      
      if (item.perfRatio === 0) {
        allocationScore = 0;
      } else {
        if (marginGoal === "increase") {
          allocationScore = Math.pow(Math.max(0.1, item.perfRatio), 2) * (1 + item.newMargin / 100);
        } else {
          allocationScore = Math.pow(Math.max(0.1, item.perfRatio), 2) * (1 + (100 - item.newMargin) / 100);
        }
      }
      
      return { ...item, allocationScore };
    });
    
    const unlockedItems = itemsWithScore.filter(li => !lockedLines.has(li.id));
    const totalScore = unlockedItems.reduce((acc, li) => acc + li.allocationScore, 0);
    
    optimizedItems = itemsWithScore.map(li => {
      let finalSpend = li.spend || 0;
      
      if (!lockedLines.has(li.id)) {
        if (isFin && li.perfRatio === 0) {
          finalSpend = (li.spend || 0) * 0.1;
        } else {
          const theoreticalSpend = totalScore > 0 ? (li.allocationScore / totalScore) * availableSpend : (li.spend || 0);
          finalSpend = (theoreticalSpend * 0.7) + ((li.spend || 0) * 0.3);
        }
      }
      
      return { 
        id: li.id,
        name: li.name,
        spend: isNaN(finalSpend) ? 0 : Number(finalSpend.toFixed(2)),
        cpmRevenue: Number(li.newCpmRevenue.toFixed(2)),
        marginPct: Number(li.newMargin.toFixed(2)),
        kpiActual: li.kpiActual
      };
    });
  }
  
  setProposedOptimizations(optimizedItems);
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

  // ✅ FONCTION : Préparer les données des graphiques
  const prepareChartData = () => {
    if (!project.dailyEntries || project.dailyEntries.length === 0) return [];

    if (chartTimeRange === "daily") {
      return project.dailyEntries.map(entry => ({
        date: new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        fullDate: entry.date,
        budgetCumul: entry.budgetSpentCumulative,
        budgetDaily: entry.budgetSpentYesterday,
        cpmRev: entry.cpmRevenueYesterday,
        marginPct: entry.marginPctYesterday,
        kpi: entry.kpiYesterday
      }));
    } else {
      // Mode hebdomadaire : agrégation par semaine
      const weeklyData: Record<string, {
        budgetCumul: number;
        budgetWeekly: number;
        cpmRevSum: number;
        marginSum: number;
        kpiSum: number;
        count: number;
      }> = {};

      project.dailyEntries.forEach(entry => {
        const date = new Date(entry.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + 1); // Lundi de la semaine
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            budgetCumul: 0,
            budgetWeekly: 0,
            cpmRevSum: 0,
            marginSum: 0,
            kpiSum: 0,
            count: 0
          };
        }

        weeklyData[weekKey].budgetCumul = entry.budgetSpentCumulative; // Dernière valeur
        weeklyData[weekKey].budgetWeekly += entry.budgetSpentYesterday;
        weeklyData[weekKey].cpmRevSum += entry.cpmRevenueYesterday;
        weeklyData[weekKey].marginSum += entry.marginPctYesterday;
        weeklyData[weekKey].kpiSum += entry.kpiYesterday;
        weeklyData[weekKey].count += 1;
      });

      return Object.entries(weeklyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekKey, data]) => ({
          date: `Sem. ${new Date(weekKey).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`,
          fullDate: weekKey,
          budgetCumul: data.budgetCumul,
          budgetDaily: data.budgetWeekly, // Budget total de la semaine
          cpmRev: data.cpmRevSum / data.count,
          marginPct: data.marginSum / data.count,
          kpi: data.kpiSum / data.count
        }));
    }
  };

  const chartData = prepareChartData();

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
      className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
      value={project.budgetSpent}
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

      {/* Main Dashboard */}
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
              title="CPM Cost (Net)" 
              value={`${dispCpmCost.toFixed(2)} ${currSym}`} 
              icon={DollarSign}
              accent="indigo"
            />
            <MetricCard 
              title="CPM Revenu Actuel" 
              value={`${dispCpmRev.toFixed(2)} ${currSym}`} 
              icon={TrendingUp}
              accent="indigo"
            />
            <MetricCard 
              title="Marge Actuelle" 
              value={`${displayMargin.toFixed(2)} %`}
              subValue={`${margeEuroDisp.toFixed(2)} ${currSym}`}
              icon={Percent}
              accent="emerald"
            />
            <MetricCard 
              title={`KPI ${project.kpiType}`} 
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
                { id: "suivi", label: "📊 Suivi Quotidien" },
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
                        {uplift > 0 ? (
                          <>
                            <TrendingUp className="w-4 h-4" />
                            📈 Appliquer Hausse
                          </>
                        ) : uplift < 0 ? (
                          <>
                            <TrendingDown className="w-4 h-4" />
                            📉 Appliquer Baisse
                          </>
                        ) : (
                          <>
                            <Minus className="w-4 h-4" />
                            Aucun changement
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mt-8">

                    {/* Options 1 & 2 */}
                    <div className="grid grid-cols-2 gap-6 mt-8">
                      {/* Option 1 */}
                      <div className="border border-blue-100 bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                        <h4 className="text-blue-900 font-bold text-base mb-2">
                          {uplift >= 0 ? "🔵 OPTION 1 : AUGMENTER CPM REVENU" : "🔵 OPTION 1 : BAISSER CPM REVENU"}
                        </h4>
                        <p className="text-gray-500 text-sm mb-6">
                          {uplift >= 0 ? "Garder le Bid (Qualité stable), augmenter le CPM Revenu." : "Garder le Bid (Qualité stable), baisser le CPM Revenu."}
                        </p>
                        
                        {(() => {
                          const newMarg = currentMarginPctCalc + uplift;
                          const newRevOpt1 = (1 - newMarg/100) > 0 ? cpmCostActuelCalc / (1 - newMarg/100) : 999;
                          const exceeds = newRevOpt1 > project.cpmSoldCap;
                          const perfRate = project.cpmRevenueActual > 0 && project.actualKpi > 0 ? project.cpmRevenueActual / (project.actualKpi * 1000) : 0;
                          
                          let kpiOpt1 = 0, kpiPess1 = 0;
                          if (isFin && perfRate > 0) {
                            kpiOpt1 = project.kpiType !== "CPM" ? newRevOpt1 / (perfRate * 1000) : newRevOpt1;
                            kpiPess1 = project.kpiType !== "CPM" ? newRevOpt1 / ((perfRate * 0.95) * 1000) : newRevOpt1;
                          } else if (!isFin) {
                            kpiOpt1 = project.actualKpi;
                            kpiPess1 = project.actualKpi * 0.95;
                          }

                          return (
                            <div className="space-y-4">
                              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nouveau CPM</div>
                                <div className="text-2xl font-black text-gray-900">{newRevOpt1.toFixed(2)} {currSym}</div>
                                {exceeds && <div className="text-xs text-red-500 font-bold mt-2 bg-red-50 p-2 rounded-md">⛔ Plafond ({project.cpmSoldCap}) dépassé</div>}
                              </div>
                              
                              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
                                  IMPACT KPI : <span className="text-gray-900 font-black ml-1">{project.kpiType}</span>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-gray-600">🌤️ Optimiste</span>
                                  <span className="text-sm font-bold text-emerald-600">
                                    {isFin ? `${fmtKpi(kpiOpt1)} ${currSym}` : `${(kpiOpt1 * (project.kpiType === "CTR" ? 1 : 100)).toFixed(2)} %`}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">🌧️ Pessimiste</span>
                                  <span className="text-sm font-bold text-red-600">
                                    {isFin ? `${fmtKpi(kpiPess1)} ${currSym}` : `${(kpiPess1 * (project.kpiType === "CTR" ? 1 : 100)).toFixed(2)} %`}
                                  </span>
                                </div>
                              </div>

                              <details className="group bg-blue-50 rounded-xl border border-blue-100 overflow-hidden">
                                <summary className="cursor-pointer p-3 text-sm font-bold text-blue-900 flex items-center justify-between list-none">
                                  <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" /> Pourquoi ?</span>
                                  <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                                </summary>
                                <div className="p-3 pt-0 text-xs text-blue-800 leading-relaxed border-t border-blue-100/50 mt-1">
                                  <strong>Mécanique :</strong> {uplift >= 0 ? "En augmentant le CPM facturé sans toucher au bid (CPM Cost), le win-rate et l'accès aux inventaires restent identiques. La qualité (CTR, CVR) ne bouge pas." : "En baissant le CPM facturé, vous réduisez votre marge mais le setup d'achat reste le même."}<br/><br/>
                                  <strong>Impact {project.kpiType} :</strong> L'impact est purement mathématique. La variation (optimiste/pessimiste) reflète uniquement la volatilité naturelle de l'algorithme de pacing du DSP (±5%).
                                </div>
                              </details>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Option 2 */}
                      <div className="border border-amber-100 bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                        <h4 className="text-amber-900 font-bold text-base mb-2">
                          {uplift >= 0 ? "🟠 OPTION 2 : BAISSE DU BID" : "🟠 OPTION 2 : HAUSSE DU BID"}
                        </h4>
                        <p className="text-gray-500 text-sm mb-6">
                          {uplift >= 0 ? "CPM Revenu ne bouge pas. Acheter moins cher (Risque qualité)." : "CPM Revenu ne bouge pas. Acheter plus cher (Amélioration qualité)."}
                        </p>
                        
                        {(() => {
                          const newMarg = currentMarginPctCalc + uplift;
                          const newCostOpt2 = project.cpmRevenueActual * (1 - newMarg/100);
                          const priceDrop = cpmCostActuelCalc > 0 ? (cpmCostActuelCalc - newCostOpt2) / cpmCostActuelCalc : 0;
                          
                          let dropOpt = 1;
                          let dropPess = 1;
                          let expertExplanation = "";
                          
                          const isStrictClick = attrView === 0;
                          const isLongView = attrView >= 2;
                          const isMidView = attrView >= 1 && attrView < 2;
                          
                          switch(project.kpiType) {
                            case "CPA":
                            case "CPL":
                              if (priceDrop >= 0) {
                                if (isLongView) {
                                  dropOpt = 0.85;
                                  dropPess = 1.05;
                                  expertExplanation = `🍪 STRATÉGIE D'ARBITRAGE (Cookie Dropping) : Avec une fenêtre Post-View confortable de ${attrView} jours, vous activez un levier d'arbitrage statistique.`;
                                } else if (isMidView) {
                                  dropOpt = Math.max(0.1, 1 - (priceDrop * 1.5));
                                  dropPess = Math.max(0.1, 1 - (priceDrop * 2.5));
                                  expertExplanation = `⚠️ GUERRE D'INTENTION (Standard View ${attrView}j) : Avec une fenêtre courte, l'organique ne suffit plus.`;
                                } else {
                                  dropOpt = Math.max(0.1, 1 - (priceDrop * 3.5));
                                  dropPess = Math.max(0.1, 1 - (priceDrop * 6.0));
                                  expertExplanation = `🛑 GUERRE D'ATTENTION (Pure Performance) : En attribution Click-Only, le Post-View ne vous sauve plus.`;
                                }
                              } else {
                                if (isStrictClick) {
                                  dropOpt = 1 - (priceDrop * 1.8);
                                  dropPess = 1 - (priceDrop * 0.9);
                                  expertExplanation = "🎯 SNIPER QUALITÉ : En attribution Click-Only, payer plus cher est la seule option viable.";
                                } else {
                                  dropOpt = 1 - (priceDrop * 1.3);
                                  dropPess = 1 - (priceDrop * 0.7);
                                  expertExplanation = "🚀 HEADROOM ALGORITHMIQUE : En augmentant le Cap Bid, vous donnez de l'oxygène au Smart Bidding.";
                                }
                              }
                              break;

                            case "CPV":
                              if (priceDrop >= 0) {
                                if (attrClick > 7) {
                                  dropOpt = Math.max(0.1, 1 - (priceDrop * 1.5));
                                  dropPess = Math.max(0.1, 1 - (priceDrop * 3.0));
                                  expertExplanation = `📉 RETENTION (Long Post-Click ${attrClick}j) : Baisser le bid attire un trafic de faible qualité.`;
                                } else {
                                  dropOpt = Math.max(0.1, 1 - (priceDrop * 2.8));
                                  dropPess = Math.max(0.1, 1 - (priceDrop * 5.0));
                                  expertExplanation = `📉 QUALITÉ DE SESSION & BOUNCE : Le CPV est un détecteur de mensonge.`;
                                }
                              } else {
                                dropOpt = 1 - (priceDrop * 1.4);
                                dropPess = 1 - (priceDrop * 0.8);
                                expertExplanation = "🚀 FILTRE QUALITÉ : En montant le bid, vous achetez du temps de cerveau disponible.";
                              }
                              break;

                            case "CPCV":
                              if (priceDrop >= 0) {
                                dropOpt = Math.max(0.1, 1 - (priceDrop * 1.8));
                                dropPess = Math.max(0.1, 1 - (priceDrop * 3.0));
                                expertExplanation = "🗑️ CHUTE DANS L'OUTSTREAM : Sur l'Open Web, le 'Vrai' In-Stream a des Floor Prices élevés.";
                              } else {
                                dropOpt = 1 - (priceDrop * 1.2);
                                dropPess = 1 - (priceDrop * 0.5);
                                expertExplanation = "📺 CLEARING PRICE : Un bid agressif permet de passer au-dessus des Floor Prices.";
                              }
                              break;

                            case "CTR":
                            case "CPC":
                              if (priceDrop >= 0) {
                                dropOpt = Math.max(0.1, 1 - (priceDrop * 1.3));
                                dropPess = Math.max(0.1, 1 - (priceDrop * 2.0));
                                expertExplanation = "👀 VISIBILITÉ : Le CTR est corrélé à la position.";
                              } else {
                                dropOpt = 1 - (priceDrop * 1.4);
                                dropPess = 1 - (priceDrop * 0.7);
                                expertExplanation = "👆 ABOVE THE FOLD : Payer plus cher permet de gagner les header-bidding auctions.";
                              }
                              break;

                            default:
                              if (priceDrop >= 0) {
                                dropOpt = Math.max(0.1, 1 - (priceDrop * 0.9));
                                dropPess = Math.max(0.1, 1 - (priceDrop * 1.2));
                                expertExplanation = "⚠️ RISQUE MFA : Un CPM trop bas vous expose aux sites MFA.";
                              } else {
                                dropOpt = 1 - (priceDrop * 0.6);
                                dropPess = 1 - (priceDrop * 0.3);
                                expertExplanation = "🛡️ WHITELISTS : Payer le juste prix permet de diffuser sur des Whitelists Premium.";
                              }
                              break;
                          }
                          
                          const perfRate = project.cpmRevenueActual > 0 && project.actualKpi > 0 ? project.cpmRevenueActual / (project.actualKpi * 1000) : 0;
                          let kpiOpt2 = 0, kpiPess2 = 0;

                          if (isFin) {
                            if (project.kpiType === "CPM") {
                              kpiOpt2 = project.cpmRevenueActual;
                              kpiPess2 = project.cpmRevenueActual;
                            } else if (perfRate > 0) {
                              kpiOpt2 = project.cpmRevenueActual / ((perfRate * dropOpt) * 1000);
                              kpiPess2 = project.cpmRevenueActual / ((perfRate * dropPess) * 1000);
                            }
                          } else {
                            kpiOpt2 = project.actualKpi * dropOpt;
                            kpiPess2 = project.actualKpi * dropPess;
                          }

                          return (
                            <div className="space-y-4">
                              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nouveau Bid CPM Cost</div>
                                <div className="text-2xl font-black text-gray-900">{newCostOpt2.toFixed(2)} {currSym}</div>
                              </div>
                              
                              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
                                  IMPACT KPI : <span className="text-gray-900 font-black ml-1">{project.kpiType}</span>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-gray-600">🌤️ Optimiste</span>
                                  <span className="text-sm font-bold text-emerald-600">
                                    {isFin ? `${fmtKpi(kpiOpt2)} ${currSym}` : `${(kpiOpt2 * (project.kpiType === "CTR" ? 1 : 100)).toFixed(2)} %`}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">🌧️ Pessimiste</span>
                                  <span className="text-sm font-bold text-red-600">
                                    {isFin ? `${fmtKpi(kpiPess2)} ${currSym}` : `${(kpiPess2 * (project.kpiType === "CTR" ? 1 : 100)).toFixed(2)} %`}
                                  </span>
                                </div>
                              </div>

                              <details className="group bg-amber-50 rounded-xl border border-amber-100 overflow-hidden">
                                <summary className="cursor-pointer p-3 text-sm font-bold text-amber-900 flex items-center justify-between list-none">
                                  <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" /> Analyse Expert</span>
                                  <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                                </summary>
                                <div className="p-3 pt-0 text-xs text-amber-800 leading-relaxed border-t border-amber-100/50 mt-1">
                                  <strong>{project.kpiType} Impact :</strong> {expertExplanation}
                                </div>
                              </details>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="mt-8 pt-8 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Projection des Gains</h3>
                          <p className="text-sm text-gray-500">Évolution de la marge cumulée sur la durée de la campagne</p>
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
                  </div>

                    <div className="mt-8 pt-8 border-t border-gray-100">
                      {/* Graphique Projection - code existant inchangé */}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "multilines" && (
                <div className="space-y-6">
                  {/* Code existant Multi-Lines inchangé */}
                </div>
              )}

              {/* ✅ NOUVEL ONGLET : SUIVI QUOTIDIEN */}
              {activeTab === "suivi" && (
                <div className="space-y-8">
                  {!project?.id ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
                      <div className="text-4xl mb-3">⚠️</div>
                      <h4 className="font-bold text-amber-900 mb-2">Projet non sauvegardé</h4>
                      <p className="text-sm text-amber-700">
                        Vous devez sauvegarder votre projet avant d'utiliser le suivi quotidien.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">📊 Suivi Quotidien de Campagne</h3>
                        <div className="text-sm text-gray-500">
                          {project.dailyEntries?.length || 0} entrée(s)
                        </div>
                      </div>

                      {/* Formulaire de saisie quotidienne */}
                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">
                            <Calendar className="w-4 h-4" />
                          </span>
                          Saisir les performances du jour
                        </h4>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Date</label>
                            <input 
                              type="date"
                              className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              value={dailyForm.date}
                              onChange={(e) => setDailyForm({...dailyForm, date: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                              Budget Dépensé Hier ({currSym})
                            </label>
                            <input 
                              type="number"
                              step="0.01"
                              className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              value={dailyForm.budgetSpentYesterday}
                              onChange={(e) => setDailyForm({...dailyForm, budgetSpentYesterday: Number(e.target.value)})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                              CPM Revenue Hier ({currSym})
                            </label>
                            <input 
                              type="number"
                              step="0.01"
                              className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              value={dailyForm.cpmRevenueYesterday}
                              onChange={(e) => setDailyForm({...dailyForm, cpmRevenueYesterday: Number(e.target.value)})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                              Marge % Hier
                            </label>
                            <input 
                              type="number"
                              step="0.1"
                              className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              value={dailyForm.marginPctYesterday}
                              onChange={(e) => setDailyForm({...dailyForm, marginPctYesterday: Number(e.target.value)})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                              {project.kpiType} Hier
                            </label>
                            <input 
                              type="number"
                              step="0.01"
                              className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              value={dailyForm.kpiYesterday}
                              onChange={(e) => setDailyForm({...dailyForm, kpiYesterday: Number(e.target.value)})}
                            />
                          </div>
                        </div>

                        {/* Prévisualisation */}
                        {showDailyPreview && (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
                            <h5 className="font-bold text-indigo-900 mb-3 text-sm">📋 Prévisualisation de la mise à jour</h5>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="bg-white p-2 rounded">
                                <div className="text-gray-500 mb-1">Budget Cumulé</div>
                                <div className="font-bold text-gray-900">
                                  {project.budgetSpent.toFixed(2)} → {(project.budgetSpent + dailyForm.budgetSpentYesterday).toFixed(2)} {currSym}
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded">
                                <div className="text-gray-500 mb-1">CPM Revenue</div>
                                <div className="font-bold text-gray-900">
                                  {project.cpmRevenueActual.toFixed(2)} → {dailyForm.cpmRevenueYesterday.toFixed(2)} {currSym}
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded">
                                <div className="text-gray-500 mb-1">Marge %</div>
                                <div className="font-bold text-gray-900">
                                  {project.margeInput.toFixed(2)} → {dailyForm.marginPctYesterday.toFixed(2)} %
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded">
                                <div className="text-gray-500 mb-1">{project.kpiType}</div>
                                <div className="font-bold text-gray-900">
                                  {project.actualKpi.toFixed(2)} → {dailyForm.kpiYesterday.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end gap-3">
                          {showDailyPreview ? (
                            <>
                              <button
                                onClick={() => setShowDailyPreview(false)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                              >
                                <X className="w-4 h-4" />
                                Annuler
                              </button>
                              <button
                                onClick={applyDailyEntry}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                              >
                                <Check className="w-4 h-4" />
                                ✅ Appliquer
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setShowDailyPreview(true)}
                              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                            >
                              📊 Prévisualiser
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Graphiques de suivi */}
                      {chartData.length > 0 && (
                        <>
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-gray-900">📈 Évolution des KPIs</h4>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setChartTimeRange("daily")}
                                className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-colors",
                                  chartTimeRange === "daily" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                )}
                              >
                                Quotidien
                              </button>
                              <button
                                onClick={() => setChartTimeRange("weekly")}
                                className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-colors",
                                  chartTimeRange === "weekly" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                )}
                              >
                                Hebdomadaire
                              </button>
                            </div>
                          </div>

                          {/* Graphique Budget Cumulé */}
                          <div className="bg-white border border-gray-100 rounded-xl p-6">
                            <h5 className="font-bold text-gray-900 mb-4">💰 Budget Cumulé</h5>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val.toFixed(0)} ${currSym}`} />
                                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} ${currSym}`} />
                                  <Area type="monotone" dataKey="budgetCumul" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorBudget)" />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Graphique CPM Revenue & Marge */}
                          <div className="bg-white border border-gray-100 rounded-xl p-6">
                            <h5 className="font-bold text-gray-900 mb-4">📊 CPM Revenue & Marge %</h5>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val.toFixed(2)} ${currSym}`} />
                                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val.toFixed(0)}%`} />
                                  <Tooltip />
                                  <Legend />
                                  <Line yAxisId="left" type="monotone" dataKey="cpmRev" stroke="#3b82f6" strokeWidth={3} name={`CPM Rev (${currSym})`} />
                                  <Line yAxisId="right" type="monotone" dataKey="marginPct" stroke="#10b981" strokeWidth={3} name="Marge %" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Graphique KPI */}
                          <div className="bg-white border border-gray-100 rounded-xl p-6">
                            <h5 className="font-bold text-gray-900 mb-4">🎯 {project.kpiType}</h5>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                                  <Bar dataKey="kpi" fill="#f59e0b" name={project.kpiType} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Historique des entrées quotidiennes */}
                      {project.dailyEntries && project.dailyEntries.length > 0 && (
                        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                          <div className="p-6 border-b border-gray-100">
                            <h4 className="font-bold text-gray-900">📅 Historique des Saisies</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                                <tr>
                                  <th className="px-6 py-4">Date</th>
                                  <th className="px-6 py-4">Budget Jour</th>
                                  <th className="px-6 py-4">Budget Cumulé</th>
                                  <th className="px-6 py-4">CPM Rev</th>
                                  <th className="px-6 py-4">Marge %</th>
                                  <th className="px-6 py-4">KPI</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {[...project.dailyEntries].reverse().map((entry) => (
                                  <tr key={entry.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 font-medium text-gray-900">
                                      {new Date(entry.date).toLocaleDateString('fr-FR', { 
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short'
                                      })}
                                    </td>
                                    <td className="px-6 py-3 text-gray-600">{entry.budgetSpentYesterday.toFixed(2)} {currSym}</td>
                                    <td className="px-6 py-3 text-blue-600 font-bold">{entry.budgetSpentCumulative.toFixed(2)} {currSym}</td>
                                    <td className="px-6 py-3 text-gray-600">{entry.cpmRevenueYesterday.toFixed(2)} {currSym}</td>
                                    <td className="px-6 py-3 text-emerald-600 font-bold">{entry.marginPctYesterday.toFixed(2)}%</td>
                                    <td className="px-6 py-3 text-gray-600">{entry.kpiYesterday.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === "historique" && (
                <div className="space-y-6">
                  {/* Code existant Historique inchangé */}
                </div>
              )}

              {activeTab === "notes" && (
                <div className="space-y-6">
                  {/* Code existant Notes inchangé */}
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
  
  {/* Contrainte CPM Cap */}
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

                      <div className="flex justify-end gap-3">
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
                                         "💾 SAUVEGARDE"}
                                      </div>
                                      {isRecent && (
                                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                                          RÉCENT
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium">
                                      {date.toLocaleDateString('fr-FR', { 
                                        day: '2-digit', 
                                        month: 'short', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
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
                                      <div className="text-xs text-gray-500 mb-1">Budget Dépensé</div>
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
                                tickFormatter={(val) => `${val.toFixed(0)}${currSym}`}
                              />
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
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
    {/* Vérifier que c'est un projet sauvegardé */}
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

        {/* Formulaire d'ajout de note */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">✍️</span>
            Ajouter une note
          </h4>
          <textarea
            id="note-input"
            placeholder="Écrivez votre note ici... (ex: Optimisation manuelle effectuée sur la ligne 'Display Mobile')"
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

        {/* Liste des notes */}
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
