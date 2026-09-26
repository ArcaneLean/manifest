import { useEffect, useState } from "react";
import { listWorkProjects, putWorkProject, deleteWorkProject } from "../lib/workProjectsRepo.js";

// Work projects — see ARCHITECTURE.md §7 ("Work tasks"). `codeId` optionally
// links a project to a Hours booking code (what ▶ clocks in on).
export function useWorkProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listWorkProjects().then((loaded) => {
      if (cancelled) return;
      setProjects(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addProject = ({ name, color, codeId = null, status = "active" }) => {
    const project = { id: crypto.randomUUID(), name, color, codeId, status, archived: false, createdAt: Date.now() };
    setProjects((prev) => [...prev, project]);
    putWorkProject(project);
    return project;
  };

  const updateProject = (id, patch) => {
    const current = projects.find((p) => p.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    putWorkProject(updated);
  };

  const removeProject = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    deleteWorkProject(id);
  };

  return { projects, loading, addProject, updateProject, removeProject };
}
