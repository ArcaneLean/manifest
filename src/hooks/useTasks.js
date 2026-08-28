import { useEffect, useState } from "react";
import { listTasks, putTask, deleteTask } from "../lib/tasksRepo.js";

// Completed tasks older than this are purged automatically on load — there's
// no settings view yet to make this configurable (see ARCHITECTURE.md §7).
const COMPLETED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listTasks().then((loaded) => {
      if (cancelled) return;
      const cutoff = Date.now() - COMPLETED_RETENTION_MS;
      const expiredIds = new Set(
        loaded.filter((t) => t.done && t.completedAt && t.completedAt < cutoff).map((t) => t.id)
      );
      expiredIds.forEach((id) => deleteTask(id));
      setTasks(loaded.filter((t) => !expiredIds.has(t.id)));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTask = (id) => {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : null } : t
      );
      const updated = next.find((t) => t.id === id);
      if (updated) putTask(updated);
      return next;
    });
  };

  const addTask = ({ text, urgent, important, tags: taskTags, startDate, dueDate }) => {
    const task = {
      id: crypto.randomUUID(),
      text,
      done: false,
      urgent,
      important,
      tags: taskTags,
      startDate: startDate || null,
      dueDate: dueDate || null,
      createdAt: Date.now(),
      completedAt: null,
    };
    setTasks((prev) => [...prev, task]);
    putTask(task);
  };

  const removeTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteTask(id);
  };

  const updateTask = (id, updates) => {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) putTask(updated);
      return next;
    });
  };

  return { tasks, loading, toggleTask, addTask, removeTask, updateTask };
}
