import { ProjectData } from "../types";
import { cn } from "../utils/cn";
import { Percent, TrendingUp, DollarSign, Target, Trash2 } from "lucide-react";

interface SidebarProps {
  projects: ProjectData[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export function Sidebar({ projects, selectedProjectId, onSelectProject, onDeleteProject }: SidebarProps) {
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
    <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto shrink-0">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Mes Campagnes</h2>
        
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-4xl mb-3">📁</div>
            <p className="text-sm text-gray-500">Aucune campagne sauvegardée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const isActive = selectedProjectId === project.id;
              const kpis = calculateAverageKPIs(project);
              
              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={cn(
                    "relative p-4 rounded-xl border-2 cursor-pointer transition-all",
                    isActive
                      ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                  )}
                >
                  {/* Nom du projet */}
                  <div className="flex items-start justify-between mb-3">
                    <h3
                      className={cn(
                        "font-bold text-sm leading-tight pr-8",
                        isActive ? "text-blue-900" : "text-gray-900"
                      )}
                    >
                      {project.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Supprimer "${project.name}" ?`)) {
                          onDeleteProject(project.id);
                        }
                      }}
                      className={cn(
                        "absolute top-3 right-3 p-1.5 rounded-lg transition-colors",
                        isActive
                          ? "text-blue-400 hover:text-red-500 hover:bg-red-50"
                          : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

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
                        <span>{kpis.avgCpmRevenue.toFixed(2)} CPM</span>
                      </div>
                      {/* Budget dépensé - colonne gauche */}
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>{kpis.totalBudgetSpent.toFixed(0)} {kpis.currSym}</span>
                      </div>
                      {/* 🎯 KPI Objectif moyen - colonne droite */}
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        <span>{kpis.targetKpi.toFixed(2)} {kpis.kpiType}</span>
                      </div>
                    </div>
                  )}

                  {/* Badge "Nouveau" si créé récemment */}
                  {project.createdAt &&
                    Date.now() - new Date(project.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                      <div className="absolute top-3 left-3">
                        <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                          NOUVEAU
                        </span>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
