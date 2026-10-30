// Balances, month totals and reconciliation for Ledger — see ARCHITECTURE.md
// §7 ("Ledger"). Pure functions over the stored records:
//   balance { key, month, accountId, amount, checkedOn }  (one per account per month)
//   actual  { key, month, lineId, amount }                (one per line per month)
//   month   { month, bankNet, closedAt }
import { addMonths } from "./month.js";
import { owedAt } from "./debt.js";
import { debtSchedules, expectedMonth } from "./plan.js";

export const balanceKey = (month, accountId) => `${month}|${accountId}`;
export const actualKey = (month, lineId) => `${month}|${lineId}`;

// Each account's balance as of the end of `month`: its snapshot for that
// month, or its latest earlier one carried forward (`carried: true`).
export function balancesAt(accounts, balances, month) {
  const out = {};
  for (const b of balances) {
    if (b.month > month) continue;
    const prev = out[b.accountId];
    if (!prev || b.month > prev.month) out[b.accountId] = { amount: b.amount, month: b.month, checkedOn: b.checkedOn };
  }
  const known = new Set(accounts.map((a) => a.id));
  for (const id of Object.keys(out)) {
    if (!known.has(id)) delete out[id];
    else out[id].carried = out[id].month !== month;
  }
  return out;
}

// { total, available, earmarked: { label: cents }, accounts: balancesAt() }.
// Available = accounts marked available; earmarked money is grouped by its
// label whether or not the account is available.
export function assetTotals(accounts, balances, month) {
  const at = balancesAt(accounts, balances, month);
  let total = 0;
  let available = 0;
  const earmarked = {};
  for (const account of accounts) {
    const b = at[account.id];
    if (!b) continue;
    total += b.amount;
    if (account.available) available += b.amount;
    if (account.earmark) earmarked[account.earmark] = (earmarked[account.earmark] || 0) + b.amount;
  }
  return { total, available, earmarked, accounts: at };
}

export function latestBalanceMonth(balances) {
  let latest = null;
  for (const b of balances) if (!latest || b.month > latest) latest = b.month;
  return latest;
}

// Debts owed at the end of `month` (= the start of the next one).
export function debtTotal(debts, month) {
  let total = 0;
  for (const { debt, schedule } of debtSchedules(debts)) total += owedAt(schedule, addMonths(month, 1), debt);
  return total;
}

// Accounts whose latest check is older than `days` before `todayISO`.
export function staleAccounts(accounts, balances, todayISO, days = 35) {
  const latest = {};
  for (const b of balances) {
    const checked = b.checkedOn || `${b.month}-28`;
    if (!latest[b.accountId] || checked > latest[b.accountId]) latest[b.accountId] = checked;
  }
  const cutoff = new Date(new Date(todayISO).getTime() - days * 86400000).toISOString().slice(0, 10);
  return accounts.filter((a) => !a.archived && (!latest[a.id] || latest[a.id] < cutoff)).map((a) => a.id);
}

// { income, expense, net, byLine, count } from the month's recorded actuals.
// Income/expense is by the line's kind, so a refund on an expense line
// lowers that month's expense rather than counting as income.
export function actualMonth(lines, actuals, month) {
  const kind = Object.fromEntries(lines.map((l) => [l.id, l.kind]));
  const byLine = {};
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const a of actuals) {
    if (a.month !== month || a.amount == null) continue;
    byLine[a.lineId] = a.amount;
    count += 1;
    if (kind[a.lineId] === "income") income += a.amount;
    else expense += a.amount;
  }
  return { income, expense, net: income + expense, byLine, count };
}

// Everything the month view's summary needs. `delta` is how much the total
// of all accounts changed since the previous month; `unexplained` is the
// part of that change the recorded lines don't account for. Both are null
// without balances for both months. `vsBank` compares the lines with the
// net total the bank reports for the month, when that's been entered.
export function monthSummary({ accounts, balances, lines, actuals, debts, months }, month) {
  const actual = actualMonth(lines, actuals, month);
  const expected = expectedMonth(lines, debtSchedules(debts), month);
  const record = months.find((m) => m.month === month) || null;
  const bankNet = record?.bankNet ?? null;
  const prevMonth = addMonths(month, -1);
  const hasNow = balances.some((b) => b.month === month);
  const hasPrev = balances.some((b) => b.month <= prevMonth);
  const delta = hasNow && hasPrev ? assetTotals(accounts, balances, month).total - assetTotals(accounts, balances, prevMonth).total : null;
  const net = actual.count ? actual.net : bankNet;
  return {
    month,
    actual,
    expected,
    bankNet,
    net,
    delta,
    unexplained: delta !== null && net !== null ? delta - net : null,
    vsBank: bankNet !== null && actual.count ? actual.net - bankNet : null,
    closedAt: record?.closedAt ?? null,
  };
}

// Every month anything was recorded for, newest first.
export function knownMonths({ balances, actuals, months }) {
  const set = new Set();
  for (const b of balances) set.add(b.month);
  for (const a of actuals) set.add(a.month);
  for (const m of months) set.add(m.month);
  return [...set].sort().reverse();
}

// The month to close next: the earliest month after the last closed one,
// never later than last month (the current month isn't over yet).
export function nextMonthToClose(months, current) {
  const closed = months.filter((m) => m.closedAt).map((m) => m.month).sort();
  const lastMonth = addMonths(current, -1);
  if (closed.length === 0) return lastMonth;
  const next = addMonths(closed[closed.length - 1], 1);
  return next > lastMonth ? null : next;
}
