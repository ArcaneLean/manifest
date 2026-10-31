import { describe, it, expect } from "vitest";
import { balancesAt, assetTotals, monthSummary, nextMonthToClose, staleAccounts, knownMonths, debtTotal } from "./summary.js";

const accounts = [
  { id: "pay", available: true },
  { id: "save", available: true, earmark: "Vacation" },
  { id: "edu", available: false, earmark: "Education" },
];
const balances = [
  { month: "2026-07", accountId: "pay", amount: 100000, checkedOn: "2026-07-31" },
  { month: "2026-07", accountId: "save", amount: 50000, checkedOn: "2026-07-31" },
  { month: "2026-07", accountId: "edu", amount: 700000, checkedOn: "2026-07-31" },
  { month: "2026-08", accountId: "pay", amount: 120000, checkedOn: "2026-08-30" },
  { month: "2026-08", accountId: "edu", amount: 734247, checkedOn: "2026-08-30" },
];
const lines = [
  { id: "salary", kind: "income", status: "fixed", rules: [{ amount: 260000, every: 1, from: "2026-01" }] },
  { id: "food", kind: "expense", status: "estimate", rules: [{ amount: -30000, every: 1, from: "2026-01" }] },
];
const actuals = [
  { month: "2026-08", lineId: "salary", amount: 261130 },
  { month: "2026-08", lineId: "food", amount: -9924 },
  { month: "2026-08", lineId: "food-refund-on-expense", amount: 0 },
];

describe("balances", () => {
  it("carries the latest snapshot forward", () => {
    const at = balancesAt(accounts, balances, "2026-08");
    expect(at.save).toMatchObject({ amount: 50000, carried: true });
    expect(at.pay).toMatchObject({ amount: 120000, carried: false });
  });
  it("totals available and earmarked money", () => {
    const t = assetTotals(accounts, balances, "2026-08");
    expect(t).toMatchObject({ total: 904247, available: 170000, earmarked: { Vacation: 50000, Education: 734247 } });
  });
  it("flags stale accounts", () => {
    expect(staleAccounts(accounts, balances, "2026-09-20")).toEqual(["save"]);
  });
});

describe("monthSummary", () => {
  it("reconciles the balance change with the recorded lines", () => {
    const s = monthSummary({ accounts, balances, lines, actuals, debts: [], months: [{ month: "2026-08", bankNet: 251000 }] }, "2026-08");
    expect(s.actual).toMatchObject({ income: 261130, expense: -9924, net: 251206 });
    expect(s.expected.net).toBe(230000);
    expect(s.delta).toBe(54247);
    expect(s.unexplained).toBe(54247 - 251206);
    expect(s.vsBank).toBe(206);
  });
  it("falls back to the bank's net total without line actuals", () => {
    const s = monthSummary({ accounts, balances, lines, actuals: [], debts: [], months: [{ month: "2026-08", bankNet: 50000 }] }, "2026-08");
    expect(s.net).toBe(50000);
    expect(s.unexplained).toBe(4247);
  });
});

describe("unchecked values", () => {
  // "edu" can't be looked at easily: its balance is assumed, and so is the
  // tuition taken from it.
  const lines2 = [...lines, { id: "tuition", kind: "expense", status: "fixed", rules: [] }];
  const balances2 = balances.map((b) => (b.month === "2026-08" && b.accountId === "edu" ? { ...b, amount: 680000, unchecked: true } : b));
  const actuals2 = [...actuals, { month: "2026-08", lineId: "tuition", amount: -20000, unchecked: true }];
  const store = { accounts, balances: balances2, lines: lines2, actuals: actuals2, debts: [], months: [{ month: "2026-08", bankNet: 251000 }] };

  it("counts them in the totals", () => {
    const s = monthSummary(store, "2026-08");
    expect(s.actual).toMatchObject({ expense: -29924, net: 231206 });
    expect(s.delta).toBe(20000 - 20000);
  });
  it("leaves them out of the reconciliation", () => {
    const s = monthSummary(store, "2026-08");
    expect(s.unchecked).toMatchObject({ accounts: ["edu"], lines: ["tuition"], count: 2, delta: -20000, net: -20000 });
    // checked: pay +20000 − (salary + food) 251206
    expect(s.unexplained).toBe(20000 - 251206);
    expect(s.vsBank).toBe(206);
  });
  it("carries the flag forward and doesn't count as a check", () => {
    expect(balancesAt(accounts, balances2, "2026-09").edu).toMatchObject({ amount: 680000, carried: true, unchecked: true });
    // edu's last real check is July's now, so it's stale where it wasn't before
    expect(staleAccounts(accounts, balances2, "2026-09-20")).toEqual(["save", "edu"]);
  });
});

describe("months", () => {
  it("lists every recorded month, newest first", () => {
    expect(knownMonths({ balances, actuals, months: [{ month: "2025-01" }] })).toEqual(["2026-08", "2026-07", "2025-01"]);
  });
  it("suggests the month after the last closed one, up to last month", () => {
    expect(nextMonthToClose([], "2026-10")).toBe("2026-09");
    expect(nextMonthToClose([{ month: "2026-07", closedAt: 1 }], "2026-10")).toBe("2026-08");
    expect(nextMonthToClose([{ month: "2026-09", closedAt: 1 }], "2026-10")).toBeNull();
  });
  it("totals debts owed at the end of a month", () => {
    const debt = { id: "d", kind: "fixed", rate: 0, fixedPayment: 100, checks: [{ month: "2026-08", balance: 1000 }], firstPaymentMonth: "2026-08" };
    expect(debtTotal([debt], "2026-08")).toBe(900);
  });
});
