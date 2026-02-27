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

  // ✅ ÉTATS SUIVI QUOTIDIEN
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

  // ✅ FONCTION : Appliquer les données quotidiennes
  const applyDailyEntry = () => {
    if (!dailyForm.budgetSpentYesterday || dailyForm.budgetSpentYesterday <= 0) {
      alert("⚠️ Veuillez saisir un budget dépensé valide.");
      return;
    }

    const previousCumulative = project.budgetSpent;
    const newCumulative = previousCumulative + dailyForm.budgetSpentYesterday;

    if (newCumulative > project.budgetTotal) {
      if (!confirm(`⚠️ Le budget cumulé (${newCumulative.toFixed(2)} ${currSym}) dépasse le budget total (${project.budgetTotal} ${currSym}). Continuer quand même ?`)) {
        return;
      }
    }

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

    setDailyForm({
      date: new Date(new Date(dailyForm.date).getTime() + 86400000).toISOString().split('T')[0],
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
        weekStart.setDate(date.getDate() - date.getDay() + 1);
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

        weeklyData[weekKey].budgetCumul = entry.budgetSpentCumulative;
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
          budgetDaily: data.budgetWeekly,
          cpmRev: data.cpmRevSum / data.count,
          marginPct: data.marginSum / data.count,
          kpi: data.kpiSum / data.count
        }));
    }
  };

  const chartData = prepareChartData();

  // ====================================================================
  // 🎨 JSX - RENDU COMPLET DU COMPOSANT
  // ====================================================================

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

