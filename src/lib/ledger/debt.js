// Debt schedule engine for Ledger — see ARCHITECTURE.md §7 ("Ledger").
// Pure: a debt record in, a month-by-month schedule out. Nothing derived is
// stored; the Debts views, the forecast and the Now totals all recompute it.
//
// One engine covers the three repayment shapes in use:
// - "duo"     — DUO student debt: interest compounds monthly, nothing is due
//               before the first payment month, then the payment is the
//               statutory annuity (fixed at the first payment month over the
//               whole term), capped by draagkracht when income is known:
//               4% × (assessment income − exempt income) / 12. Whatever is
//               left after the last payment month is forgiven.
// - "annuity" — a regular annuity loan, recalculated every month over the
//               months left, so a payment above the agreed amount lowers the
//               later ones rather than shortening the term.
// - "fixed"   — a fixed monthly amount (e.g. an estimate).
// `graceInterest: "simple"` accrues interest on the principal only during
// the grace months and adds it on at the first payment month (the chalet
// loan's contract); "compound" (default) adds it to the balance monthly.
import { addMonths, monthDiff } from "./month.js";

export const DEBT_KINDS = ["duo", "annuity", "fixed"];
export const DUO_CAPACITY_RATE = 0.04;
const MAX_ROWS = 12 * 80;

// Monthly annuity payment (cents, unrounded) for `balance` over `n` months.
export function annuityPayment(balance, annualRate, n) {
  if (n <= 0) return balance;
  const r = annualRate / 12;
  if (r === 0) return balance / n;
  return (r * balance) / (1 - Math.pow(1 + r, -n));
}

// The balance check the schedule starts from: the latest one by month.
export function anchorOf(debt) {
  const checks = debt.checks || [];
  if (checks.length === 0) return null;
  return checks.reduce((a, b) => (b.month > a.month || (b.month === a.month && (b.checkedOn || "") > (a.checkedOn || "")) ? b : a));
}

// Draagkracht cap in cents/month, or null when the income figures aren't set.
export function duoCapacity(debt) {
  if (debt.assessmentIncome == null || debt.exemptIncome == null) return null;
  return Math.round((Math.max(0, debt.assessmentIncome - debt.exemptIncome) * DUO_CAPACITY_RATE) / 12);
}

// Rows: { month, opening, interest, payment, principal, closing, grace,
//         actual } — opening/closing are what's owed, including any interest
// accrued but not yet capitalized. `options.extraMonthly` (cents) and
// `options.lumpSums` ({ month: cents }) model a what-if on top of the plan;
// they don't apply to months with a recorded actual payment.
export function debtSchedule(debt, options = {}) {
  const anchor = anchorOf(debt);
  if (!anchor) return { rows: [], forgiven: 0, statutory: null };
  const { extraMonthly = 0, lumpSums = {} } = options;
  const rate = debt.rate || 0;
  const simpleGrace = debt.graceInterest === "simple";
  const first = debt.firstPaymentMonth || anchor.month;
  const last = debt.lastPaymentMonth || null;
  const payments = debt.payments || {};

  let balance = anchor.balance;
  let accrued = 0;
  let statutory = null;
  const rows = [];

  for (let month = anchor.month; rows.length < MAX_ROWS; month = addMonths(month, 1)) {
    if (last && month > last) break;
    const grace = month < first;
    if (!grace && accrued) {
      balance += accrued;
      accrued = 0;
    }
    const opening = balance + accrued;
    if (opening <= 0) break;
    const interest = Math.round((balance * rate) / 12);
    const actual = payments[month];

    let scheduled = 0;
    if (!grace) {
      const left = last ? monthDiff(month, last) + 1 : null;
      if (debt.kind === "fixed") scheduled = debt.fixedPayment || 0;
      else if (debt.kind === "duo") {
        if (statutory === null) statutory = Math.round(annuityPayment(balance, rate, left ?? 35 * 12));
        const cap = duoCapacity(debt);
        scheduled = cap === null ? statutory : Math.min(statutory, cap);
      } else scheduled = Math.round(annuityPayment(balance, rate, left ?? 1));
    }
    let payment = actual != null ? actual : scheduled + (grace ? 0 : extraMonthly) + (lumpSums[month] || 0);

    if (grace && simpleGrace) {
      accrued += interest;
      payment = Math.min(payment, balance);
      balance -= payment;
    } else {
      payment = Math.min(payment, balance + interest);
      balance += interest - payment;
    }
    rows.push({ month, opening, interest, payment, principal: payment - interest, closing: balance + accrued, grace, actual: actual != null });
    if (balance + accrued <= 0) break;
  }

  const end = rows[rows.length - 1];
  const forgiven = debt.kind === "duo" && end && last && end.month === last ? Math.max(0, end.closing) : 0;
  return { rows, forgiven, statutory };
}

// What's owed at the start of `month`.
export function owedAt(schedule, month, debt) {
  const { rows } = schedule;
  if (rows.length === 0) return anchorOf(debt)?.balance ?? 0;
  if (month <= rows[0].month) return rows[0].opening;
  const row = rows.find((r) => r.month === month);
  if (row) return row.opening;
  const end = rows[rows.length - 1];
  // Past the end: paid off, or forgiven after the last DUO payment month.
  return month > end.month ? 0 : end.closing;
}

export function paymentIn(schedule, month) {
  return schedule.rows.find((r) => r.month === month)?.payment ?? 0;
}

// Headline figures for a debt as of `month`.
export function debtSummary(debt, month, options) {
  const schedule = debtSchedule(debt, options);
  const ahead = schedule.rows.filter((r) => r.month >= month);
  const next = ahead.find((r) => r.payment > 0) || null;
  const end = schedule.rows[schedule.rows.length - 1];
  return {
    schedule,
    owed: owedAt(schedule, month, debt),
    paymentNow: paymentIn(schedule, month),
    next: next && { month: next.month, amount: next.payment },
    remainingInterest: ahead.reduce((s, r) => s + r.interest, 0),
    remainingPayments: ahead.reduce((s, r) => s + r.payment, 0),
    payoffMonth: end && end.closing <= 0 ? end.month : null,
    endMonth: end?.month ?? null,
    forgiven: schedule.forgiven,
  };
}

// True when the rate's validity ends within `days` (or already has).
export function rateExpiringSoon(debt, todayISO, days = 90) {
  if (!debt.rateValidUntil) return false;
  const ms = new Date(debt.rateValidUntil).getTime() - new Date(todayISO).getTime();
  return ms <= days * 86400000;
}
