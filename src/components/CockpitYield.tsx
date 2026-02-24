import { useState, ChangeEvent } from "react";
import { ProjectData, LineItem } from "../types";
import { cn } from "../utils/cn";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { Settings, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Trash2, DollarSign, Percent, Target, ChevronLeft, ChevronRight, Upload, Wand2, ArrowRight, Lock, Unlock } from "lucide-react";
import * as XLSX from "xlsx";

interface CockpitYieldProps {
  project: ProjectData;
  onChange: (project: ProjectData) => void;
}

export function CockpitYield({ project, onChange }: CockpitYieldProps) {
  const [activeTab, setActiveTab] = useState<"analyse" | "comparateur" | "multilines">("analyse");
  const [dashSource, setDashSource] = useState<"sidebar" | "table">("sidebar");
  const [uplift, setUplift] = useState(3.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [proposedOptimizations, setProposedOptimizations] = useState<LineItem[] | null>(null);
  const [marginGoal, setMarginGoal] = useState<"increase" | "decrease" | null>(null);
  const [lockedLines, setLockedLines] = useState<Set<string>>(new Set());

  const toggleLock = (id: string) => {
    const newLocked = new Set(lockedLines);
    if (newLocked.has(id)) newLocked.delete(id);
    else newLocked.add(id);
    setLockedLines(newLocked);
  };

  const currSym = project.currency.includes("EUR") ? "€" : "$";

  const updateField = <K extends keyof ProjectData>(field: K, value: ProjectData[K]) => {
    onChange({ ...project, [field]: value });
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

  // Weighted averages from table
  const totalSpendTable = project.lineItems.reduce((acc, li) => acc + li.spend, 0);
  let wMargin = currentMarginPctCalc;
  let wCpmRev = project.cpmRevenueActual;
  let wCpmCost = cpmCostActuelCalc;
  let wKpi = project.actualKpi;

  if (totalSpendTable > 0) {
    wMargin = project.lineItems.reduce((acc, li) => acc + (li.spend * li.marginPct), 0) / totalSpendTable;
    const totalImpTable = project.lineItems.reduce((acc, li) => acc + (li.cpmRevenue > 0 ? li.spend / li.cpmRevenue : 0), 0);
    if (totalImpTable > 0) {
      wCpmRev = totalSpendTable / totalImpTable;
      const totalCostTable = project.lineItems.reduce((acc, li) => acc + (li.spend * (1 - li.marginPct / 100)), 0);
      wCpmCost = totalCostTable / totalImpTable;
    }
    wKpi = project.lineItems.reduce((acc, li) => acc + (li.spend * li.kpiActual), 0) / totalSpendTable;
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
    
    const lockedSpend = project.lineItems.filter(li => lockedLines.has(li.id)).reduce((acc, li) => acc + li.spend, 0);
    const totalSpend = project.lineItems.reduce((acc, li) => acc + li.spend, 0);
    const availableSpend = totalSpend - lockedSpend;
    
    const scoredItems = project.lineItems.map(li => {
      const safeActual = li.kpiActual > 0 ? li.kpiActual : 0.0001;
      const safeTarget = project.targetKpi > 0 ? project.targetKpi : 0.0001;

      let perfRatio = 1;
      if (isFin) {
        perfRatio = safeTarget / safeActual;
      } else {
        perfRatio = safeActual / safeTarget;
      }
      
      let allocationScore = 0;
      if (marginGoal === "increase") {
        allocationScore = Math.pow(Math.max(0.5, perfRatio), 2) * (1 + li.marginPct / 100);
      } else {
        allocationScore = Math.pow(Math.max(0.5, perfRatio), 2) * (1 + (100 - li.marginPct) / 100);
      }
      
      return { ...li, perfRatio, allocationScore };
    });
    
    const unlockedItems = scoredItems.filter(li => !lockedLines.has(li.id));
    const totalScore = unlockedItems.reduce((acc, li) => acc + li.allocationScore, 0);
    
    const optimizedItems = scoredItems.map(li => {
      let newMargin = li.marginPct;
      let newSpend = li.spend;
      
      if (marginGoal === "increase") {
        if (li.perfRatio >= 1.2) newMargin += 5;
        else if (li.perfRatio >= 1.05) newMargin += 2;
      } else if (marginGoal === "decrease") {
        if (li.perfRatio < 0.8) newMargin -= 5;
        else if (li.perfRatio < 1.0) newMargin -= 2;
      }
      
      if (!lockedLines.has(li.id)) {
        const theoreticalSpend = totalScore > 0 ? (li.allocationScore / totalScore) * availableSpend : li.spend;
        newSpend = (theoreticalSpend * 0.7) + (li.spend * 0.3);
      }
      
      return { 
        id: li.id,
        name: li.name,
        spend: Number(newSpend.toFixed(2)),
        cpmRevenue: li.cpmRevenue,
        marginPct: Number(newMargin.toFixed(2)),
        kpiActual: li.kpiActual
      };
    });
    
    setProposedOptimizations(optimizedItems);
  };

  const applyOptimizations = () => {
    if (proposedOptimizations) {
      updateField("lineItems", proposedOptimizations);
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

        {/* 1. Campagne */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">1. Campagne</h3>
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
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Budget Total ({currSym})</label>
            <input 
              type="number" 
              className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={project.budgetTotal}
              onChange={(e) => updateField("budgetTotal", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Budget Dépensé ({currSym})</label>
            <input 
              type="number" 
              className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={project.budgetSpent}
              onChange={(e) => updateField("budgetSpent", Number(e.target.value))}
            />
          </div>
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
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">2. Finance</h3>
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
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">3. Achat</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">CPM Cost ({currSym})</label>
              <input 
                type="number" step="0.01"
                className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={project.inputMode === "CPM Cost" ? project.cpmCostActuel : Number(cpmCostActuelCalc.toFixed(2))}
                onChange={(e) => {
                  onChange({
                    ...project,
                    inputMode: "CPM Cost",
                    cpmCostActuel: Number(e.target.value)
                  });
                }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Marge %</label>
              <input 
                type="number" step="0.5"
                className="w-full text-sm border-gray-200 bg-gray-50 rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={project.inputMode === "Marge %" ? project.margeInput : Number(currentMarginPctCalc.toFixed(2))}
                onChange={(e) => {
                  onChange({
                    ...project,
                    inputMode: "Marge %",
                    margeInput: Number(e.target.value)
                  });
                }}
              />
            </div>
          </div>
        </div>

        {/* 4. KPI */}
        <div className="space-y-4 pt-6 border-t border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">4. KPI Objectif</h3>
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
              value={`${dispMargin.toFixed(2)} %`} 
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
                { id: "multilines", label: "🎛️ Optimisation Multi-Lines" }
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
                      onChange={(e) => setUplift(Number(e.target.value))}
                    />
                    
                    {/* ENCARD TOTAL MEDIA COST PLUS */}
                    {(() => {
                      const newMargin = currentMarginPctCalc + uplift;
                      const tmcp = newMargin < 100 ? (newMargin / (100 - newMargin)) * 100 : 0;
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
                            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Total Media Cost Plus</div>
                            <div className="text-xl font-black text-blue-600">{tmcp.toFixed(2)} %</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
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
                              {/* MODIFICATION ICI : KPI EN GRAS */}
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
                        
                        let dropOpt, dropPess;
                        let expertExplanation = "";
                        
                        // Expert Programmatic Logic based on KPI
                        const kpi = project.kpiType.toUpperCase();
                        if (kpi.includes("CPA") || kpi.includes("CPL") || kpi.includes("CPV")) {
                          // Severe impact for bottom funnel / high quality video
                          if (priceDrop >= 0) {
                            dropOpt = Math.max(0.1, 1 - (priceDrop * 1.5));
                            dropPess = Math.max(0.1, 1 - (priceDrop * 3.0));
                            expertExplanation = `Le ${kpi} est ultra-sensible au win-rate sur les inventaires premium. Baisser le bid (floor price) vous exclut des enchères à forte intention (SPO, PMP premium) ou des emplacements à haute complétion/visibilité. L'algorithme du DSP (DCO/Bidding) perd ses signaux. La dégradation de la performance est exponentielle.`;
                          } else {
                            dropOpt = 1 - (priceDrop * 1.5);
                            dropPess = 1 - (priceDrop * 0.8);
                            expertExplanation = `Augmenter le bid donne accès à des inventaires premium (Above The Fold, Private Marketplaces). L'algorithme du DSP aura plus de liquidité pour trouver des utilisateurs intentionnistes, améliorant significativement le ${kpi}.`;
                          }
                        } else if (kpi.includes("CPC") || kpi.includes("CTR")) {
                          // Moderate impact
                          if (priceDrop >= 0) {
                            dropOpt = Math.max(0.1, 1 - (priceDrop * 0.8));
                            dropPess = Math.max(0.1, 1 - (priceDrop * 1.5));
                            expertExplanation = `Le ${kpi} est corrélé à la visibilité et au format. Une baisse du bid réduit l'accès aux emplacements haut de page (ATF). La dégradation est linéaire mais peut s'accélérer si on tombe sous les clearing prices du marché.`;
                          } else {
                            dropOpt = 1 - (priceDrop * 1.2);
                            dropPess = 1 - (priceDrop * 0.5);
                            expertExplanation = `Un bid plus agressif permet de remporter des enchères sur des emplacements plus visibles (haut de page, sticky ads), ce qui booste mécaniquement le ${kpi}.`;
                          }
                        } else {
                          // CPM or others: 1:1 impact
                          if (priceDrop >= 0) {
                            dropOpt = Math.max(0.1, 1 - (priceDrop * 0.5));
                            dropPess = Math.max(0.1, 1 - (priceDrop * 1.0));
                            expertExplanation = `Le KPI étant lié au volume/CPM, l'impact est mécanique. Attention toutefois à la brand safety et à la viewability qui vont chuter proportionnellement à la baisse du bid vers des inventaires long-tail.`;
                          } else {
                            dropOpt = 1 - (priceDrop * 1.0);
                            dropPess = 1 - (priceDrop * 0.5);
                            expertExplanation = `Acheter plus cher augmente la qualité globale de l'inventaire diffusé (meilleurs sites, meilleure visibilité).`;
                          }
                        }
                        
                        const perfRate = project.cpmRevenueActual > 0 && project.actualKpi > 0 ? project.cpmRevenueActual / (project.actualKpi * 1000) : 0;

                        let kpiOpt2 = 0, kpiPess2 = 0;
                        if (isFin) {
                          if (project.kpiType === "CPM") {
                            kpiOpt2 = project.cpmRevenueActual; kpiPess2 = project.cpmRevenueActual;
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
                              {/* MODIFICATION ICI : KPI EN GRAS */}
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
                                <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" /> Pourquoi ?</span>
                                <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                              </summary>
                              <div className="p-3 pt-0 text-xs text-amber-800 leading-relaxed border-t border-amber-100/50 mt-1">
                                <strong>Analyse Algorithmique :</strong> {expertExplanation}
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

                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-blue-900 mb-1">Objectif d'optimisation</h4>
                      <p className="text-sm text-blue-700">Choisissez votre stratégie avant de lancer l'algorithme.</p>
                    </div>
                    <div className="flex gap-2">
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

                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 font-bold">Line Item</th>
                          <th className="px-6 py-4 font-bold">Dépense Jour</th>
                          <th className="px-6 py-4 font-bold">CPM Revenu Actuel</th>
                          <th className="px-6 py-4 font-bold">Marge Actuelle %</th>
                          <th className="px-6 py-4 font-bold">KPI Actuel ({project.kpiType})</th>
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
                                title={lockedLines.has(li.id) ? "Budget verrouillé" : "Budget modifiable"}
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

                  {proposedOptimizations && (
                    <div className="mt-8 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-blue-900">Propositions d'Optimisation</h3>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => setProposedOptimizations(null)}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                          >
                            Annuler
                          </button>
                          <button 
                            onClick={applyOptimizations}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Appliquer les changements
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-blue-200 shadow-sm">
                        <table className="w-full text-sm text-left font-mono">
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
                              const spendDiff = original ? li.spend - original.spend : 0;
                              const marginDiff = original ? li.marginPct - original.marginPct : 0;
                              
                              return (
                                <tr key={li.id} className="bg-white hover:bg-blue-50/50 transition-colors">
                                  <td className="px-6 py-4 font-medium text-gray-900">{li.name}</td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-900">{li.spend.toFixed(2)}</span>
                                      {spendDiff !== 0 && (
                                        <span className={spendDiff > 0 ? "text-emerald-500 text-xs" : "text-red-500 text-xs"}>
                                          ({spendDiff > 0 ? "+" : ""}{spendDiff.toFixed(2)})
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-gray-600">{li.cpmRevenue}</td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-900">{li.marginPct.toFixed(2)}%</span>
                                      {marginDiff !== 0 && (
                                        <span className={marginDiff > 0 ? "text-emerald-500 text-xs" : "text-red-500 text-xs"}>
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

function MetricCard({ title, value, subValue, accent, icon: Icon }: { title: string, value: string, subValue?: string, accent: "indigo" | "emerald" | "red", icon: any }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[140px]">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</div>
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          accent === "indigo" ? "bg-blue-50 text-blue-600" :
          accent === "emerald" ? "bg-emerald-50 text-emerald-600" :
          "bg-red-50 text-red-600"
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <div className="text-3xl font-black text-gray-900">{value}</div>
        {subValue && (
          <div className={cn("text-sm font-bold mt-2 flex items-center gap-1", 
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
