import { describe, it, expect } from "vitest";
import { debtSchedule, debtSummary, annuityPayment, duoCapacity, owedAt } from "./debt.js";

// The three debts from the old spreadsheet, so the engine is checked against
// the figures it produced.
const chalet = {
  id: "chalet",
  kind: "annuity",
  rate: 0.04,
  graceInterest: "simple",
  checks: [{ month: "2026-08", balance: 5000000 }],
  firstPaymentMonth: "2027-08",
  lastPaymentMonth: "2036-07",
};
const duoAron = {
  id: "aron",
  kind: "duo",
  rate: 0.0046,
  checks: [{ month: "2026-08", balance: 3856399 }],
  firstPaymentMonth: "2028-02",
  lastPaymentMonth: "2063-01",
  assessmentIncome: 4080000,
  exemptIncome: 3835177,
};
const duoHilde = {
  id: "hilde",
  kind: "fixed",
  rate: 0,
  checks: [{ month: "2026-09", balance: 1708895 }],
  firstPaymentMonth: "2028-01",
  lastPaymentMonth: "2058-10",
  fixedPayment: 900,
};
const near = (actual, expected, tolerance) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

describe("annuity loan with a simple-interest grace year (chalet)", () => {
  const { rows } = debtSchedule(chalet);
  const first = rows.find((r) => r.month === "2027-08");
  it("capitalizes the grace year's interest at the first payment", () => {
    expect(rows[0]).toMatchObject({ month: "2026-08", opening: 5000000, interest: 16667, payment: 0, grace: true });
    near(first.opening, 5200000, 5);
    near(first.interest, 17333, 1);
    near(first.payment, 57413, 1);
    near(first.principal, 40080, 1);
  });
  it("pays off exactly over the 108-month term", () => {
    expect(rows.filter((r) => r.payment > 0)).toHaveLength(108);
    expect(rows[rows.length - 1]).toMatchObject({ month: "2036-07", closing: 0 });
  });
  it("matches the sheet's remaining interest after the grace year", () => {
    const after = rows.filter((r) => !r.grace).reduce((s, r) => s + r.interest, 0);
    near(after, 1000608, 100);
    // ...and counts the grace year's €2.000 the sheet left out.
    near(debtSummary(chalet, "2026-09").remainingInterest, 1000608 + 200004 - 16667, 100);
  });
  it("lowers later payments after an overpayment, keeping the term", () => {
    const over = debtSchedule({ ...chalet, payments: { "2027-08": 500000 } }).rows;
    expect(over.find((r) => r.month === "2027-09").payment).toBeLessThan(first.payment);
    expect(over[over.length - 1].month).toBe("2036-07");
  });
});

describe("DUO with draagkracht", () => {
  const { rows, statutory, forgiven } = debtSchedule(duoAron);
  it("accrues monthly interest and pays nothing during the grace period", () => {
    expect(rows[0]).toMatchObject({ month: "2026-08", interest: 1478, payment: 0, closing: 3857877 });
    expect(rows.find((r) => r.month === "2028-01").payment).toBe(0);
  });
  it("caps the statutory amount by draagkracht", () => {
    expect(duoCapacity(duoAron)).toBe(816);
    near(statutory, 10011, 3);
    expect(rows.find((r) => r.month === "2028-02").payment).toBe(816);
  });
  it("forgives what's left after the last payment month", () => {
    expect(rows[rows.length - 1].month).toBe("2063-01");
    expect(forgiven).toBeGreaterThan(0);
    expect(owedAt({ rows }, "2063-02", duoAron)).toBe(0);
  });
  it("matches the sheet's worst-case remaining interest", () => {
    near(debtSummary(duoAron, "2026-10").remainingInterest, 672860, 200);
  });
  it("pays the statutory amount when income isn't known", () => {
    const { rows: plain } = debtSchedule({ ...duoAron, assessmentIncome: null });
    near(plain.find((r) => r.month === "2028-02").payment, 10011, 3);
  });
});

describe("fixed payment at 0%", () => {
  it("pays the fixed amount from the first payment month", () => {
    const s = debtSummary(duoHilde, "2026-10");
    expect(s.owed).toBe(1708895);
    expect(s.remainingInterest).toBe(0);
    expect(s.next).toEqual({ month: "2028-01", amount: 900 });
  });
});

describe("what-if", () => {
  it("extra payments cut the interest", () => {
    const base = debtSummary(chalet, "2026-09");
    const extra = debtSummary(chalet, "2026-09", { extraMonthly: 10000 });
    expect(extra.remainingInterest).toBeLessThan(base.remainingInterest);
  });
  it("annuityPayment handles 0% and degenerate terms", () => {
    expect(annuityPayment(1200, 0, 12)).toBe(100);
    expect(annuityPayment(500, 0.05, 0)).toBe(500);
  });
});
