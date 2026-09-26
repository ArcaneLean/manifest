// Work tasks record rules — see ARCHITECTURE.md §4/§7 ("Work tasks"). Pure:
// no IndexedDB/React, so it could move server-side unchanged (§6.2).
import { COLORS } from "../../theme/colors.js";

export const STATUSES = ["todo", "doing", "waiting", "done", "dropped"];
const OPEN = new Set(["todo", "doing", "waiting"]);

export const PRIORITIES = {
  high: { label: "high", color: COLORS.amber, rank: 0 },
  medium: { label: "medium", color: COLORS.amberDim, rank: 1 },
  low: { label: "low", color: COLORS.dim, rank: 2 },
};
export const PRIORITY_KEYS = ["high", "medium", "low"];
export const DEFAULT_PRIORITY = "medium";

export const PROJECT_STATUSES = ["active", "on-hold", "done"];

// Effort estimates move in the same 30m steps as Hours bookings.
export const EFFORT_STEP = 30;

export function isOpen(task) {
  return OPEN.has(task.status);
}

export function isClosed(task) {
  return !isOpen(task);
}

export function priorityOf(task) {
  return PRIORITIES[task.priority] || PRIORITIES[DEFAULT_PRIORITY];
}

// Not relevant yet: its startDate is still in the future.
export function notStartedYet(task, todayISO) {
  return !!task.startDate && task.startDate > todayISO;
}

export function newWorkTask(fields, now = Date.now()) {
  return withStatus(
    {
      id: crypto.randomUUID(),
      projectId: null,
      title: "",
      notes: "",
      waitingOn: null,
      priority: DEFAULT_PRIORITY,
      effortMin: null,
      startDate: null,
      dueDate: null,
      hardDeadline: false,
      checklist: [],
      link: null,
      tags: [],
      createdAt: now,
      completedAt: null,
      ...fields,
      status: "todo",
    },
    fields.status || "todo",
    now
  );
}

// Moves a task to `status`, keeping the bookkeeping fields consistent:
// completedAt only while done (the original time survives re-saving a done
// task), waitingOn only while waiting. No-op (same object) when unchanged.
export function withStatus(task, status, now = Date.now()) {
  if (!STATUSES.includes(status)) throw new Error(`unknown status ${status}`);
  if (task.status === status && task.statusChangedAt) return task;
  return {
    ...task,
    status,
    statusChangedAt: now,
    completedAt: status === "done" ? (task.status === "done" && task.completedAt) || now : null,
    waitingOn: status === "waiting" ? task.waitingOn || null : null,
  };
}

// Row checkbox: todo/doing/waiting → done, done/dropped → todo.
export function toggledStatus(task) {
  return isOpen(task) ? "done" : "todo";
}

// ± one step; null (no estimate) below one step.
export function stepEffort(min, delta) {
  const next = (min || 0) + delta * EFFORT_STEP;
  return next < EFFORT_STEP ? null : next;
}
