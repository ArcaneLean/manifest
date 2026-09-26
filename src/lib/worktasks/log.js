// The Log view: done work tasks by ISO week, then project — see
// ARCHITECTURE.md §7 ("Work tasks"). Pure.
import { weekStartOf } from "../hours2/week.js";

// → [{ weekStart, count, groups: [{ projectId, tasks }] }], newest week first;
// groups ordered by most recent completion, tasks newest first.
export function logByWeek(tasks) {
  const done = tasks.filter((t) => t.status === "done" && t.completedAt).sort((a, b) => b.completedAt - a.completedAt);
  const weeks = new Map();
  for (const t of done) {
    const ws = weekStartOf(new Date(t.completedAt));
    if (!weeks.has(ws)) weeks.set(ws, new Map());
    const groups = weeks.get(ws);
    const key = t.projectId || null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...weeks.entries()].map(([weekStart, groups]) => ({
    weekStart,
    count: [...groups.values()].reduce((n, g) => n + g.length, 0),
    groups: [...groups.entries()].map(([projectId, list]) => ({ projectId, tasks: list })),
  }));
}
