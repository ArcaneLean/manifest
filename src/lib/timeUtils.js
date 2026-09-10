// Work-hours time helpers — see ARCHITECTURE.md §4 (WorkLogEntry).
// Ported from prototypes/HoursView.jsx.

export function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// A day is "done" once both a start and an end are logged. A clocked-in-only
// entry (start set, end still null) hasn't happened yet as far as the
// balance is concerned.
export function isCompleteEntry(entry) {
  return !!(entry && entry.start && entry.end);
}

export function workedMinutes(entry) {
  if (!isCompleteEntry(entry)) return 0;
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

// Signed variant for balance figures (formatMinutes mishandles negatives —
// JS's % keeps the sign of the dividend, e.g. -70 % 60 === -10).
export function formatSignedMinutes(min) {
  const sign = min < 0 ? "-" : "+";
  return `${sign}${formatMinutes(Math.abs(min))}`;
}

// Sum of (worked - normalDayMin) across every completed day — the running
// flex-time balance. Open (clocked-in-only) entries don't count yet.
export function balanceMinutes(entries, normalDayMin) {
  return entries.filter(isCompleteEntry).reduce((sum, e) => sum + workedMinutes(e) - normalDayMin, 0);
}

export function nowHHMM(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
