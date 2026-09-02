// Derived-data helpers for the Habits app — everything here is computed at
// render time from the raw event log (HabitEntry timestamps), never stored.
import { addDays, startOfWeekMonday, toISO } from "./dateUtils.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatRelativeTime(ts, now = Date.now()) {
  if (ts == null) return "never";
  const diffMs = Math.max(0, now - ts);
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}

// Summary stats for one habit's entries (array of epoch-ms timestamps).
export function habitStats(timestamps, now = Date.now()) {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const count = sorted.length;
  const lastTs = count ? sorted[count - 1] : null;
  const last7 = sorted.filter((t) => now - t <= 7 * DAY_MS).length;
  const last30 = sorted.filter((t) => now - t <= 30 * DAY_MS).length;
  const avgGapDays = count >= 2 ? (sorted[count - 1] - sorted[0]) / (count - 1) / DAY_MS : null;
  return { count, lastTs, last7, last30, avgGapDays };
}

// Most recent timestamp among entries tagged with `tagId`, or null if that
// tag has never been logged. `entries` are full HabitEntry objects (needs
// tagIds, not just the ts list `habitStats` takes).
export function lastUsedByTag(entries, tagId) {
  let last = null;
  for (const e of entries) {
    if ((e.tagIds || []).includes(tagId) && (last === null || e.ts > last)) last = e.ts;
  }
  return last;
}

// GitHub-style contribution grid: `weeks` columns of 7 days (Mon..Sun),
// ending on the current week, each day carrying how many entries landed on
// it (bucketed in local time, same as the rest of the date helpers).
export function buildHeatmapGrid(timestamps, weeks, today) {
  const counts = new Map();
  for (const ts of timestamps) {
    const iso = toISO(new Date(ts));
    counts.set(iso, (counts.get(iso) || 0) + 1);
  }
  const currentWeekStart = startOfWeekMonday(today);
  const gridStart = addDays(currentWeekStart, -7 * (weeks - 1));
  const columns = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(gridStart, w * 7);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const iso = toISO(date);
      days.push({ date, iso, count: counts.get(iso) || 0, future: date > today });
    }
    columns.push(days);
  }
  return columns;
}
