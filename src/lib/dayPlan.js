import { QUADRANTS, quadrantFor } from "./quadrant.js";
import { toISO } from "./dateUtils.js";

// Default wake time, used when a DayShape/override doesn't set its own (see
// ARCHITECTURE.md §7). Sleep end of the planning window has no equivalent
// per-day setting yet — no settings view exists to make it configurable
// (same posture as WeekTarget defaulting to 40h) — so it stays a constant.
export const DAY_START_MIN = 6 * 60 + 30; // 06:30
export const DAY_END_MIN = 23 * 60; // 23:00

export function minutesToClock(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDuration(min) {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

export function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

// Read-only Google Calendar events (see ARCHITECTURE.md §7) as informational
// markers on the Day Planner timeline — shown for visibility, never subtracted
// from the discretionary-time budget (they typically overlap a fixed work
// block already; double-subtracting would be wrong). Multi-day timed events
// are a known v1 gap — only an event whose local start day is `dateISO` is
// shown, same boundary CalendarView's own multi-day handling draws around.
export function gcalBlockForDate(event, dateISO) {
  if (!event.start || !event.end) return null;
  if (event.allDay) {
    if (dateISO >= event.start && dateISO < event.end) {
      return { kind: "gcal", label: event.summary || "(untitled)", startMin: -1, endMin: -1, allDay: true, htmlLink: event.htmlLink };
    }
    return null;
  }
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (toISO(start) !== dateISO) return null;
  return {
    kind: "gcal",
    label: event.summary || "(untitled)",
    startMin: start.getHours() * 60 + start.getMinutes(),
    endMin: end.getHours() * 60 + end.getMinutes(),
    htmlLink: event.htmlLink,
  };
}

// A task belongs on a given day's plan if it's overdue-or-due-by that date,
// explicitly started that day with no due date, or was already completed
// that day (shown checked rather than dropped) — the same actionable/dated
// semantics Tasks/Matrix already use (see taskDates.js's isScheduled), just
// narrowed from "actionable at all" to "actionable on this specific date".
export function isTaskForDate(task, dateISO, dayStartMs, dayEndMs) {
  if (task.done) return task.completedAt != null && task.completedAt >= dayStartMs && task.completedAt < dayEndMs;
  if (task.startDate && task.startDate > dateISO) return false;
  if (task.dueDate) return task.dueDate <= dateISO;
  return task.startDate === dateISO;
}

export function isHabitLoggedOnDate(entries, habitId, dayStartMs, dayEndMs) {
  return entries.some((e) => e.habitId === habitId && e.ts >= dayStartMs && e.ts < dayEndMs);
}

// A block is either `anchor: "fixed"` (a specific clock time, via
// `startMinutes`) or `anchor: "chained"` (starts right where the previous
// block in the list ends — or at the day's wake time, if it's first). This
// lets a sequence like wake -> morning routine -> commute all shift
// together when wake time changes, while something like dinner can still
// be pinned to a fixed clock time regardless of how the day before it ran.
// Legacy blocks (created before `anchor` existed) have `startMinutes` set
// and no `anchor` field — treated as "fixed", their original behavior.
//
// Resolution walks the list in array order (the order blocks are defined
// in — see DayShapeEditModal's reorder controls), since a chained block's
// start depends on *the previous block in that order*, not on time. A
// fixed block that starts before the running cursor (e.g. the prior block
// overran) doesn't push time backwards for what follows.
export function resolveBlocks(wakeMinutes, blockDefs) {
  let cursor = wakeMinutes;
  const resolved = [];
  for (const b of blockDefs) {
    const anchor = b.anchor === "chained" ? "chained" : "fixed";
    const startMin = anchor === "fixed" && b.startMinutes != null ? b.startMinutes : cursor;
    const endMin = startMin + b.durationMinutes;
    resolved.push({ id: b.id, label: b.label, anchor, startMin, endMin });
    cursor = Math.max(cursor, endMin);
  }
  return resolved;
}

// Builds a day's plan from a DayShape's blocks (resolved against the day's
// wake time — see `resolveBlocks`) plus whichever habits/tasks have been
// explicitly planned for the day (see useDayPlanItems — nothing is
// auto-included anymore): blocks carve out the day, what's left is
// "discretionary" time that habits (first — quick, routine-anchored) and
// tasks (by quadrant priority) are greedily packed into. Whatever doesn't
// fit is reported as overflow rather than silently dropped.
//
// `squeezeIds` is a Set of "task:<id>" / "habit:<id>" keys — an ephemeral,
// unpersisted override that forces an overflow item onto the plan anyway
// (see the Today view's "squeeze in" action), on top of the normal fill
// rather than competing with it for space.
export function buildDayPlan({ wakeMinutes = DAY_START_MIN, blocks = [], tasks, habits, squeezeIds = new Set(), taskOrder = [] }) {
  const fixed = resolveBlocks(wakeMinutes, blocks)
    .map((b) => ({ kind: "fixed", label: b.label, anchor: b.anchor, startMin: b.startMin, endMin: b.endMin }))
    .filter((b) => b.endMin > wakeMinutes && b.startMin < DAY_END_MIN)
    .sort((a, b) => a.startMin - b.startMin);

  // Free gaps: the complement of `fixed` blocks within the waking window.
  const gaps = [];
  let cursor = wakeMinutes;
  for (const block of fixed) {
    const start = Math.max(block.startMin, wakeMinutes);
    if (start > cursor) gaps.push({ startMin: cursor, endMin: start });
    cursor = Math.max(cursor, Math.min(block.endMin, DAY_END_MIN));
  }
  if (cursor < DAY_END_MIN) gaps.push({ startMin: cursor, endMin: DAY_END_MIN });

  const totalDiscretionaryMin = gaps.reduce((sum, g) => sum + (g.endMin - g.startMin), 0);

  const habitItems = habits.map((h) => ({
    kind: "habit",
    id: h.id,
    label: h.name,
    durationMin: h.estimatedMinutes || 0,
    done: h.done,
  }));
  const taskItems = tasks.map((t) => ({
    kind: "task",
    id: t.id,
    label: t.text,
    durationMin: t.estimatedMinutes || 0,
    done: t.done,
    quadrant: QUADRANTS[quadrantFor(t.urgent, t.important)],
  }));
  // Tasks explicitly planned for the day (present in `taskOrder`, the
  // dayplans row's `taskIds` array — see useDayPlanItems.js) get a real,
  // user-controlled sequence via the timeline's up/down reorder controls,
  // overriding quadrant priority within that opted-in set. A task that's
  // only on the plan because it's due today (not explicitly planned) has
  // no position in `taskOrder` and falls back to quadrant-rank order,
  // after every manually-ordered task.
  const orderIndex = new Map(taskOrder.map((id, i) => [id, i]));
  taskItems.sort((a, b) => {
    const ao = orderIndex.has(a.id) ? orderIndex.get(a.id) : Infinity;
    const bo = orderIndex.has(b.id) ? orderIndex.get(b.id) : Infinity;
    if (ao !== bo) return ao - bo;
    return a.quadrant.rank - b.quadrant.rank;
  });

  const items = [...habitItems, ...taskItems];
  const key = (i) => `${i.kind}:${i.id}`;
  const doneItems = items.filter((i) => i.done);
  const openItems = items.filter((i) => !i.done);
  const forcedItems = openItems.filter((i) => squeezeIds.has(key(i)));
  const normalItems = openItems.filter((i) => !squeezeIds.has(key(i)));

  const mutableGaps = gaps.map((g) => ({ ...g }));
  const scheduled = [];
  const overflow = [];

  for (const item of normalItems) {
    let placed = false;
    for (const gap of mutableGaps) {
      const room = gap.endMin - gap.startMin;
      if (item.durationMin <= room) {
        scheduled.push({ ...item, startMin: gap.startMin, endMin: gap.startMin + item.durationMin });
        gap.startMin += item.durationMin;
        placed = true;
        break;
      }
    }
    if (!placed) overflow.push(item);
  }

  // Forced ("squeezed in") items land on top of the normal fill, using
  // whatever gap room is left over, and overbook the last gap rather than
  // fail to place at all — "squeeze in" means accepting a tighter day, not
  // finding real spare capacity that doesn't exist.
  for (const item of forcedItems) {
    const gap = mutableGaps.find((g) => g.endMin > g.startMin) || mutableGaps[mutableGaps.length - 1];
    const startMin = gap ? gap.startMin : wakeMinutes;
    scheduled.push({ ...item, startMin, endMin: startMin + item.durationMin, squeezed: true });
    if (gap) gap.startMin += item.durationMin;
  }

  for (const item of doneItems) {
    scheduled.push({ ...item, startMin: null, endMin: null });
  }

  scheduled.sort((a, b) => (a.startMin ?? Infinity) - (b.startMin ?? Infinity));

  const usedMin = scheduled.filter((s) => s.startMin != null).reduce((sum, s) => sum + (s.endMin - s.startMin), 0);
  const freeMin = totalDiscretionaryMin - usedMin; // can go negative once something's squeezed in

  return { fixed, scheduled, overflow, totalDiscretionaryMin, usedMin, freeMin };
}
