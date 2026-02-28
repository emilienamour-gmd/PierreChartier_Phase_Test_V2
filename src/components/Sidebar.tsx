import { useState } from "react";
import { ProjectData } from "../types";
import { UserProfile } from "../store/useUserStore";
import { cn } from "../utils/cn";
import { 
  LayoutDashboard, 
  LineChart, 
  Lightbulb, 
  RotateCcw, 
  FolderKanban, 
  TrendingUp, 
  Settings as SettingsIcon, 
  HelpCircle,
  Save,
  Plus,
  Percent,
  DollarSign,
  Target,
  Trash2
} from "lucide-react";

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

export function Sidebar({ 
  activeTab, 
  setActiveTab, 
  projects, 
  currentProject,
  onLoadProject,
  onSaveProject,
  onDeleteProject,
  onCreateNew,
  user 
}: SidebarProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projectName, setProjectName] = useState("");

  const navItems = [
    { id: "cockpit", icon: LayoutDashboard, label: "Cockpit" },
    { id: "tracking", icon: LineChart, label: "Suivi Campagne" },
    { id: "insights", icon: Lightbulb, label: "Insights" },
    { id: "cycle", icon: RotateCcw, label: "Cycle Opti" },
    { id: "portfolio", icon: FolderKanban, label: "Portfolio" },
    { id: "market", icon: TrendingUp, label: "Market Watch" },
    { id: "settings", icon: SettingsIcon, label: "Settings" },
    { id: "help", icon: HelpCircle, label: "Help" },
  ];

  const handleSave = () => {
    if (projectName.trim()) {
      onSaveProject(projectName.trim());
      setShowSaveModal(false);
      setProjectName("");
    }
  };

  const calculateAverageKPIs = (project: ProjectData) => {
    if (!project.dailyEntries || project.dailyEntries.length === 0) {
      const currSym = project.currency.includes("EUR") ? "€" : "$";
      
      let currentMargin = 0;
      if (project.inputMode === "CPM Cost") {
        if (project.cpmRevenueActual > 0) {
          currentMargin = ((project.cpmRevenueActual - project.cpmCostActuel) / project.cpmRevenueActual) * 100;
        }
      } else {
        currentMargin = project.margeInput;
      }
      
      return {
        entriesCount: 0,
        avgMargin: currentMargin,
        avgCpmRevenue: project.cpmRevenueActual,
        totalBudgetSpent: project.budgetSpent,
        currSym,
        kpiType: project.kpiType,
        targetKpi: project.targetKpi
      };
    }

    let totalSpent = 0;
    let totalRevenue = 0;
    let totalGain = 0;

    project.dailyEntries.forEach(entry => {
      const spent = entry.budgetSpent || 0;
      const margin = entry.marginPct || 0;
      const revenue = entry.cpmRevenue || 0;

      totalSpent += spent;
      totalRevenue += revenue * spent;
      totalGain += spent * (margin / 100);
    });

    const avgCpmRevenue = totalSpent > 0 ? totalRevenue / totalSpent : project.cpmRevenueActual;
    const avgMargin = totalSpent > 0 ? (totalGain / totalSpent) * 100 : 0;
    const currSym = project.currency.includes("EUR") ? "€" : "$";

    return {
      entriesCount: project.dailyEntries.length,
      avgMargin,
      avgCpmRevenue,
      totalBudgetSpent: totalSpent,
      currSym,
      kpiType: project.kpiType,
      targetKpi: project.targetKpi
    };
  };

  return (
    <>
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Header avec profil */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-gray-900 truncate">{user.name}</div>
              <div className="text-xs text-gray-500">Trader</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Actions projets */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={() => setShowSaveModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            Sauvegarder
          </button>
          <button
            onClick={onCreateNew}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau
          </button>
        </div>

        {/* Liste des projets sauvegardés */}
        {projects.length > 0 && (
          <div className="border-t border-gray-200 max-h-96 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Projets Sauvegardés
              </h3>
              <div className="space-y-2">
                {projects.map((project) => {
                  const isActive = currentProject?.id === project.id;
                  const kpis = calculateAverageKPIs(project);
                  
                  return (
                    <div
                      key={project.id}
                      onClick={() => onLoadProject(project.id)}
                      className={cn(
                        "relative p-3 rounded-lg border cursor-pointer transition-all",
                        isActive
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-blue-300"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className={cn(
                          "font-bold text-xs leading-tight pr-6",
                          isActive ? "text-blue-900" : "text-gray-900"
                        )}>
                          {project.name}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Supprimer "${project.name}" ?`)) {
                              onDeleteProject(project.id);
                            }
                          }}
                          className="absolute top-2 right-2 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {kpis.entriesCount > 0 && (
                        <div className={cn(
                          "grid grid-cols-2 gap-1 text-[9px] font-medium",
                          isActive ? "text-blue-600" : "text-gray-500"
                        )}>
                          <div className="flex items-center gap-1">
                            <Percent className="w-2.5 h-2.5" />
                            <span>{kpis.avgMargin.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-2.5 h-2.5" />
                            <span>{kpis.totalBudgetSpent.toFixed(0)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-2.5 h-2.5" />
                            <span>{kpis.avgCpmRevenue.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="w-2.5 h-2.5" />
                            <span>{kpis.targetKpi.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de sauvegarde */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Sauvegarder le projet
            </h3>
            <input
              type="text"
              placeholder="Nom du projet..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSave()}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setProjectName("");
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!projectName.trim()}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
