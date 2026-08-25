// Work-hours time helpers — see ARCHITECTURE.md §4 (WorkLogEntry).
// Ported from prototypes/HoursView.jsx.

export function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function workedMinutes(entry) {
  if (!entry || !entry.start || !entry.end) return 0;
  const start = timeToMinutes(entry.start);
  const end = timeToMinutes(entry.end);
  const brk = entry.breakMin || 0;
  return Math.max(0, end - start - brk);
}

export function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
