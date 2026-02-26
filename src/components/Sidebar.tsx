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
  ChevronRight  
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
  { id: "cockpit", label: "Cockpit Yield", icon: LayoutDashboard },
  { id: "cycle", label: "Cycle des Optimisations", icon: RefreshCw },
  { id: "portfolio", label: "Portfolio & Performance", icon: Briefcase },
  { id: "market", label: "Market Watch", icon: LineChart },
];

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
  
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
          {user.initials}
        </div>
        <span className="font-bold text-gray-900 text-lg truncate">{user.name}</span>
      </div>

      <div className="px-4 py-2 flex-1 overflow-y-auto">
        <div className="mb-8">
          <div className="text-xs font-semibold text-gray-400 mb-3 px-3 uppercase tracking-wider">Main Menu</div>
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

       {activeTab === "cockpit" && (
  <div className="mb-8">
    {/* Header Campagnes avec bouton déroulant */}
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
    
    {/* Menu déroulant */}
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

        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onLoadProject(p.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
              currentProject?.id === p.id
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <span className="truncate">{p.name}</span>
          </button>
        ))}
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
                  <Trash2 className="w-5 h-5" />
                  Supprimer
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-gray-200 space-y-1">
         <div className="text-xs font-semibold text-gray-400 mb-3 px-3 uppercase tracking-wider">Settings</div>
         
         {/* BOUTON HELP CENTER MODIFIÉ */}
         <button 
            onClick={() => setActiveTab("help")} // Active l'onglet Help
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
