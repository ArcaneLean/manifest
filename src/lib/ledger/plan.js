// Expected income & expenses and the cash-flow forecast — see
// ARCHITECTURE.md §7 ("Ledger"). Pure functions over line and debt records.
//
// A line's expected amount for a month is, in order:
// 1. 0 when the line's status is "dropped";
// 2. an explicit per-month override, when there is one;
// 3. minus the linked debts' scheduled payments, when a debt is linked to
//    the line (the bank books those payments onto that category);
// 4. otherwise the sum of its rules: { amount, every, from, until? } adds
//    `amount` every `every` months starting at `from`.
// Debts not linked to any line count as their own synthetic expense rows.
import { addMonths, monthDiff, monthRange } from "./month.js";
import { debtSchedule, paymentIn } from "./debt.js";

export const LINE_STATUSES = ["fixed", "estimate", "buffer", "dropped"];
export const RULE_EVERY = [1, 2, 3, 4, 6, 12];

export function ruleApplies(rule, month) {
  if (!rule.from || month < rule.from) return false;
  if (rule.until && month > rule.until) return false;
  return monthDiff(rule.from, month) % (rule.every || 1) === 0;
}

export function rulesAmount(line, month) {
  let total = 0;
  for (const rule of line.rules || []) if (ruleApplies(rule, month)) total += rule.amount || 0;
  return total;
}

// Precomputed schedules so a forecast doesn't rebuild each debt per month.
export function debtSchedules(debts) {
  return (debts || []).filter((d) => !d.archived).map((debt) => ({ debt, schedule: debtSchedule(debt) }));
}

export function expectedFor(line, month, schedules = []) {
  if (line.status === "dropped") return 0;
  const override = line.overrides?.[month];
  if (override != null) return override;
  const linked = schedules.filter((s) => s.debt.lineId === line.id);
  if (linked.length) return 0 - linked.reduce((sum, s) => sum + paymentIn(s.schedule, month), 0);
  return rulesAmount(line, month);
}

// Debts whose payments aren't booked onto any (existing) line.
export function unlinkedSchedules(schedules, lines) {
  const ids = new Set(lines.map((l) => l.id));
  return schedules.filter((s) => !s.debt.lineId || !ids.has(s.debt.lineId));
}

// { income, expense, net, byLine: {lineId: cents}, byDebt: {debtId: cents} }
export function expectedMonth(lines, schedules, month) {
  const byLine = {};
  const byDebt = {};
  let income = 0;
  let expense = 0;
  for (const line of lines) {
    const v = expectedFor(line, month, schedules);
    if (!v) continue;
    byLine[line.id] = v;
    if (v > 0) income += v;
    else expense += v;
  }
  for (const s of unlinkedSchedules(schedules, lines)) {
    const v = 0 - paymentIn(s.schedule, month);
    if (!v) continue;
    byDebt[s.debt.id] = v;
    expense += v;
  }
  return { income, expense, net: income + expense, byLine, byDebt };
}

// Month-by-month projection of `startBalance` (the available money at the
// end of `fromMonth`) over the months after it, through `toMonth`.
export function forecast({ lines, debts, fromMonth, toMonth, startBalance }) {
  const schedules = debtSchedules(debts);
  let balance = startBalance;
  let lowest = null;
  const rows = [];
  if (toMonth <= fromMonth) return { rows, lowest };
  for (const month of monthRange(addMonths(fromMonth, 1), toMonth)) {
    const m = expectedMonth(lines, schedules, month);
    balance += m.net;
    const row = { month, ...m, balance };
    rows.push(row);
    if (!lowest || balance < lowest.balance) lowest = row;
  }
  return { rows, lowest };
}
