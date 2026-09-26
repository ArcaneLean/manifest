import { describe, it, expect } from "vitest";
import { bankByCode, isStale, weekDelta } from "./bank.js";

const booking = (weekStart, earned, lines, confirmedAt = 1) => ({ weekStart, earned, lines, confirmedAt, gapMode: { kind: "proportional" } });

describe("bankByCode", () => {
  const opening = { weekStart: "2026-09-14", perCode: { a: 90, b: -30 } };
  const bookings = [
    booking("2026-09-07", { a: 999 }, []), // before opening: ignored
    booking("2026-09-14", { a: 1500, b: 960 }, [{ date: "2026-09-14", codeId: "a", minutes: 1440 }, { date: "2026-09-15", codeId: "b", minutes: 960 }]),
    booking("2026-09-21", { a: 2400 }, [{ date: "2026-09-21", codeId: "a", minutes: 2400 }], null), // draft: ignored
  ];
  it("adds confirmed weeks' earned − booked onto the opening balance", () => {
    expect(bankByCode(opening, bookings)).toEqual({ a: 150, b: -30 });
  });
  it("can stop before a given week", () => {
    expect(bankByCode(opening, bookings, { beforeWeekStart: "2026-09-14" })).toEqual({ a: 90, b: -30 });
  });
  it("counts every confirmed week when there's no opening balance", () => {
    expect(bankByCode(null, bookings).a).toBe(999 + 60);
  });
  it("weekDelta is earned − booked", () => {
    expect(weekDelta(bookings[1])).toEqual({ a: 60, b: 0 });
  });
});

describe("isStale", () => {
  it("flags a confirmed week whose earned changed", () => {
    const b = booking("2026-09-14", { a: 100 }, []);
    expect(isStale(b, { a: 100 })).toBe(false);
    expect(isStale(b, { a: 100, b: 0 })).toBe(false);
    expect(isStale(b, { a: 130 })).toBe(true);
    expect(isStale({ ...b, confirmedAt: null }, { a: 130 })).toBe(false);
  });
});
