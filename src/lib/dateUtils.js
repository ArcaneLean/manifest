// Generic date helpers — see ARCHITECTURE.md §7 ("duplicated date helpers").
// Ported from prototypes/CalendarView.jsx and prototypes/CountdownView.jsx.

export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso) {
  // iso: "YYYY-MM-DD" -> local Date at midnight, avoids TZ shift bugs
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function startOfWeekMonday(d) {
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return monday;
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d, n) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function formatShortDate(iso) {
  return parseISODate(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toLowerCase();
}

export function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / MS);
}

export function buildMonthGrid(anchor) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(firstOfMonth, -startWeekday);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const date = addDays(gridStart, i);
    cells.push({ date, inMonth: date.getMonth() === month });
  }
  return cells;
}

// Yearly recurrence used by Countdowns: next time `original`'s month/day occurs on/after `today`.
export function nextOccurrence(original, today) {
  const candidate = new Date(today.getFullYear(), original.getMonth(), original.getDate());
  if (candidate < today) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
}
