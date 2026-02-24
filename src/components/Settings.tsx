import { useUserStore, Theme } from "../store/useUserStore";
import { User, Palette, Save } from "lucide-react";
import { cn } from "../utils/cn";

export function Settings() {
  const { user, updateTheme, updateProfile } = useUserStore();

  const themes: { id: Theme; label: string; color: string }[] = [
    { id: "salesin", label: "Salesin (Défaut)", color: "bg-gray-100 border-gray-200" },
    { id: "light", label: "Clair Minimaliste", color: "bg-white border-gray-200" },
    { id: "dark", label: "Mode Sombre", color: "bg-gray-900 border-gray-700" },
    { id: "blue", label: "Bleu Océan", color: "bg-blue-900 border-blue-700" },
  ];

  return (
    <div className="p-8 h-full overflow-y-auto bg-[#f8f9fa]">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Paramètres du Profil</h2>
          <p className="text-sm text-gray-500 mt-1">Gérez vos informations personnelles et l'apparence de l'application.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8">
          
          {/* Profil */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Informations Personnelles</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nom complet</label>
                <input 
                  type="text" 
                  className="w-full text-sm border-gray-200 bg-gray-50 rounded-xl p-3 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={user.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
                    updateProfile({ name, initials });
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Initiales</label>
                <input 
                  type="text" 
                  className="w-full text-sm border-gray-200 bg-gray-50 rounded-xl p-3 border outline-none opacity-70 cursor-not-allowed"
                  value={user.initials}
                  disabled
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Apparence */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Apparence (Thème)</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => updateTheme(t.id)}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                    user.theme === t.id ? "border-blue-500 bg-blue-50/50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <div className={cn("w-full h-16 rounded-lg border shadow-sm", t.color)}></div>
                  <span className="text-sm font-bold text-gray-700">{t.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              * Note : Le changement de thème est simulé dans cette démo. Pour un vrai mode sombre, il faudrait configurer Tailwind CSS en conséquence.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
