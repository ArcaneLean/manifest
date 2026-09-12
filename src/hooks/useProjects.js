import { useEffect, useState } from "react";
import { listProjects, putProject, deleteProject } from "../lib/projectsRepo.js";

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listProjects().then((loaded) => {
      if (!cancelled) {
        setProjects(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addProject = ({ name, color }) => {
    const project = { id: crypto.randomUUID(), name, color };
    setProjects((prev) => [...prev, project]);
    putProject(project);
    return project;
  };

  const updateProject = (id, { name, color }) => {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, name, color } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) putProject(updated);
      return next;
    });
  };

  const removeProject = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    deleteProject(id);
  };

  return { projects, loading, addProject, updateProject, removeProject };
}
