import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "salesin" | "biggie" | "gamned" | "light" | "dark";

interface User {
  name: string;
  initials: string;
  theme: Theme;
}

interface UserStore {
  user: User;
  updateProfile: (updates: Partial<Omit<User, "theme">>) => void;
  updateTheme: (theme: Theme) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: {
        name: "Trader Expert",
        initials: "TE",
        theme: "salesin",
      },
      updateProfile: (updates) =>
        set((state) => ({
          user: { ...state.user, ...updates },
        })),
      updateTheme: (theme) => {
        set((state) => ({
          user: { ...state.user, theme },
        }));
        // Appliquer le thème au DOM
        document.documentElement.setAttribute("data-theme", theme);
      },
    }),
    {
      name: "user-storage",
    }
  )
);
