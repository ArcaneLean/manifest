// A task with a future startDate isn't actionable yet — see ARCHITECTURE.md
// §7 ("Start date / due date split"). ISO date strings (YYYY-MM-DD) compare
// correctly with plain string comparison, so no Date parsing is needed here.
export function isScheduled(task, todayISO) {
  return Boolean(task.startDate) && task.startDate > todayISO;
}
