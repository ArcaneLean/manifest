// Which work tasks show where, and in what order — see ARCHITECTURE.md §7
// ("Work tasks"). Pure.
import { addDaysISO } from "../hours2/week.js";
import { priorityOf, notStartedYet, isOpen } from "./model.js";

// Soonest due first (hard deadlines before soft ones on the same day), then
// priority, then oldest first. Undated tasks sort after dated ones.
export function compareTasks(a, b) {
  const da = a.dueDate || null;
  const db = b.dueDate || null;
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  }
  if (!!a.hardDeadline !== !!b.hardDeadline) return a.hardDeadline ? -1 : 1;
  const p = priorityOf(a).rank - priorityOf(b).rank;
  if (p) return p;
  return (a.createdAt || 0) - (b.createdAt || 0);
}

export function sortTasks(tasks) {
  return [...tasks].sort(compareTasks);
}

export function isOverdue(task, todayISO) {
  return isOpen(task) && !!task.dueDate && task.dueDate < todayISO;
}

// The Now view. Each open task lands in at most one section, first match
// wins: doing → overdue → due within `horizonDays` → high priority. Waiting
// is its own group (longest-waiting first). Tasks with a future startDate
// are left out, unless they're already in progress. The rest of the todo
// list is only counted (`otherCount`) — it lives on the Board.
export function nowSections(tasks, todayISO, horizonDays = 7) {
  const horizon = addDaysISO(todayISO, horizonDays);
  const out = { doing: [], overdue: [], dueSoon: [], high: [], waiting: [], otherCount: 0, inboxCount: 0 };
  for (const t of tasks) {
    if (!isOpen(t)) continue;
    if (!t.projectId) out.inboxCount++;
    if (t.status === "doing") out.doing.push(t);
    else if (notStartedYet(t, todayISO)) continue;
    else if (t.status === "waiting") out.waiting.push(t);
    else if (t.dueDate && t.dueDate < todayISO) out.overdue.push(t);
    else if (t.dueDate && t.dueDate <= horizon) out.dueSoon.push(t);
    else if (t.priority === "high") out.high.push(t);
    else out.otherCount++;
  }
  out.doing = sortTasks(out.doing);
  out.overdue = sortTasks(out.overdue);
  out.dueSoon = sortTasks(out.dueSoon);
  out.high = sortTasks(out.high);
  out.waiting.sort((a, b) => (a.statusChangedAt || 0) - (b.statusChangedAt || 0));
  return out;
}

// Whole days since the task went to "waiting" — the `[005]` counter.
export function daysWaiting(task, now = Date.now()) {
  return Math.max(0, Math.floor((now - (task.statusChangedAt ?? now)) / 86400000));
}

// Estimated effort of open tasks due on or before `endISO` (overdue included).
export function effortDueBy(tasks, endISO) {
  return tasks.reduce((sum, t) => (isOpen(t) && t.dueDate && t.dueDate <= endISO ? sum + (t.effortMin || 0) : sum), 0);
}

// Board filter. Empty `projectIds`/`tagIds` = no filter; "inbox" in
// `projectIds` matches tasks without a project.
export function filterTasks(tasks, { status, projectIds = [], tagIds = [] } = {}) {
  return tasks.filter(
    (t) =>
      (!status || t.status === status) &&
      (projectIds.length === 0 || projectIds.includes(t.projectId || "inbox")) &&
      (tagIds.length === 0 || (t.tags || []).some((id) => tagIds.includes(id)))
  );
}

// Per project: open count and estimated effort still open.
export function projectStats(tasks) {
  const out = {};
  for (const t of tasks) {
    const key = t.projectId || "inbox";
    const s = (out[key] ||= { open: 0, total: 0, effortOpen: 0 });
    s.total++;
    if (isOpen(t)) {
      s.open++;
      s.effortOpen += t.effortMin || 0;
    }
  }
  return out;
}
