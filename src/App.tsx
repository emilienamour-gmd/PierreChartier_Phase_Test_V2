import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { CockpitYield } from "./components/CockpitYield";
import { OptimizationCycle } from "./components/OptimizationCycle";
import { Portfolio } from "./components/Portfolio";
import { MarketWatch } from "./components/MarketWatch";
import { Settings } from "./components/Settings";
import { Auth } from "./components/Auth";
import { IntroVideo } from "./components/IntroVideo";
import { useProjectStore } from "./store/useProjectStore";
import { useUserStore } from "./store/useUserStore";
import { DEFAULT_PROJECT } from "./types";
import { Search, Bell, Layout, LogOut } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("cockpit");
  const [showIntro, setShowIntro] = useState(true);

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
          <div className="flex items-center text-sm text-gray-500">
            <span className="text-gray-400">Dashboard</span>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">{tabTitles[activeTab]}</span>
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
