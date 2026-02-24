import { useState, useEffect } from "react";
import { ProjectData, DEFAULT_PROJECT } from "../types";

export function useProjectStore() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);

  // 1. CHARGEMENT : Au lancement, on lit la mémoire du navigateur
  useEffect(() => {
    try {
      const saved = localStorage.getItem("yield_projects");
      if (saved) {
        setProjects(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Erreur de lecture sauvegarde:", e);
    }
  }, []);

  // 2. SAUVEGARDE : Fonction qui enregistre dans le navigateur
  const saveProject = (projectData: ProjectData) => {
    // a. On prépare la nouvelle liste
    let updatedProjects = [...projects];
    const existingIndex = projects.findIndex((p) => p.id === projectData.id);

    if (existingIndex >= 0) {
      // Mise à jour
      updatedProjects[existingIndex] = { ...projectData, lastModified: Date.now() };
    } else {
      // Nouveau projet
      updatedProjects.push({ ...projectData, lastModified: Date.now() });
    }

    // b. On écrit dans la mémoire (C'est ça qui sauvegarde vraiment)
    localStorage.setItem("yield_projects", JSON.stringify(updatedProjects));

    // c. On met à jour l'écran
    setProjects(updatedProjects);
    setCurrentProject(projectData);
    
    // Petit message pour confirmer (visible dans la console F12)
    console.log("✅ Sauvegardé localement !");
  };

  const loadProject = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      setCurrentProject(project);
    }
  };

  const deleteProject = (id: string) => {
    const updatedProjects = projects.filter((p) => p.id !== id);
    localStorage.setItem("yield_projects", JSON.stringify(updatedProjects));
    setProjects(updatedProjects);
    
    if (currentProject?.id === id) {
      setCurrentProject(null);
    }
  };

  const createNewProject = () => {
    const newProject = { 
      ...DEFAULT_PROJECT, 
      id: Date.now().toString(),
      name: "Nouveau Projet",
      lastModified: Date.now() 
    };
    setCurrentProject(newProject);
  };

  return {
    projects,
    currentProject,
    setCurrentProject, // Permet de modifier le projet en temps réel
    saveProject,
    deleteProject,
    loadProject,
    createNewProject,
  };
}
