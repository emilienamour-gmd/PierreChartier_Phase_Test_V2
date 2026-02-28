import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { CockpitYield } from "./components/CockpitYield";
import { OptimizationCycle } from "./components/OptimizationCycle";
import { Portfolio } from "./components/Portfolio";
import { MarketWatch } from "./components/MarketWatch";
import { CampaignTracking } from "./components/CampaignTracking";
import { Insights } from "./components/Insights";
import { Settings } from "./components/Settings";
import { Auth } from "./components/Auth";
import { IntroVideo } from "./components/IntroVideo";
import { useProjectStore } from "./store/useProjectStore";
import { useUserStore } from "./store/useUserStore";
import { DEFAULT_PROJECT } from "./types";
import { Search, Bell, Layout, LogOut, ChevronDown, Plus } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("cockpit");
  const [showIntro, setShowIntro] = useState(true);
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);

  const { user: storeUser, isLoading, logout } = useUserStore();
  const [localUser, setLocalUser] = useState(storeUser);

  useEffect(() => {
    setLocalUser(storeUser);
  }, [storeUser]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 4000); 
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleLoginSuccess = () => {
      const saved = localStorage.getItem("userProfile");
      if (saved) {
        setLocalUser(JSON.parse(saved));
      }
    };
    window.addEventListener("force-app-update", handleLoginSuccess);
    return () => window.removeEventListener("force-app-update", handleLoginSuccess);
  }, []);

  const {
    projects,
    currentProject,
    setCurrentProject,
    saveProject,
    deleteProject,
    loadProject,
    createNewProject,
  } = useProjectStore();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;

  if (!localUser) {
    return <Auth />;
  }

  const activeProject = currentProject || DEFAULT_PROJECT;

  const tabTitles: Record<string, string> = {
    cockpit: "Dashboard",
    tracking: "Suivi Campagne",
    insights: "Insights",
    cycle: "Cycle des Optimisations",
    portfolio: "Portfolio & Performance",
    market: "Market Watch",
    settings: "Settings",
    help: "Help Center",
  };

  return (
    <div className={`flex h-screen w-full bg-[#f8f9fa] overflow-hidden font-sans text-gray-900 theme-${localUser.theme}`}>
      
      {showIntro && <IntroVideo />}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        projects={projects}
        currentProject={currentProject}
        onLoadProject={loadProject}
        onSaveProject={(name) => saveProject({ ...activeProject, id: currentProject?.id || Date.now().toString(), name })}
        onDeleteProject={deleteProject}
        onCreateNew={createNewProject}
        user={localUser}
      />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            {/* Breadcrumb */}
            <div className="flex items-center text-sm text-gray-500">
              <span className="text-gray-400">Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-gray-900 font-medium">{tabTitles[activeTab]}</span>
            </div>

            {/* 🎯 SÉLECTEUR DE CAMPAGNE */}
            <div className="relative">
              <button
                onClick={() => setShowCampaignDropdown(!showCampaignDropdown)}
                className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 transition-colors min-w-[300px]"
              >
                <span className="flex-1 text-left text-sm font-medium text-gray-700 truncate">
                  {currentProject ? currentProject.name : "Sélectionner une campagne"}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCampaignDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown des campagnes */}
              {showCampaignDropdown && (
                <>
                  {/* Overlay pour fermer le dropdown */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowCampaignDropdown(false)}
                  />
                  
                  <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 max-h-96 overflow-y-auto">
                    {/* Bouton "Nouvelle Campagne" */}
                    <button
                      onClick={() => {
                        createNewProject();
                        setShowCampaignDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 border-b border-gray-100 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Nouvelle Campagne</span>
                    </button>

                    {/* Liste des campagnes */}
                    {projects.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        Aucune campagne sauvegardée
                      </div>
                    ) : (
                      <div className="py-2">
                        {projects.map((project) => {
                          const isActive = currentProject?.id === project.id;
                          
                          // Calculer les KPIs
                          let margin = 0;
                          if (project.inputMode === "CPM Cost") {
                            if (project.cpmRevenueActual > 0) {
                              margin = ((project.cpmRevenueActual - project.cpmCostActuel) / project.cpmRevenueActual) * 100;
                            }
                          } else {
                            margin = project.margeInput;
                          }

                          return (
                            <button
                              key={project.id}
                              onClick={() => {
                                loadProject(project.id);
                                setShowCampaignDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                                isActive ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex-1 text-left">
                                <div className={`font-bold ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                                  {project.name}
                                </div>
                                {project.dailyEntries && project.dailyEntries.length > 0 && (
                                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                    <span>{margin.toFixed(1)}% marge</span>
                                    <span>•</span>
                                    <span>{project.budgetSpent.toFixed(0)} {project.currency.includes("EUR") ? "€" : "$"}</span>
                                  </div>
                                )}
                              </div>
                              {isActive && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <Layout className="w-5 h-5" />
            </button>
            <button className="text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button onClick={logout} className="text-gray-400 hover:text-red-600 transition-colors" title="Se déconnecter">
              <LogOut className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
              {localUser.initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          {activeTab === "cockpit" && <CockpitYield project={activeProject} onChange={setCurrentProject} />}
          {activeTab === "tracking" && <CampaignTracking project={activeProject} onChange={setCurrentProject} />}
          {activeTab === "insights" && <Insights project={activeProject} />}
          {activeTab === "cycle" && <OptimizationCycle project={activeProject} />}
          {activeTab === "portfolio" && <Portfolio projects={projects} />}
          {activeTab === "market" && <MarketWatch currentCost={activeProject.cpmCostActuel} />}
          {activeTab === "settings" && <Settings />}
          
          {activeTab === "help" && (
            <div className="flex items-center justify-center h-full bg-white">
              <h1 className="text-3xl font-bold text-gray-900">
                Contactez Pierre Chartier
              </h1>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
