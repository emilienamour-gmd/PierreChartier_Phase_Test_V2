import { create } from "zustand";
import { persist } from "zustand/middleware";

// Types de thèmes disponibles
export type Theme = "salesin" | "biggie" | "gamned" | "light" | "dark";

// Interface utilisateur
interface User {
  name: string;
  initials: string;
  theme: Theme;
}

// Interface du store
interface UserStore {
  user: User;
  updateProfile: (updates: Partial<Omit<User, "theme">>) => void;
  updateTheme: (theme: Theme) => void;
}

// Création du store avec persistance
export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: {
        name: "Trader Expert",
        initials: "TE",
        theme: "salesin",
      },
      
      // Mettre à jour le profil (nom, initiales)
      updateProfile: (updates) =>
        set((state) => ({
          user: { ...state.user, ...updates },
        })),
      
      // Mettre à jour le thème
      updateTheme: (theme) => {
        set((state) => ({
          user: { ...state.user, theme },
        }));
        
        // Appliquer le thème au DOM immédiatement
        document.documentElement.setAttribute("data-theme", theme);
      },
    }),
    {
      name: "user-storage", // Nom de la clé dans localStorage
    }
  )
);
