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
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem("userProfile");
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      localStorage.setItem("userProfile", JSON.stringify(user));
      document.body.className = `theme-${user.theme}`;
    } else {
      localStorage.removeItem("userProfile");
    }
    setIsLoading(false);
  }, [user]);

  const login = async (username: string, password: string) => {
    const res = await myFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed");
    }
    
    const data = await res.json();
    setUser({
      id: data.user.id,
      name: data.user.username,
      initials: data.user.username.substring(0, 2).toUpperCase(),
      theme: "salesin",
      token: data.token,
    });
  };

  const register = async (username: string, password: string) => {
    const res = await myFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Registration failed");
    }
    
    const data = await res.json();
    setUser({
      id: data.user.id,
      name: data.user.username,
      initials: data.user.username.substring(0, 2).toUpperCase(),
      theme: "salesin",
      token: data.token,
    });
  };

  const logout = () => {
    setUser(null);
  };

  const updateTheme = (theme: Theme) => {
    setUser((prev) => prev ? { ...prev, theme } : null);
  };

  const updateProfile = (profile: Partial<UserProfile>) => {
    setUser((prev) => prev ? { ...prev, ...profile } : null);
  };

  return { user, isLoading, login, register, logout, updateTheme, updateProfile };
}
