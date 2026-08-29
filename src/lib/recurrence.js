// Recurring-template helpers — see ARCHITECTURE.md §4 (Template.recurring).
// Ported from prototypes/TemplatesView.jsx.

export const DAY_LABELS = ["mo", "tu", "we", "th", "fr", "sa", "su"];

// Steps a recurring rule forward once from `date`, e.g. from the currently
// scheduled occurrence's own date — not from "today" — so completing an
// occurrence early never skips ahead to catch up with the calendar.
export function advanceOnce(rule, date) {
  const d = new Date(date);
  if (rule.type === "daily") {
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (rule.type === "weekly") {
    let cur = new Date(d);
    for (let i = 0; i < 7; i++) {
      cur.setDate(cur.getDate() + 1);
      const wd = (cur.getDay() + 6) % 7;
      if (rule.days.includes(wd)) return cur;
    }
    return cur;
  }
  if (rule.type === "monthly") {
    const cur = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    cur.setDate(Math.min(rule.day, lastDay));
    return cur;
  }
  return d;
}

// Occurrence dates strictly after `fromDate` (a template's anchor task date)
// up to and including `untilDate` — the virtual/projected occurrences shown
// on the Calendar beyond the one real anchor task. Never persisted.
export function occurrencesInRange(rule, fromDate, untilDate) {
  const dates = [];
  let cur = fromDate;
  let guard = 0;
  while (guard < 400) {
    cur = advanceOnce(rule, cur);
    if (cur > untilDate) break;
    dates.push(cur);
    guard++;
  }
  return dates;
}

function ordinal(n) {
  if (n % 10 === 1 && n !== 11) return "st";
  if (n % 10 === 2 && n !== 12) return "nd";
  if (n % 10 === 3 && n !== 13) return "rd";
  return "th";
}

export function describeRecurrence(rule) {
  if (!rule) return "";
  if (rule.type === "daily") return "every day";
  if (rule.type === "weekly") {
    if (rule.days.length === 0) return "weekly";
    return rule.days
      .slice()
      .sort((a, b) => a - b)
      .map((d) => DAY_LABELS[d])
      .join(", ");
  }
  if (rule.type === "monthly") return `monthly · ${rule.day}${ordinal(rule.day)}`;
  return "";
}
