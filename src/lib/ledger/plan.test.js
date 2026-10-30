import { describe, it, expect } from "vitest";
import { expectedFor, expectedMonth, forecast, debtSchedules } from "./plan.js";

const salary = { id: "salary", kind: "income", status: "fixed", rules: [{ amount: 261130, every: 1, from: "2026-09" }] };
const kinderbijslag = { id: "kb", kind: "income", status: "fixed", rules: [{ amount: 59014, every: 3, from: "2026-10" }] };
const pacht = { id: "pacht", kind: "expense", status: "fixed", rules: [{ amount: -310000, every: 12, from: "2027-01", until: "2028-12" }], overrides: { "2028-01": -320000 } };
const dropped = { id: "x", kind: "expense", status: "dropped", rules: [{ amount: -2224, every: 1, from: "2026-01" }] };
const loanLine = { id: "loan", kind: "expense", status: "fixed", rules: [{ amount: -1, every: 1, from: "2020-01" }] };
const debt = { id: "d", kind: "fixed", rate: 0, fixedPayment: 5000, checks: [{ month: "2026-09", balance: 20000 }], firstPaymentMonth: "2026-11" };

describe("expectedFor", () => {
  it("applies rules on their cadence", () => {
    expect(expectedFor(salary, "2026-08")).toBe(0);
    expect(expectedFor(salary, "2026-12")).toBe(261130);
    expect(expectedFor(kinderbijslag, "2027-01")).toBe(59014);
    expect(expectedFor(kinderbijslag, "2027-02")).toBe(0);
  });
  it("respects until, overrides and dropped", () => {
    expect(expectedFor(pacht, "2027-01")).toBe(-310000);
    expect(expectedFor(pacht, "2028-01")).toBe(-320000);
    expect(expectedFor(pacht, "2029-01")).toBe(0);
    expect(expectedFor(dropped, "2026-05")).toBe(0);
  });
  it("uses the linked debt's payments instead of the rules", () => {
    const schedules = debtSchedules([{ ...debt, lineId: "loan" }]);
    expect(expectedFor(loanLine, "2026-10", schedules)).toBe(0);
    expect(expectedFor(loanLine, "2026-11", schedules)).toBe(-5000);
  });
});

describe("expectedMonth / forecast", () => {
  it("counts unlinked debts as their own expense", () => {
    const m = expectedMonth([salary], debtSchedules([debt]), "2026-11");
    expect(m).toMatchObject({ income: 261130, expense: -5000, net: 256130, byDebt: { d: -5000 } });
  });
  it("doesn't count a linked debt twice", () => {
    const m = expectedMonth([loanLine], debtSchedules([{ ...debt, lineId: "loan" }]), "2026-11");
    expect(m.net).toBe(-5000);
  });
  it("projects the balance and finds the lowest point", () => {
    const { rows, lowest } = forecast({ lines: [salary, pacht], debts: [], fromMonth: "2026-11", toMonth: "2027-02", startBalance: 100000 });
    expect(rows.map((r) => r.month)).toEqual(["2026-12", "2027-01", "2027-02"]);
    expect(rows.map((r) => r.balance)).toEqual([361130, 312260, 573390]);
    expect(lowest.month).toBe("2027-01");
  });
});
