// "YYYY-MM" month keys — the unit Ledger records everything in (see
// ARCHITECTURE.md §7 "Ledger"). Plain string compare sorts them correctly.

export function monthOf(isoDate) {
  return isoDate.slice(0, 7);
}

export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// Whole months from `a` to `b` (b − a); negative when b is earlier.
export function monthDiff(a, b) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

// Inclusive list of months from `from` to `to`.
export function monthRange(from, to) {
  const out = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function isMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

const NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "sep '26"
export function monthLabel(month) {
  const [y, m] = month.split("-");
  return `${NAMES[Number(m) - 1]} '${y.slice(2)}`;
}

// "september 2026"
export function monthLongLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }).toLowerCase();
}