// ====================================================================
// ⚠️ FIN DE LA PARTIE 2/3
// ====================================================================
// CONTINUEZ AVEC LA PARTIE 3/3 (Onglets Suivi/Historique/Notes)
// ====================================================================

              {/* TAB: Analyse */}
              {activeTab === "analyse" && (
                <div className="space-y-8">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-8">
                      <h3 className="text-lg font-bold text-blue-900 mb-6 flex items-center gap-3">
                        <Activity className="w-6 h-6 text-blue-600" />
                        Statut de Trading
                      </h3>
                      <div className="space-y-6">
                        {(() => {
                          const gapPct = ((project.cpmRevenueActual - project.cpmSoldCap) / project.cpmSoldCap) * 100;
                          const isConfort = gapPct >= 10;
                          const isTension = gapPct <= -5;

                          return (
                            <div className={cn("p-6 rounded-xl border-2", 
                              isConfort ? "bg-emerald-50 border-emerald-300" : 
                              isTension ? "bg-red-50 border-red-300" : 
                              "bg-yellow-50 border-yellow-300"
                            )}>
                              <div className="flex items-center gap-4 mb-4">
                                {isConfort ? <CheckCircle2 className="w-8 h-8 text-emerald-600" /> :
                                 isTension ? <AlertTriangle className="w-8 h-8 text-red-600" /> :
                                 <Minus className="w-8 h-8 text-yellow-600" />}
                                <div>
                                  <div className="text-2xl font-bold">
                                    {isConfort ? "CONFORT" : isTension ? "TENSION" : "NEUTRE"}
                                  </div>
                                  <div className="text-sm opacity-75">
                                    {isConfort ? "Écart favorable de " : isTension ? "Écart défavorable de " : "Écart de "}
                                    <span className="font-bold">{Math.abs(gapPct).toFixed(1)}%</span>
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="opacity-75">CPM Vendu Cap:</span>
                                  <div className="font-bold text-lg">{project.cpmSoldCap.toFixed(2)} {currSym}</div>
                                </div>
                                <div>
                                  <span className="opacity-75">CPM Revenu Actuel:</span>
                                  <div className="font-bold text-lg">{project.cpmRevenueActual.toFixed(2)} {currSym}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-2 gap-6">
                          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <div className="text-sm text-gray-600 mb-2">Budget Dépensé</div>
                            <div className="text-3xl font-bold text-gray-900">{project.budgetSpent.toFixed(0)} {currSym}</div>
                            <div className="text-xs text-gray-500 mt-2">
                              sur {project.budgetTotal.toFixed(0)} {currSym} ({(pctProgress * 100).toFixed(1)}%)
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <div className="text-sm text-gray-600 mb-2">Gain Réalisé</div>
                            <div className="text-3xl font-bold text-emerald-600">{gainRealized.toFixed(0)} {currSym}</div>
                            <div className="text-xs text-gray-500 mt-2">
                              Restant possible: {gainRemaining.toFixed(0)} {currSym}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-bold text-gray-900 mb-6">Métriques Clés</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Marge Pondérée</div>
                          <div className="text-2xl font-bold text-gray-900">{displayMargin.toFixed(2)}%</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">CPM Cost Net</div>
                          <div className="text-2xl font-bold text-gray-900">{cpmCostActuelCalc.toFixed(2)} {currSym}</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Budget Restant</div>
                          <div className="text-2xl font-bold text-blue-600">{budgetRemaining.toFixed(0)} {currSym}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Comparateur */}
              {activeTab === "comparateur" && (
                <div className="space-y-8">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200">
                    <h3 className="text-xl font-bold text-blue-900 mb-6 flex items-center gap-3">
                      <BarChart3 className="w-6 h-6" />
                      Simulateur de Marge
                    </h3>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                      <div className="bg-white rounded-xl p-6 border-2 border-blue-300 shadow-lg">
                        <div className="text-sm font-bold text-blue-600 mb-4 uppercase tracking-wider">Option 1: Statut Actuel</div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Marge</span>
                            <span className="text-xl font-bold text-blue-900">{currentMarginPctCalc.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">CPM Cost</span>
                            <span className="text-lg font-bold text-gray-900">{cpmCostActuelCalc.toFixed(2)} {currSym}</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">CPM Revenue</span>
                            <span className="text-lg font-bold text-gray-900">{project.cpmRevenueActual.toFixed(2)} {currSym}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-sm text-gray-600">Gain sur budget restant</span>
                            <span className="text-lg font-bold text-emerald-600">{gainRemaining.toFixed(0)} {currSym}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-6 border-2 border-emerald-300 shadow-lg">
                        <div className="text-sm font-bold text-emerald-600 mb-4 uppercase tracking-wider">Option 2: Après Modification</div>
                        <div className="mb-4">
                          <label className="block text-xs text-gray-600 mb-2 font-medium">Variation de Marge (points)</label>
                          <input 
                            type="range" 
                            min="-20" max="20" step="0.5"
                            className="w-full accent-emerald-600"
                            value={uplift}
                            onChange={(e) => updateUplift(Number(e.target.value))}
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>-20%</span>
                            <span className="font-bold text-emerald-600">{uplift > 0 ? '+' : ''}{uplift.toFixed(1)}%</span>
                            <span>+20%</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Marge projetée</span>
                            <span className="text-xl font-bold text-emerald-900">{(currentMarginPctCalc + uplift).toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">CPM Cost projeté</span>
                            <span className="text-lg font-bold text-gray-900">
                              {(project.cpmRevenueActual * (1 - (currentMarginPctCalc + uplift) / 100)).toFixed(2)} {currSym}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">CPM Revenue</span>
                            <span className="text-lg font-bold text-gray-900">{project.cpmRevenueActual.toFixed(2)} {currSym}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-sm text-gray-600">Gain projeté</span>
                            <span className="text-lg font-bold text-emerald-600">
                              {(budgetRemaining * ((currentMarginPctCalc + uplift) / 100)).toFixed(0)} {currSym}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                      <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Projection Comparative</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={[
                          { name: "Actuel", option1: gainRemaining, option2: budgetRemaining * ((currentMarginPctCalc + uplift) / 100) },
                          { name: "Projection", option1: gainRemaining, option2: budgetRemaining * ((currentMarginPctCalc + uplift) / 100) }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                            formatter={(value: any) => `${Number(value).toFixed(0)} ${currSym}`}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Line type="monotone" dataKey="option1" stroke="#3b82f6" strokeWidth={2} name="Option 1: Actuel" dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="option2" stroke="#10b981" strokeWidth={2} name="Option 2: Après Modif" dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <button 
                      onClick={applyMarginChange}
                      className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                    >
                      <ArrowRight className="w-5 h-5" />
                      Appliquer la Modification de Marge
                    </button>
                  </div>
                </div>
              )}

              {/* TAB: Multi-Lines */}
              {activeTab === "multilines" && (
                <div className="space-y-8">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-200">
                    <h3 className="text-xl font-bold text-purple-900 mb-6 flex items-center gap-3">
                      <Wand2 className="w-6 h-6" />
                      Optimisation Intelligente Multi-Lines
                    </h3>

                    <div className="grid grid-cols-3 gap-6 mb-6">
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <label className="block text-sm font-bold text-gray-700 mb-3">Objectif de Trading</label>
                        <div className="space-y-2">
                          <button
                            onClick={() => setMarginGoal("increase")}
                            className={cn("w-full p-3 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2",
                              marginGoal === "increase" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-gray-200 text-gray-600 hover:border-emerald-300"
                            )}
                          >
                            <TrendingUp className="w-4 h-4" />
                            Augmenter Marge
                          </button>
                          <button
                            onClick={() => setMarginGoal("decrease")}
                            className={cn("w-full p-3 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2",
                              marginGoal === "decrease" ? "border-orange-500 bg-orange-50 text-orange-900" : "border-gray-200 text-gray-600 hover:border-orange-300"
                            )}
                          >
                            <TrendingDown className="w-4 h-4" />
                            Baisser Marge
                          </button>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <label className="block text-sm font-bold text-gray-700 mb-3">Respect CPM Revenue Cap</label>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setRespectCpmCap(!respectCpmCap)}
                            className={cn("flex-1 p-3 rounded-lg border-2 font-medium transition-all",
                              respectCpmCap ? "border-blue-500 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-600"
                            )}
                          >
                            {respectCpmCap ? "Oui" : "Non"}
                          </button>
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                          Cap: <span className="font-bold">{project.cpmSoldCap.toFixed(2)} {currSym}</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <label className="block text-sm font-bold text-gray-700 mb-3">Importer Excel</label>
                        <input 
                          type="file" 
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileUpload}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleOptimize}
                      disabled={!marginGoal}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Wand2 className="w-5 h-5" />
                      Générer Optimisations
                    </button>
                  </div>

                  {proposedOptimizations && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-6">
                        <h4 className="text-xl font-bold flex items-center gap-3">
                          <CheckCircle2 className="w-6 h-6" />
                          Optimisations Proposées
                        </h4>
                      </div>
                      <div className="p-8">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Line Item</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">Spend ({currSym})</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">CPM Rev ({currSym})</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">Marge (%)</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">KPI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {proposedOptimizations.map((li, idx) => (
                                <tr key={li.id} className={cn("border-b border-gray-100", idx % 2 === 0 ? "bg-gray-50" : "bg-white")}>
                                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{li.name}</td>
                                  <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{li.spend.toFixed(2)}</td>
                                  <td className="py-3 px-4 text-sm text-right font-medium text-gray-700">{li.cpmRevenue.toFixed(2)}</td>
                                  <td className="py-3 px-4 text-sm text-right font-bold text-emerald-600">{li.marginPct.toFixed(2)}%</td>
                                  <td className="py-3 px-4 text-sm text-right font-medium text-gray-700">{fmtKpi(li.kpiActual)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button
                          onClick={applyOptimizations}
                          className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Appliquer les Optimisations
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-8 py-4 border-b border-gray-200">
                      <h4 className="text-lg font-bold text-gray-900">Configuration Actuelle des Lines</h4>
                    </div>
                    <div className="p-8">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b-2 border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">
                                <Lock className="w-4 h-4 inline mr-2" />
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Line Item</th>
                              <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">Spend ({currSym})</th>
                              <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">CPM Rev ({currSym})</th>
                              <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">Marge (%)</th>
                              <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">KPI</th>
                              <th className="text-center py-3 px-4 text-sm font-bold text-gray-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {project.lineItems.map((li, idx) => (
                              <tr key={li.id} className={cn("border-b border-gray-100", idx % 2 === 0 ? "bg-gray-50" : "bg-white")}>
                                <td className="py-3 px-4">
                                  <button
                                    onClick={() => toggleLock(li.id)}
                                    className={cn("p-1 rounded transition-colors", lockedLines.has(li.id) ? "text-red-600 hover:text-red-700" : "text-gray-400 hover:text-gray-600")}
                                  >
                                    {lockedLines.has(li.id) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                  </button>
                                </td>
                                <td className="py-3 px-4">
                                  <input
                                    type="text"
                                    value={li.name}
                                    onChange={(e) => {
                                      const updated = project.lineItems.map(item =>
                                        item.id === li.id ? { ...item, name: e.target.value } : item
                                      );
                                      updateField("lineItems", updated);
                                    }}
                                    className="w-full text-sm font-medium text-gray-900 bg-transparent border-none outline-none"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <input
                                    type="number"
                                    value={li.spend || 0}
                                    onChange={(e) => {
                                      const updated = project.lineItems.map(item =>
                                        item.id === li.id ? { ...item, spend: Number(e.target.value) } : item
                                      );
                                      updateField("lineItems", updated);
                                    }}
                                    className="w-full text-sm text-right font-bold text-gray-900 bg-transparent border-none outline-none"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={li.cpmRevenue}
                                    onChange={(e) => {
                                      const updated = project.lineItems.map(item =>
                                        item.id === li.id ? { ...item, cpmRevenue: Number(e.target.value) } : item
                                      );
                                      updateField("lineItems", updated);
                                    }}
                                    className="w-full text-sm text-right font-medium text-gray-700 bg-transparent border-none outline-none"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={li.marginPct}
                                    onChange={(e) => {
                                      const updated = project.lineItems.map(item =>
                                        item.id === li.id ? { ...item, marginPct: Number(e.target.value) } : item
                                      );
                                      updateField("lineItems", updated);
                                    }}
                                    className="w-full text-sm text-right font-bold text-emerald-600 bg-transparent border-none outline-none"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={li.kpiActual}
                                    onChange={(e) => {
                                      const updated = project.lineItems.map(item =>
                                        item.id === li.id ? { ...item, kpiActual: Number(e.target.value) } : item
                                      );
                                      updateField("lineItems", updated);
                                    }}
                                    className="w-full text-sm text-right font-medium text-gray-700 bg-transparent border-none outline-none"
                                  />
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => {
                                      const updated = project.lineItems.filter(item => item.id !== li.id);
                                      updateField("lineItems", updated);
                                    }}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
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
                          const newLine: LineItem = {
                            id: Date.now().toString(),
                            name: `Line ${project.lineItems.length + 1}`,
                            spend: 0,
                            cpmRevenue: project.cpmRevenueActual,
                            marginPct: currentMarginPctCalc,
                            kpiActual: project.actualKpi
                          };
                          updateField("lineItems", [...project.lineItems, newLine]);
                        }}
                        className="mt-6 w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                      >
                        + Ajouter une Line
                      </button>
                    </div>
                  </div>
                </div>
              )}

 {/* TAB: Suivi Quotidien */}
              {activeTab === "suivi" && (
                <div className="space-y-8">
                  <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-8 border border-cyan-200">
                    <h3 className="text-xl font-bold text-cyan-900 mb-6 flex items-center gap-3">
                      <Calendar className="w-6 h-6" />
                      Saisie Données Quotidiennes
                    </h3>

                    <div className="grid grid-cols-5 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                        <input
                          type="date"
                          value={dailyForm.date}
                          onChange={(e) => setDailyForm({ ...dailyForm, date: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Budget Dépensé ({currSym})</label>
                        <input
                          type="number"
                          step="0.01"
                          value={dailyForm.budgetSpentYesterday}
                          onChange={(e) => setDailyForm({ ...dailyForm, budgetSpentYesterday: Number(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">CPM Revenue ({currSym})</label>
                        <input
                          type="number"
                          step="0.01"
                          value={dailyForm.cpmRevenueYesterday}
                          onChange={(e) => setDailyForm({ ...dailyForm, cpmRevenueYesterday: Number(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Marge (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={dailyForm.marginPctYesterday}
                          onChange={(e) => setDailyForm({ ...dailyForm, marginPctYesterday: Number(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">KPI {project.kpiType}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={dailyForm.kpiYesterday}
                          onChange={(e) => setDailyForm({ ...dailyForm, kpiYesterday: Number(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {showDailyPreview && (
                      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
                        <h4 className="text-lg font-bold text-yellow-900 mb-4">📋 Prévisualisation</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><span className="font-medium text-gray-700">Budget cumulé:</span> <span className="font-bold">{(project.budgetSpent + dailyForm.budgetSpentYesterday).toFixed(2)} {currSym}</span></div>
                          <div><span className="font-medium text-gray-700">CPM Revenue:</span> <span className="font-bold">{dailyForm.cpmRevenueYesterday.toFixed(2)} {currSym}</span></div>
                          <div><span className="font-medium text-gray-700">Marge:</span> <span className="font-bold text-emerald-600">{dailyForm.marginPctYesterday.toFixed(2)}%</span></div>
                          <div><span className="font-medium text-gray-700">KPI:</span> <span className="font-bold">{fmtKpi(dailyForm.kpiYesterday)}</span></div>
                        </div>
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={applyDailyEntry}
                            className="flex-1 bg-emerald-500 text-white py-3 rounded-lg font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <Check className="w-5 h-5" />
                            Appliquer
                          </button>
                          <button
                            onClick={() => setShowDailyPreview(false)}
                            className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                          >
                            <X className="w-5 h-5" />
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}

                    {!showDailyPreview && (
                      <button
                        onClick={() => setShowDailyPreview(true)}
                        className="w-full bg-cyan-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-cyan-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                      >
                        <Activity className="w-5 h-5" />
                        Prévisualiser les données
                      </button>
                    )}
                  </div>

                  {chartData.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-900">Graphiques de Suivi</h3>
                        <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => setChartTimeRange("daily")}
                            className={cn("px-4 py-2 rounded-md font-medium text-sm transition-colors", chartTimeRange === "daily" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
                          >
                            Quotidien
                          </button>
                          <button
                            onClick={() => setChartTimeRange("weekly")}
                            className={cn("px-4 py-2 rounded-md font-medium text-sm transition-colors", chartTimeRange === "weekly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
                          >
                            Hebdomadaire
                          </button>
                        </div>
                      </div>

                      <div className="space-y-8">
                        {/* Graphique 1: Budget Cumulé */}
                        <div>
                          <h4 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Budget Cumulé ({currSym})</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={chartData}>
                              <defs>
                                <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                                formatter={(value: any) => [`${Number(value).toFixed(2)} ${currSym}`, 'Budget Cumulé']}
                              />
                              <Area type="monotone" dataKey="budgetCumul" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorBudget)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Graphique 2: CPM Revenue & Marge % */}
                        <div>
                          <h4 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">CPM Revenue & Marge %</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                              <YAxis yAxisId="left" stroke="#6b7280" style={{ fontSize: '12px' }} label={{ value: `CPM (${currSym})`, angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }} />
                              <YAxis yAxisId="right" orientation="right" stroke="#6b7280" style={{ fontSize: '12px' }} label={{ value: 'Marge (%)', angle: 90, position: 'insideRight', style: { fontSize: '12px' } }} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                                formatter={(value: any, name: string) => {
                                  if (name === 'CPM Revenue') return [`${Number(value).toFixed(2)} ${currSym}`, name];
                                  if (name === 'Marge %') return [`${Number(value).toFixed(2)}%`, name];
                                  return [value, name];
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: '12px' }} />
                              <Line yAxisId="left" type="monotone" dataKey="cpmRev" stroke="#8b5cf6" strokeWidth={2} name="CPM Revenue" dot={{ r: 3 }} />
                              <Line yAxisId="right" type="monotone" dataKey="marginPct" stroke="#10b981" strokeWidth={2} name="Marge %" dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Graphique 3: KPI */}
                        <div>
                          <h4 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">KPI {project.kpiType}</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                                formatter={(value: any) => [fmtKpi(Number(value)), 'KPI']}
                              />
                              <Bar dataKey="kpi" fill="#f97316" radius={[8, 8, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Historique des entrées quotidiennes */}
                  {project.dailyEntries && project.dailyEntries.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="bg-gray-50 px-8 py-4 border-b border-gray-200">
                        <h4 className="text-lg font-bold text-gray-900">Historique des Saisies</h4>
                      </div>
                      <div className="p-8">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Date</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">Budget ({currSym})</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">Budget Cumulé ({currSym})</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">CPM Rev ({currSym})</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">Marge (%)</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">KPI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...project.dailyEntries].reverse().map((entry, idx) => (
                                <tr key={entry.id} className={cn("border-b border-gray-100", idx % 2 === 0 ? "bg-gray-50" : "bg-white")}>
                                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                                    {new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-right font-bold text-blue-600">{entry.budgetSpentYesterday.toFixed(2)}</td>
                                  <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{entry.budgetSpentCumulative.toFixed(2)}</td>
                                  <td className="py-3 px-4 text-sm text-right font-medium text-gray-700">{entry.cpmRevenueYesterday.toFixed(2)}</td>
                                  <td className="py-3 px-4 text-sm text-right font-bold text-emerald-600">{entry.marginPctYesterday.toFixed(2)}%</td>
                                  <td className="py-3 px-4 text-sm text-right font-medium text-gray-700">{fmtKpi(entry.kpiYesterday)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Historique */}
              {activeTab === "historique" && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 border border-indigo-200">
                    <h3 className="text-xl font-bold text-indigo-900 mb-6 flex items-center gap-3">
                      <History className="w-6 h-6" />
                      Timeline des Modifications
                    </h3>
                    {project.history && project.history.length > 0 ? (
                      <div className="space-y-4">
                        {[...project.history].reverse().map((snap, idx) => (
                          <div key={idx} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg", 
                                  snap.action === "MARGIN_UP" ? "bg-emerald-100 text-emerald-600" :
                                  snap.action === "MARGIN_DOWN" ? "bg-orange-100 text-orange-600" :
                                  snap.action === "OPTIMIZATION" ? "bg-purple-100 text-purple-600" :
                                  snap.action === "DAILY_UPDATE" ? "bg-cyan-100 text-cyan-600" :
                                  "bg-blue-100 text-blue-600"
                                )}>
                                  {snap.action === "MARGIN_UP" ? <TrendingUp className="w-5 h-5" /> :
                                   snap.action === "MARGIN_DOWN" ? <TrendingDown className="w-5 h-5" /> :
                                   snap.action === "OPTIMIZATION" ? <Wand2 className="w-5 h-5" /> :
                                   snap.action === "DAILY_UPDATE" ? <Calendar className="w-5 h-5" /> :
                                   <Activity className="w-5 h-5" />}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {snap.action === "MARGIN_UP" ? "Augmentation Marge" :
                                     snap.action === "MARGIN_DOWN" ? "Baisse Marge" :
                                     snap.action === "OPTIMIZATION" ? "Optimisation" :
                                     snap.action === "DAILY_UPDATE" ? "Mise à jour quotidienne" :
                                     "Modification"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(snap.timestamp).toLocaleString('fr-FR', { 
                                      day: '2-digit', 
                                      month: 'long', 
                                      year: 'numeric', 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-emerald-600">{snap.marginPct.toFixed(2)}%</div>
                                <div className="text-xs text-gray-500">Marge</div>
                              </div>
                            </div>
                            {snap.note && (
                              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 italic border-l-4 border-blue-400">
                                {snap.note}
                              </div>
                            )}
                            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Budget Dépensé</div>
                                <div className="font-bold text-gray-900">{snap.budgetSpent.toFixed(2)} {currSym}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">CPM Revenue</div>
                                <div className="font-bold text-gray-900">{snap.cpmRevenueActual.toFixed(2)} {currSym}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">CPM Cost</div>
                                <div className="font-bold text-gray-900">{snap.cpmCostActuel.toFixed(2)} {currSym}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Gain Réalisé</div>
                                <div className="font-bold text-emerald-600">{snap.gainRealized.toFixed(2)} {currSym}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">Aucun historique disponible</p>
                        <p className="text-sm">Les modifications apparaîtront ici</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: Notes */}
              {activeTab === "notes" && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-8 border border-amber-200">
                    <h3 className="text-xl font-bold text-amber-900 mb-6">Ajouter une Note</h3>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const titleInput = form.elements.namedItem('title') as HTMLInputElement;
                      const contentInput = form.elements.namedItem('content') as HTMLTextAreaElement;
                      
                      const newNote: ProjectNote = {
                        id: Date.now().toString(),
                        title: titleInput.value,
                        content: contentInput.value,
                        createdAt: new Date().toISOString()
                      };
                      
                      updateField("notes", [...(project.notes || []), newNote]);
                      form.reset();
                    }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Titre</label>
                        <input
                          type="text"
                          name="title"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          placeholder="Titre de la note..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Contenu</label>
                        <textarea
                          name="content"
                          required
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          placeholder="Écrivez votre note ici..."
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white py-3 rounded-lg font-bold hover:from-amber-600 hover:to-yellow-600 transition-all shadow-lg hover:shadow-xl"
                      >
                        Ajouter la Note
                      </button>
                    </form>
                  </div>

                  {project.notes && project.notes.length > 0 && (
                    <div className="space-y-4">
                      {[...project.notes].reverse().map((note) => (
                        <div key={note.id} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="text-lg font-bold text-gray-900">{note.title}</h4>
                            <button
                              onClick={() => {
                                if (confirm('Supprimer cette note ?')) {
                                  updateField("notes", (project.notes || []).filter(n => n.id !== note.id));
                                }
                              }}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                          <div className="text-xs text-gray-500 mt-4">
                            {new Date(note.createdAt).toLocaleString('fr-FR', { 
                              day: '2-digit', 
                              month: 'long', 
                              year: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
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

// ====================================================================
// 🎨 COMPOSANT HELPER: MetricCard
// ====================================================================

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: any;
  accent?: "blue" | "indigo" | "emerald" | "red" | "purple";
}

function MetricCard({ title, value, subValue, icon: Icon, accent = "blue" }: MetricCardProps) {
  const colors = {
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-600",
    indigo: "from-indigo-50 to-purple-50 border-indigo-200 text-indigo-600",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-600",
    red: "from-red-50 to-orange-50 border-red-200 text-red-600",
    purple: "from-purple-50 to-pink-50 border-purple-200 text-purple-600"
  };

  return (
    <div className={cn("bg-gradient-to-br rounded-2xl p-6 border shadow-sm", colors[accent])}>
      <div className="flex items-start justify-between mb-4">
        <div className="text-sm font-medium text-gray-600 uppercase tracking-wider">{title}</div>
        <Icon className="w-5 h-5 opacity-60" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subValue && <div className="text-sm text-gray-600 mt-2">{subValue}</div>}
    </div>
  );
}
