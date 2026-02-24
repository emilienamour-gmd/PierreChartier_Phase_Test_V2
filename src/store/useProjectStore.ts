import { create } from "zustand";
import { ProjectData, DEFAULT_PROJECT } from "../types";

// On définit à quoi ressemble notre Store
interface ProjectStore {
  projects: ProjectData[];
  currentProject: ProjectData | null;
  isLoading: boolean;
  
  // Actions disponibles
  loadProject: (id: string) => void;
  saveProject: (project: ProjectData) => void;
  deleteProject: (id: string) => void;
  createNewProject: () => void;
  setCurrentProject: (project: ProjectData) => void;
}

// Petite fonction pour lire la mémoire du navigateur sans planter
const getSavedProjects = (): ProjectData[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("yield_projects");
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Erreur lecture sauvegarde:", e);
    return [];
  }
};

// CRÉATION DU STORE (ZUSTAND)
export const useProjectStore = create<ProjectStore>((set, get) => ({
  // 1. État initial
  projects: getSavedProjects(),
  currentProject: null,
  isLoading: false,

  // 2. Mettre à jour le projet actif (ex: quand on tape dans un champ)
  setCurrentProject: (project) => set({ currentProject: project }),

  // 3. Créer un nouveau projet vierge
  createNewProject: () => {
    const newProject: ProjectData = { 
        ...DEFAULT_PROJECT, 
        id: Date.now().toString(), // ID unique
        name: "Nouveau Projet",
        lastModified: Date.now() 
    };
    set({ currentProject: newProject });
  },

  // 4. SAUVEGARDER (Le cœur du problème résolu)
  saveProject: (projectData) => {
    // a. On récupère la liste actuelle
    const currentProjects = get().projects;
    
    // b. On vérifie si c'est une mise à jour ou une création
    const existingIndex = currentProjects.findIndex(p => p.id === projectData.id);
    
    let updatedProjects;
    
    if (existingIndex >= 0) {
      // Mise à jour : On remplace l'ancien
      updatedProjects = [...currentProjects];
      updatedProjects[existingIndex] = { ...projectData, lastModified: Date.now() };
    } else {
      // Création : On ajoute à la fin
      updatedProjects = [...currentProjects, { ...projectData, lastModified: Date.now() }];
    }

    // c. CRUCIAL : On écrit dans le navigateur
    localStorage.setItem("yield_projects", JSON.stringify(updatedProjects));

    // d. On met à jour l'application
    set({ 
      projects: updatedProjects,
      currentProject: projectData 
    });
    
    console.log("💾 Projet sauvegardé avec succès :", projectData.name);
  },

  // 5. Charger un projet depuis la liste
  loadProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (project) {
      set({ currentProject: project });
    }
  },

  // 6. Supprimer
  deleteProject: (id) => {
    const updatedProjects = get().projects.filter((p) => p.id !== id);
    localStorage.setItem("yield_projects", JSON.stringify(updatedProjects));
    
    // Si on supprime le projet en cours, on le ferme
    const current = get().currentProject;
    set({ 
      projects: updatedProjects,
      currentProject: current?.id === id ? null : current
    });
  }
}));
