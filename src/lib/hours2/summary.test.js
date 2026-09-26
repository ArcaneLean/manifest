import { describe, it, expect } from "vitest";
import { summarizeWeek, earnedForWeek, DEFAULT_SETTINGS } from "./summary.js";
import { weekLabel, weekStartOf, isoWeekNumber } from "./week.js";

const seg = (start, end, codeId = "a") => ({ start, end, codeId });

describe("summarizeWeek", () => {
  const worklog = {
    "2026-09-21": { date: "2026-09-21", officeIn: "08:00", officeOut: "16:30", segments: [seg("08:15", "16:15")] }, // paid 480, logged 480
    "2026-09-22": { date: "2026-09-22", segments: [seg("08:00", "12:00"), seg("12:30", "16:30", "b")] }, // 480
    "2026-09-23": { date: "2026-09-23", officeIn: "08:00", officeOut: "17:30", segments: [seg("09:00", "17:00")] }, // paid 540, logged 480
    "2026-09-24": { date: "2026-09-24", segments: [seg("08:00", null)] }, // incomplete
    "2026-09-25": { date: "2026-09-25", dayOff: "leave", segments: [] },
  };
  const s = summarizeWeek("2026-09-21", worklog, DEFAULT_SETTINGS, { todayISO: "2026-09-28" });

  it("totals the week", () => {
    expect(s.bookable).toBe(1920);
    expect(s.paid).toBe(480 + 480 + 540);
    expect(s.logged).toBe(480 + 480 + 480);
    expect(s.loggedByCode).toEqual({ a: 480 + 240 + 480, b: 240 });
    expect(s.diff).toBe(1500 - 1920);
    expect(s.incomplete).toEqual(["2026-09-24"]);
    expect(s.bookingDays.map((d) => d.bookable)).toEqual([true, true, true, true, false]);
  });

  it("earned sums to paid", () => {
    const { earned } = earnedForWeek(s, { kind: "proportional" });
    expect(Object.values(earned).reduce((a, b) => a + b, 0)).toBe(s.paid);
  });
});

describe("week labels", () => {
  it("uses ISO week numbers and Monday starts", () => {
    expect(weekStartOf("2026-09-26")).toBe("2026-09-21");
    expect(isoWeekNumber("2026-09-21")).toBe(39);
    expect(isoWeekNumber("2026-01-01")).toBe(1);
    expect(isoWeekNumber("2027-01-01")).toBe(53);
    expect(weekLabel("2026-09-28")).toBe("wk 40 · 28 sep – 2 oct");
  });
});
