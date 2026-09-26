import { useEffect, useState } from "react";
import { listWorkTasks, putWorkTask, deleteWorkTask } from "../lib/workTasksRepo.js";
import { newWorkTask, withStatus } from "../lib/worktasks/model.js";

// Work tasks — see ARCHITECTURE.md §7 ("Work tasks"). Unlike useTasks there's
// no auto-purge of completed tasks: the Log view is built from them.
export function useWorkTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listWorkTasks().then((loaded) => {
      if (cancelled) return;
      setTasks(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addTask = (fields) => {
    const task = newWorkTask(fields);
    setTasks((prev) => [...prev, task]);
    putWorkTask(task);
    return task;
  };

  // A `status` in `patch` goes through withStatus so completedAt/waitingOn/
  // statusChangedAt stay consistent. Reads `tasks` (not the updater's
  // `prev`) so the put runs exactly once — same reason as useTasks.toggleTask.
  const updateTask = (id, patch) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const { status, ...rest } = patch;
    let updated = { ...current, ...rest };
    if (status) updated = withStatus(updated, status);
    if (status === "waiting" && "waitingOn" in rest) updated.waitingOn = rest.waitingOn || null;
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    putWorkTask(updated);
  };

  const setStatus = (id, status) => updateTask(id, { status });

  const removeTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteWorkTask(id);
  };

  // Deleting a work tag strips it from every task that has it.
  const stripTag = (tagId) => {
    const changed = tasks.filter((t) => (t.tags || []).includes(tagId)).map((t) => ({ ...t, tags: t.tags.filter((x) => x !== tagId) }));
    if (changed.length === 0) return;
    const byId = new Map(changed.map((t) => [t.id, t]));
    setTasks((prev) => prev.map((t) => byId.get(t.id) || t));
    changed.forEach(putWorkTask);
  };

  return { tasks, loading, addTask, updateTask, setStatus, removeTask, stripTag };
}
