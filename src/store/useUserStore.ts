import { create } from "zustand";
import { persist } from "zustand/middleware";

// Types de thèmes disponibles
export type Theme = "salesin" | "biggie" | "gamned" | "light" | "dark";

// Interface utilisateur
export interface UserProfile {
  name: string;
  initials: string;
  theme: Theme;
}

// Interface du store
interface UserStore {
  user: UserProfile | null;
  isLoading: boolean;
  
  // Authentification
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  
  // Profil
  updateProfile: (updates: Partial<Omit<UserProfile, "theme">>) => void;
  updateTheme: (theme: Theme) => void;
}

// Base de données locale (localStorage)
const USERS_KEY = "yield_users_db";
const CURRENT_USER_KEY = "yield_current_user";

interface StoredUser {
  username: string;
  password: string; // En production, on hashrait ça !
  profile: UserProfile;
}

// Fonctions helper localStorage
function getUsers(): StoredUser[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser(): UserProfile | null {
  try {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveCurrentUser(profile: UserProfile | null) {
  if (profile) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

// Création du store
export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: getCurrentUser(),
      isLoading: false,
      
      // LOGIN
      login: async (username: string, password: string) => {
        set({ isLoading: true });
        
        // Simule un délai réseau
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const users = getUsers();
        const foundUser = users.find(u => u.username === username && u.password === password);
        
        if (!foundUser) {
          set({ isLoading: false });
          throw new Error("Nom d'utilisateur ou mot de passe incorrect");
        }
        
        saveCurrentUser(foundUser.profile);
        set({ user: foundUser.profile, isLoading: false });
      },
      
      // REGISTER
      register: async (username: string, password: string) => {
        set({ isLoading: true });
        
        // Simule un délai réseau
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const users = getUsers();
        
        // Vérifier si l'utilisateur existe
        if (users.some(u => u.username === username)) {
          set({ isLoading: false });
          throw new Error("Ce nom d'utilisateur est déjà pris");
        }
        
        // Créer le nouveau profil
        const initials = username.substring(0, 2).toUpperCase();
        const newProfile: UserProfile = {
          name: username,
          initials,
          theme: "salesin"
        };
        
        // Sauvegarder
        const newUser: StoredUser = {
          username,
          password,
          profile: newProfile
        };
        
        users.push(newUser);
        saveUsers(users);
        saveCurrentUser(newProfile);
        
        set({ user: newProfile, isLoading: false });
      },
      
      // LOGOUT
      logout: () => {
        saveCurrentUser(null);
        set({ user: null });
      },
      
      // Mettre à jour le profil
      updateProfile: (updates) => {
        const currentUser = get().user;
        if (!currentUser) return;
        
        const updatedUser = { ...currentUser, ...updates };
        saveCurrentUser(updatedUser);
        set({ user: updatedUser });
      },
      
      // Mettre à jour le thème
      updateTheme: (theme) => {
        const currentUser = get().user;
        if (!currentUser) return;
        
        const updatedUser = { ...currentUser, theme };
        saveCurrentUser(updatedUser);
        set({ user: updatedUser });
        
        // Appliquer le thème au DOM
        document.documentElement.setAttribute("data-theme", theme);
      },
    }),
    {
      name: "user-storage",
    }
  )
);
