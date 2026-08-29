import { useEffect, useState } from "react";
import { listTasks, putTask, deleteTask } from "../lib/tasksRepo.js";
import { getTemplate } from "../lib/templatesRepo.js";
import { advanceOnce } from "../lib/recurrence.js";
import { toISO, parseISODate } from "../lib/dateUtils.js";

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

  // Completing a task linked to a recurring template (its "anchor" — see
  // ARCHITECTURE.md §7) instantiates the next occurrence, stepped forward
  // from the anchor's own planned dueDate rather than today's date, so
  // completing early never skips ahead in the schedule.
  const spawnNextOccurrence = async (anchorTask) => {
    const template = await getTemplate(anchorTask.templateId);
    if (!template?.recurring || !anchorTask.dueDate) return;
    const nextDate = advanceOnce(template.recurring, parseISODate(anchorTask.dueDate));
    const nextTask = {
      id: crypto.randomUUID(),
      text: template.text,
      done: false,
      urgent: template.urgent,
      important: template.important,
      tags: template.tags,
      startDate: null,
      dueDate: toISO(nextDate),
      templateId: template.id,
      createdAt: Date.now(),
      completedAt: null,
    };
    setTasks((prev) => [...prev, nextTask]);
    putTask(nextTask);
  };

  // Reads `tasks` (this hook's own state, not the setTasks updater's `prev`)
  // to compute the toggled task, so the side effects below (putTask,
  // spawnNextOccurrence) run exactly once — React may invoke a setState
  // updater function more than once per call (e.g. Strict Mode in dev), and
  // spawnNextOccurrence isn't idempotent: it mints a new task id each time.
  const toggleTask = (id) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const updated = { ...current, done: !current.done, completedAt: !current.done ? Date.now() : null };
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    putTask(updated);
    if (updated.done && updated.templateId) spawnNextOccurrence(updated);
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
      templateId: null,
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
