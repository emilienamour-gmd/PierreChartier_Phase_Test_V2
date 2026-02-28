import { useState } from "react";
import { 
  LayoutDashboard, 
  RefreshCw, 
  Briefcase, 
  LineChart, 
  Save, 
  Trash2,
  PlusCircle,
  FolderOpen,
  Settings as SettingsIcon,
  HelpCircle,
  ChevronRight,
  Calendar,
  BarChart3,
  TrendingUp,
  Percent,
  DollarSign
} from "lucide-react";
import { cn } from "../utils/cn";
import { ProjectData } from "../types";
import { UserProfile } from "../store/useUserStore";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  projects: ProjectData[];
  currentProject: ProjectData | null;
  onLoadProject: (id: string) => void;
  onSaveProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onCreateNew: () => void;
  user: UserProfile;
}

const NAV_ITEMS = [
  { id: "tracking", label: "Suivi Campagne", icon: Calendar },
  { id: "cockpit", label: "Cockpit Yield", icon: LayoutDashboard },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "cycle", label: "Cycle des Optimisations", icon: RefreshCw },
  { id: "portfolio", label: "Portfolio & Performance", icon: Briefcase },
  { id: "market", label: "Market Watch", icon: LineChart },
];

// 📊 FONCTION : Calculer les KPIs moyens depuis dailyEntries
function calculateAverageKPIs(project: ProjectData) {
  const currSym = project.currency.includes("EUR") ? "€" : "$";
  
  // Si pas de dailyEntries, retourner les valeurs générales
  if (!project.dailyEntries || project.dailyEntries.length === 0) {
    let margin = 0;
    if (project.inputMode === "CPM Cost") {
      if (project.cpmRevenueActual > 0) {
        margin = ((project.cpmRevenueActual - project.cpmCostActuel) / project.cpmRevenueActual) * 100;
      }
    } else {
      margin = project.margeInput;
    }

    return {
      avgCpmRevenue: project.cpmRevenueActual,
      avgMargin: margin,
      avgKpi: project.actualKpi,
      totalBudgetSpent: project.budgetSpent,
      entriesCount: 0,
      currSym
    };
  }

  // Calculer les moyennes pondérées depuis dailyEntries
  const totalBudgetSpent = project.dailyEntries.reduce((sum, e) => sum + e.budgetSpent, 0);
  
  let weightedCpmRevenue = 0;
  let weightedMargin = 0;
  let weightedKpi = 0;

  if (totalBudgetSpent > 0) {
    project.dailyEntries.forEach(entry => {
      const weight = entry.budgetSpent / totalBudgetSpent;
      weightedCpmRevenue += entry.cpmRevenue * weight;
      weightedMargin += entry.marginPct * weight;
      weightedKpi += entry.kpiActual * weight;
    });
  }

  return {
    avgCpmRevenue: weightedCpmRevenue,
    avgMargin: weightedMargin,
    avgKpi: weightedKpi,
    totalBudgetSpent,
    entriesCount: project.dailyEntries.length,
    currSym
  };
}

