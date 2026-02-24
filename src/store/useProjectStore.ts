import { useState, useEffect } from "react";
import { ProjectData } from "../types";
import { useUserStore } from "./useUserStore";

export function useProjectStore() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const { user } = useUserStore();

  const fetchProjects = async () => {
    if (!user?.token) return;
    try {
      const res = await myFetch("/api/projects", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // The API returns { id, name, created_at, updated_at }.
        // We need to fetch full project data when loading.
        // For the sidebar, we just need the list.
        setProjects(data.projects.map((p: any) => ({
          id: p.id.toString(),
          name: p.name,
          lastModified: new Date(p.updated_at).getTime(),
          // Add dummy data for the rest to satisfy type, or make them optional
          // In a real app we'd have a ProjectSummary type
          client: "", campaignName: "", currency: "EUR", budget: 0, durationDays: 0,
          cpmSoldCap: 0, kpiType: "CPA", targetKpi: 0, actualKpi: 0, cpmRevenueActual: 0,
          cpmCostActuel: 0, marginPctActuelle: 0, lineItems: []
        } as unknown as ProjectData)));
      }
    } catch (e) {
      console.error("Failed to fetch projects", e);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const saveProject = async (project: ProjectData) => {
    if (!user?.token) return;
    
    try {
      const isNew = !projects.find(p => p.id === project.id) || project.id.length > 10; // Simple heuristic for temp ID
      
      if (isNew) {
        const res = await myFetch("/api/projects", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}` 
          },
          body: JSON.stringify({ name: project.name, data: project }),
        });
        if (res.ok) {
          const data = await res.json();
          const newProject = { ...project, id: data.id.toString() };
          setCurrentProject(newProject);
          fetchProjects();
        }
      } else {
        const res = await myFetch(`/api/projects/${project.id}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}` 
          },
          body: JSON.stringify({ name: project.name, data: project }),
        });
        if (res.ok) {
          setCurrentProject(project);
          fetchProjects();
        }
      }
    } catch (e) {
      console.error("Failed to save project", e);
    }
  };

  const deleteProject = async (id: string) => {
    if (!user?.token) return;
    try {
      const res = await myFetch(`/api/projects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (currentProject?.id === id) {
          setCurrentProject(null);
        }
      }
    } catch (e) {
      console.error("Failed to delete project", e);
    }
  };

  const loadProject = async (id: string) => {
    if (!user?.token) return;
    try {
      const res = await myFetch(`/api/projects/${id}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentProject({ ...data.project.data, id: data.project.id.toString() });
      }
    } catch (e) {
      console.error("Failed to load project", e);
    }
  };

  const createNewProject = () => {
    setCurrentProject(null);
  };

  return {
    projects,
    currentProject,
    setCurrentProject,
    saveProject,
    deleteProject,
    loadProject,
    createNewProject,
  };
}
