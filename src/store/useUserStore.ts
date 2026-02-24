import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "blue" | "salesin";

export interface UserProfile {
  id: string;
  name: string;
  initials: string;
  theme: Theme;
  token?: string;
}

export function useUserStore() {
  // On essaye de récupérer l'utilisateur sauvegardé dans le navigateur
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem("userProfile");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  
  const [isLoading, setIsLoading] = useState(false); // Mis à false par défaut pour éviter le chargement infini

  // Sauvegarde automatique quand l'utilisateur change
  useEffect(() => {
    if (user) {
      localStorage.setItem("userProfile", JSON.stringify(user));
      // Appliquer le thème au body
      document.body.className = `theme-${user.theme || 'salesin'}`;
    } else {
      localStorage.removeItem("userProfile");
    }
  }, [user]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    
    // --- DÉBUT DE LA LOGIQUE MAGIQUE ---
    const usersAutorises = ["aygmd", "tfgmd", "eagmd"];
    
    // On vérifie si c'est un des 3 comptes spéciaux
    if (usersAutorises.includes(username.toLowerCase()) && password === "gmd") {
      
      // On simule une connexion réussie immédiatement
      const fakeUser: UserProfile = {
        id: `user-${username}`,
        name: username,
        initials: username.substring(0, 2).toUpperCase(),
        theme: "salesin",
        token: "fake-jwt-token-pour-vercel",
      };

      setUser(fakeUser);
      setIsLoading(false);
      return; // On s'arrête là, pas besoin d'appeler le serveur !
    }
    // --- FIN DE LA LOGIQUE MAGIQUE ---

    // Si ce n'est pas un des 3 comptes, on tente la méthode classique (qui risque d'échouer sur Vercel)
    try {
      // @ts-ignore - On ignore l'erreur TypeScript sur myFetch car il est global
      const res = await window.myFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      
      if (!res.ok) {
        throw new Error("Nom d'utilisateur ou mot de passe incorrect");
      }
      
      const data = await res.json();
      setUser({
        id: data.user.id,
        name: data.user.username,
        initials: data.user.username.substring(0, 2).toUpperCase(),
        theme: "salesin",
        token: data.token,
      });
    } catch (error: any) {
      console.error(error);
      throw new Error("Erreur de connexion : Utilisez un des comptes pré-configurés.");
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, password: string) => {
    setIsLoading(true);
    // Sur Vercel sans DB externe, l'inscription ne marchera pas bien.
    // On affiche une erreur pour forcer l'usage des comptes pré-définis.
    setIsLoading(false);
    throw new Error("L'inscription est désactivée. Utilisez les comptes fournis (ex: eagmd / gmd).");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("userProfile");
    window.location.reload(); // Force le rechargement pour être propre
  };

  const updateTheme = (theme: Theme) => {
    setUser((prev) => (prev ? { ...prev, theme } : null));
  };

  const updateProfile = (profile: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...profile } : null));
  };

  return { user, isLoading, login, register, logout, updateTheme, updateProfile };
}