export function Sidebar({
  activeTab,
  setActiveTab,
  projects,
  currentProject,
  onLoadProject,
  onSaveProject,
  onDeleteProject,
  onCreateNew,
  user,
}: SidebarProps) {
  const [isCampaignesOpen, setIsCampaignesOpen] = useState(true);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
          {user.initials}
        </div>
        <span className="font-bold text-gray-900 text-lg truncate">{user.name}</span>
      </div>

      <div className="px-4 py-2 flex-1 overflow-y-auto">
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-400 mb-3 px-3 uppercase tracking-wider">Main Menu</div>
        </div>

        {/* SECTION CAMPAGNES */}
        {(activeTab === "cockpit" || activeTab === "tracking" || activeTab === "insights") && (
          <div className="mb-8">
            <button
              onClick={() => setIsCampaignesOpen(!isCampaignesOpen)}
              className="w-full flex items-center justify-between px-3 py-2 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Campagnes
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 transition-transform",
                isCampaignesOpen && "rotate-90"
              )} />
            </button>
            
            {isCampaignesOpen && (
              <div className="space-y-1 mb-4">
                <button
                  onClick={onCreateNew}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border border-dashed",
                    !currentProject 
                      ? "border-blue-300 text-blue-600 bg-blue-50" 
                      : "border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <PlusCircle className="w-5 h-5" />
                  Nouvelle Campagne
                </button>

                {projects.map((p) => {
                  const kpis = calculateAverageKPIs(p);
                  const isHovered = hoveredProject === p.id;
                  const isActive = currentProject?.id === p.id;

                  return (
                    <div key={p.id} className="relative">
                      <button
                        onClick={() => onLoadProject(p.id)}
                        onMouseEnter={() => setHoveredProject(p.id)}
                        onMouseLeave={() => setHoveredProject(null)}
                        className={cn(
                          "w-full flex flex-col gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                          isActive
                            ? "bg-blue-600 text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        <span className="truncate font-bold">{p.name}</span>
                        
                        {/* 📊 KPIs MOYENS */}
                        {kpis.entriesCount > 0 && (
                          <div className={cn(
                            "grid grid-cols-2 gap-1 text-[10px] font-medium",
                            isActive ? "text-blue-100" : "text-gray-400"
                          )}>
                            <div className="flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              <span>{kpis.avgMargin.toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              <span>{kpis.avgCpmRevenue.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-1 col-span-2">
                              <DollarSign className="w-3 h-3" />
                              <span>{kpis.totalBudgetSpent.toFixed(0)} {kpis.currSym}</span>
                            </div>
                          </div>
                        )}
                        
                        {kpis.entriesCount === 0 && !isActive && (
                          <span className="text-[10px] text-gray-400 italic">
                            Aucune donnée
                          </span>
                        )}
                      </button>

                      {/* 💡 TOOLTIP DÉTAILLÉ au survol */}
                      {isHovered && !isActive && kpis.entriesCount > 0 && (
                        <div className="absolute left-full ml-2 top-0 z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl w-56 pointer-events-none">
                          <div className="font-bold mb-2 border-b border-gray-700 pb-2">
                            📊 Moyennes ({kpis.entriesCount} entrées)
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-gray-400">CPM Revenu moyen :</span>
                              <span className="font-bold">{kpis.avgCpmRevenue.toFixed(2)} {kpis.currSym}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Marge moyenne :</span>
                              <span className="font-bold text-emerald-400">{kpis.avgMargin.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">{p.kpiType} moyen :</span>
                              <span className="font-bold">{kpis.avgKpi.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-1.5 border-t border-gray-700">
                              <span className="text-gray-400">Budget total :</span>
                              <span className="font-bold text-blue-400">{kpis.totalBudgetSpent.toFixed(0)} {kpis.currSym}</span>
                            </div>
                          </div>
                          {/* Triangle pointer */}
                          <div className="absolute right-full top-4 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-4 border-r-gray-900"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Boutons Sauvegarder/Supprimer */}
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <button
                onClick={() => {
                  const name = prompt("Nom de la campagne :", currentProject?.name || "Nouvelle Campagne");
                  if (name) onSaveProject(name);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Save className="w-5 h-5" />
                Sauvegarder
              </button>

              {currentProject && (
                <button
                  onClick={() => {
                    if (confirm("Supprimer cette campagne ?")) {
                      onDeleteProject(currentProject.id);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                  Supprimer
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation principale */}
        <div className="mb-8">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-200 space-y-1">
         <div className="text-xs font-semibold text-gray-400 mb-3 px-3 uppercase tracking-wider">Settings</div>
         
         <button 
            onClick={() => setActiveTab("help")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              activeTab === "help" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
         >
            <HelpCircle className="w-5 h-5" />
            Help Center
         </button>

         <button 
           onClick={() => setActiveTab("settings")}
           className={cn(
             "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
             activeTab === "settings" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
           )}
         >
            <SettingsIcon className="w-5 h-5" />
            Settings
         </button>
      </div>
    </div>
  );
}
