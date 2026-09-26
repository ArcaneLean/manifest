import { describe, it, expect } from "vitest";
import { proposeBooking, validateBooking, bookedByCode, setCell } from "./booking.js";

const week = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"];
const days = week.map((date) => ({ date, bookable: true }));

describe("proposeBooking", () => {
  it("books exactly 40h in 30m steps, 8h per day", () => {
    const lines = proposeBooking({ earned: { a: 1500, b: 700, c: 245 }, days });
    expect(validateBooking(lines, days)).toEqual([]);
    const byCode = bookedByCode(lines);
    expect(Object.values(byCode).reduce((s, v) => s + v, 0)).toBe(2400);
    for (const m of Object.values(byCode)) expect(m % 30).toBe(0);
  });

  it("adds the bank to the target so owed hours get booked", () => {
    // earned 38h on a, owed +2h on b -> book 38h a + 2h b
    const lines = proposeBooking({ earned: { a: 2280 }, bank: { b: 120 }, days });
    expect(bookedByCode(lines)).toEqual({ a: 2280, b: 120 });
  });

  it("negative bank lowers a code's target but never below zero", () => {
    const lines = proposeBooking({ earned: { a: 1200, b: 1200 }, bank: { b: -1500 }, days });
    expect(bookedByCode(lines)).toEqual({ a: 2400 });
  });

  it("prefers booking a code on the days it was logged", () => {
    const loggedByDay = { "2026-09-21": { b: 480 }, "2026-09-22": { a: 480 }, "2026-09-23": { a: 480 }, "2026-09-24": { a: 480 }, "2026-09-25": { a: 480 } };
    const lines = proposeBooking({ earned: { a: 1920, b: 480 }, days, loggedByDay });
    expect(lines.filter((l) => l.codeId === "b")).toEqual([{ date: "2026-09-21", codeId: "b", minutes: 480 }]);
  });

  it("skips leave days (bookable total drops by 8h)", () => {
    const withLeave = days.map((d, i) => ({ ...d, bookable: i !== 4 }));
    const lines = proposeBooking({ earned: { a: 1920 }, days: withLeave });
    expect(validateBooking(lines, withLeave)).toEqual([]);
    expect(lines.some((l) => l.date === "2026-09-25")).toBe(false);
  });

  it("returns nothing when there's nothing to book", () => {
    expect(proposeBooking({ earned: {}, days })).toEqual([]);
  });
});

describe("validateBooking", () => {
  it("reports short days and odd steps", () => {
    let lines = proposeBooking({ earned: { a: 2400 }, days });
    lines = setCell(lines, "2026-09-21", "a", 450);
    expect(validateBooking(lines, days).length).toBe(1);
    lines = setCell(lines, "2026-09-21", "a", 465);
    expect(validateBooking(lines, days).length).toBe(2);
  });
});
