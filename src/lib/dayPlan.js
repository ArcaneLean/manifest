import { QUADRANTS, quadrantFor } from "./quadrant.js";
import { toISO } from "./dateUtils.js";

// No settings view yet to make this configurable (see ARCHITECTURE.md §7,
// same posture as WeekTarget defaulting to 40h) — a fixed waking window
// stands in for a per-user wake/sleep setting.
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
// markers on the Today timeline — shown for visibility, never subtracted
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

// A task belongs on today's plan if it's overdue-or-due-today, explicitly
// started today with no due date, or was already completed today (shown
// checked rather than dropped) — the same actionable/dated semantics
// Tasks/Matrix already use (see taskDates.js's isScheduled), just narrowed
// from "actionable at all" to "actionable today specifically".
export function isTaskForToday(task, todayISO, dayStartMs, dayEndMs) {
  if (task.done) return task.completedAt != null && task.completedAt >= dayStartMs && task.completedAt < dayEndMs;
  if (task.startDate && task.startDate > todayISO) return false;
  if (task.dueDate) return task.dueDate <= todayISO;
  return task.startDate === todayISO;
}

export function isHabitLoggedToday(entries, habitId, dayStartMs, dayEndMs) {
  return entries.some((e) => e.habitId === habitId && e.ts >= dayStartMs && e.ts < dayEndMs);
}

// Builds today's plan from a DayShape's fixed blocks plus the habits/tasks
// that still need doing: fixed blocks carve out the day, what's left is
// "discretionary" time that habits (first — quick, routine-anchored) and
// tasks (by quadrant priority) are greedily packed into. Whatever doesn't
// fit is reported as overflow rather than silently dropped.
//
// `squeezeIds` is a Set of "task:<id>" / "habit:<id>" keys — an ephemeral,
// unpersisted override that forces an overflow item onto the plan anyway
// (see the Today view's "squeeze in" action), on top of the normal fill
// rather than competing with it for space.
export function buildDayPlan({ dayShape, tasks, habits, squeezeIds = new Set() }) {
  const fixed = (dayShape?.blocks || [])
    .map((b) => ({
      kind: "fixed",
      label: b.label,
      startMin: b.startMinutes,
      endMin: b.startMinutes + b.durationMinutes,
    }))
    .filter((b) => b.endMin > DAY_START_MIN && b.startMin < DAY_END_MIN)
    .sort((a, b) => a.startMin - b.startMin);

  // Free gaps: the complement of `fixed` blocks within the waking window.
  const gaps = [];
  let cursor = DAY_START_MIN;
  for (const block of fixed) {
    const start = Math.max(block.startMin, DAY_START_MIN);
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
  taskItems.sort((a, b) => a.quadrant.rank - b.quadrant.rank);

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
    const startMin = gap ? gap.startMin : DAY_START_MIN;
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
