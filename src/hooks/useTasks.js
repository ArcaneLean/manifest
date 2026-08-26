import { useEffect, useState } from "react";
import { listTasks, putTask, deleteTask } from "../lib/tasksRepo.js";

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listTasks().then((loaded) => {
      if (!cancelled) {
        setTasks(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTask = (id) => {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) putTask(updated);
      return next;
    });
  };

  const addTask = ({ text, urgent, important, tags: taskTags }) => {
    const task = {
      id: crypto.randomUUID(),
      text,
      done: false,
      urgent,
      important,
      tags: taskTags,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, task]);
    putTask(task);
  };

  const removeTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteTask(id);
  };

  return { tasks, loading, toggleTask, addTask, removeTask };
}
