// Balances, month totals and reconciliation for Ledger — see ARCHITECTURE.md
// §7 ("Ledger"). Pure functions over the stored records:
//   balance { key, month, accountId, amount, checkedOn, unchecked? }  (one per account per month)
//   actual  { key, month, lineId, amount, unchecked? }                (one per line per month)
// `unchecked` marks an assumed value that couldn't be verified at the
// close (an account without easy access, the expenses taken from it): it
// counts in the totals, but is left out of the reconciliation.
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
    if (!prev || b.month > prev.month) out[b.accountId] = { amount: b.amount, month: b.month, checkedOn: b.checkedOn, unchecked: !!b.unchecked };
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
// Unchecked balances aren't checks.
export function staleAccounts(accounts, balances, todayISO, days = 35) {
  const latest = {};
  for (const b of balances) {
    if (b.unchecked) continue;
    const checked = b.checkedOn || `${b.month}-28`;
    if (!latest[b.accountId] || checked > latest[b.accountId]) latest[b.accountId] = checked;
  }
  const cutoff = new Date(new Date(todayISO).getTime() - days * 86400000).toISOString().slice(0, 10);
  return accounts.filter((a) => !a.archived && (!latest[a.id] || latest[a.id] < cutoff)).map((a) => a.id);
}

// { income, expense, net, byLine, count, unchecked: { lines, net } } from
// the month's recorded actuals. Income/expense is by the line's kind, so a
// refund on an expense line lowers that month's expense rather than
// counting as income. Unchecked actuals are in the totals and also summed
// on their own (`unchecked.lines` holds their line ids).
export function actualMonth(lines, actuals, month) {
  const kind = Object.fromEntries(lines.map((l) => [l.id, l.kind]));
  const byLine = {};
  let income = 0;
  let expense = 0;
  let count = 0;
  const unchecked = { lines: [], net: 0 };
  for (const a of actuals) {
    if (a.month !== month || a.amount == null) continue;
    byLine[a.lineId] = a.amount;
    count += 1;
    if (kind[a.lineId] === "income") income += a.amount;
    else expense += a.amount;
    if (a.unchecked) {
      unchecked.lines.push(a.lineId);
      unchecked.net += a.amount;
    }
  }
  return { income, expense, net: income + expense, byLine, count, unchecked };
}

// Accounts whose balance for `month` itself is marked unchecked, and how
// much of the total's change since the previous month is theirs.
export function uncheckedBalances(accounts, balances, month) {
  const ids = balances.filter((b) => b.month === month && b.unchecked).map((b) => b.accountId);
  const known = new Set(accounts.map((a) => a.id));
  const accountIds = ids.filter((id) => known.has(id));
  const now = balancesAt(accounts, balances, month);
  const before = balancesAt(accounts, balances, addMonths(month, -1));
  const delta = accountIds.reduce((s, id) => s + (now[id]?.amount ?? 0) - (before[id]?.amount ?? 0), 0);
  return { accounts: accountIds, delta };
}

// The accounts the lines are booked from: the payment (`checking`)
// accounts, whose balance change is the bank's in − out for the month,
// transfers included. Savings move only by transfers from them, which are
// lines of their own, so they're left out. Without any payment account,
// every account counts.
export function paymentAccounts(accounts) {
  const pay = accounts.filter((a) => a.type === "checking");
  return pay.length ? pay : accounts;
}

// { accountId: { net, unchecked } } for each payment account with a balance
// of its own for `month` and for the month before: its balance change,
// which is the net the bank reports for that account.
export function accountNets(accounts, balances, month) {
  const now = balancesAt(accounts, balances, month);
  const before = balancesAt(accounts, balances, addMonths(month, -1));
  const out = {};
  for (const a of accounts) {
    if (a.type !== "checking") continue;
    const n = now[a.id];
    const b = before[a.id];
    if (!n || n.carried || !b || b.carried) continue;
    out[a.id] = { net: n.amount - b.amount, unchecked: n.unchecked || b.unchecked };
  }
  return out;
}

// Everything the month view's summary needs. `delta` is how much the total
// of all accounts changed since the previous month; `paymentDelta` the
// same for the payment accounts only; `unexplained` is the part of the
// payment accounts' change the recorded lines don't account for. Both are null
// without balances for both months. `vsBank` compares the lines with the
// net total the bank reports for the month, when that's been entered.
// Unchecked values are left out of both cross-checks: `unexplained` is
// the change of the checked payment accounts − the net of the checked lines, and
// `vsBank` uses the checked lines only. `unchecked` lists what was left out.
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
  const pay = paymentAccounts(accounts);
  const payIds = new Set(pay.map((a) => a.id));
  const payHasNow = balances.some((b) => b.month === month && payIds.has(b.accountId));
  const payHasPrev = balances.some((b) => b.month <= prevMonth && payIds.has(b.accountId));
  const paymentDelta = payHasNow && payHasPrev ? assetTotals(pay, balances, month).total - assetTotals(pay, balances, prevMonth).total : null;
  const uncheckedPay = uncheckedBalances(pay, balances, month);
  const uncheckedBal = uncheckedBalances(accounts, balances, month);
  const checkedLines = actual.net - actual.unchecked.net;
  const checkedNet = actual.count ? checkedLines : bankNet;
  const unchecked = {
    accounts: uncheckedBal.accounts,
    lines: actual.unchecked.lines,
    count: uncheckedBal.accounts.length + actual.unchecked.lines.length,
    delta: uncheckedBal.delta,
    net: actual.unchecked.net,
  };
  return {
    month,
    actual,
    expected,
    bankNet,
    net,
    delta,
    paymentDelta,
    nets: accountNets(accounts, balances, month),
    unexplained: paymentDelta !== null && checkedNet !== null ? paymentDelta - uncheckedPay.delta - checkedNet : null,
    vsBank: bankNet !== null && actual.count ? checkedLines - bankNet : null,
    unchecked,
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
