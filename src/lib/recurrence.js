// Recurring-template helpers — see ARCHITECTURE.md §4 (Template.recurring).
// Ported from prototypes/TemplatesView.jsx.

import { toISO } from "./dateUtils.js";

export const DAY_LABELS = ["mo", "tu", "we", "th", "fr", "sa", "su"];

// A rule's default anchor date field when a template predates `dateField`
// (see occurrenceDates below) — preserves the original due-date-only behavior.
export const DEFAULT_DATE_FIELD = "due";

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

// Whether `date` itself already lands on a valid occurrence of `rule` —
// used by firstOccurrenceOnOrAfter so seeding a new anchor doesn't skip past
// today when today already matches the schedule.
function matchesRule(rule, date) {
  if (rule.type === "daily") return true;
  if (rule.type === "weekly") {
    const wd = (date.getDay() + 6) % 7;
    return rule.days.includes(wd);
  }
  if (rule.type === "monthly") {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === Math.min(rule.day, lastDay);
  }
  return false;
}

// The first occurrence of `rule` on or after `date` — used to seed a new
// template's anchor task on the schedule's actual next occurrence, rather
// than always defaulting the anchor to today regardless of the rule.
export function firstOccurrenceOnOrAfter(rule, date) {
  if (matchesRule(rule, date)) return new Date(date);
  return advanceOnce(rule, date);
}

// Maps an occurrence `date` to the {startDate, dueDate} pair to store on the
// anchor/next task, per the template's recurring.dateField ("due" | "start"
// | "both"; defaults to "due" for templates saved before this setting
// existed, matching the original due-date-only behavior).
export function occurrenceDates(template, date) {
  const field = template.recurring?.dateField || DEFAULT_DATE_FIELD;
  const iso = toISO(date);
  return {
    startDate: field === "start" || field === "both" ? iso : null,
    dueDate: field === "due" || field === "both" ? iso : null,
  };
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
