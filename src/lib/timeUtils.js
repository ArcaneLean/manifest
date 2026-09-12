// Work-hours time helpers — see ARCHITECTURE.md §4 (WorkLogEntry).
// Ported from prototypes/HoursView.jsx, later reworked from one session/day
// to multiple project-tagged segments/day (see ARCHITECTURE.md §7).

export function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// A day is "started" once it has at least one segment (clocked in).
export function isDayStarted(entry) {
  return !!(entry && entry.segments && entry.segments.length > 0);
}

// The in-progress segment, if any. Segments are appended sequentially as you
// clock in/switch/out, so only the last one can ever be open (end: null).
export function openSegment(entry) {
  if (!isDayStarted(entry)) return null;
  const last = entry.segments[entry.segments.length - 1];
  return last.end ? null : last;
}

// A day is "done" once it's been explicitly clocked out (last segment
// closed). A day mid-switch between projects/break is started but not done.
export function isCompleteEntry(entry) {
  return isDayStarted(entry) && !openSegment(entry);
}

function segmentMinutes(seg) {
  if (!seg || !seg.end) return 0;
  return Math.max(0, timeToMinutes(seg.end) - timeToMinutes(seg.start));
}

// Minutes actually worked on a project — excludes break segments
// (projectId: null).
export function workedMinutes(entry) {
  if (!entry || !entry.segments) return 0;
  return entry.segments.filter((s) => s.projectId).reduce((sum, s) => sum + segmentMinutes(s), 0);
}

export function breakMinutes(entry) {
  if (!entry || !entry.segments) return 0;
  return entry.segments.filter((s) => !s.projectId).reduce((sum, s) => sum + segmentMinutes(s), 0);
}

// Per-project totals for a day, in first-appearance order (`projectId: null`
// = break). Used for the day-row summary and the "done" breakdown.
export function projectTotals(entry) {
  if (!entry || !entry.segments) return [];
  const order = [];
  const totals = new Map();
  for (const seg of entry.segments) {
    const min = segmentMinutes(seg);
    if (min <= 0) continue;
    if (!totals.has(seg.projectId)) {
      totals.set(seg.projectId, 0);
      order.push(seg.projectId);
    }
    totals.set(seg.projectId, totals.get(seg.projectId) + min);
  }
  return order.map((projectId) => ({ projectId, minutes: totals.get(projectId) }));
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
// flex-time balance. Open (not-yet-clocked-out) entries don't count yet.
export function balanceMinutes(entries, normalDayMin) {
  return entries.filter(isCompleteEntry).reduce((sum, e) => sum + workedMinutes(e) - normalDayMin, 0);
}

export function nowHHMM(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
