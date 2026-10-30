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
