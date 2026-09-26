import { describe, it, expect } from "vitest";
import { paidMinutes, loggedMinutes, loggedByCode, officeMinutes, dayStatus, dayKind } from "./day.js";

const seg = (start, end, codeId = "a") => ({ start, end, codeId });

describe("paidMinutes", () => {
  it("home day counts only logged work, not breaks or gaps", () => {
    const day = { date: "2026-09-22", segments: [seg("08:30", "12:00"), seg("12:00", "12:45", null), seg("13:00", "16:45")] };
    expect(loggedMinutes(day)).toBe(210 + 225);
    expect(paidMinutes(day)).toBe(435);
  });

  it("office day pays arrival→departure minus 30m lunch, whatever was logged", () => {
    const day = { date: "2026-09-22", officeIn: "08:00", officeOut: "17:05", segments: [seg("08:20", "12:00"), seg("13:10", "16:40")] };
    expect(paidMinutes(day)).toBe(545 - 30);
    expect(loggedMinutes(day)).toBe(220 + 210);
  });

  it("lunch toggled off deducts nothing", () => {
    const day = { date: "x", officeIn: "08:00", officeOut: "12:30", officeLunch: false, segments: [] };
    expect(paidMinutes(day)).toBe(270);
  });

  it("mixed day adds logged work outside the office span, clipping straddling segments", () => {
    const day = {
      date: "x",
      officeIn: "08:00",
      officeOut: "12:30",
      officeLunch: false,
      segments: [seg("07:30", "08:30"), seg("08:30", "12:30"), seg("13:30", "17:00", "b")],
    };
    // office 270 + 30 before arrival + 210 at home
    expect(paidMinutes(day)).toBe(270 + 30 + 210);
    expect(dayKind(day)).toBe("office+home");
  });

  it("lunch can make paid lower than logged on a fully logged office day", () => {
    const day = { date: "x", officeIn: "08:00", officeOut: "16:00", segments: [seg("08:00", "16:00")] };
    expect(paidMinutes(day)).toBe(450);
    expect(loggedMinutes(day)).toBe(480);
  });

  it("leave pays nothing", () => {
    expect(paidMinutes({ date: "x", dayOff: "leave", segments: [seg("08:00", "09:00")] })).toBe(0);
  });

  it("projects open segments and an open office visit to now", () => {
    const day = { date: "x", officeIn: "08:00", segments: [seg("08:15", null)] };
    expect(paidMinutes(day, { nowMin: 10 * 60 })).toBe(120 - 30);
    expect(loggedMinutes(day, 10 * 60)).toBe(105);
    expect(paidMinutes(day)).toBe(0);
  });

  it("office time never goes negative on a short visit with lunch on", () => {
    expect(officeMinutes({ officeIn: "08:00", officeOut: "08:20" })).toBe(0);
  });

  it("ignores zero-length segments", () => {
    expect(loggedByCode({ segments: [seg("07:40", "07:40"), seg("07:40", "09:00", "b")] })).toEqual({ b: 80 });
  });
});

describe("dayStatus", () => {
  it("flags a past day left running as incomplete", () => {
    const day = { segments: [seg("08:00", null)] };
    expect(dayStatus(day, { isPast: true })).toBe("incomplete");
    expect(dayStatus(day, { isToday: true })).toBe("open");
    expect(dayStatus({ officeIn: "08:00", segments: [] }, { isPast: true })).toBe("incomplete");
    expect(dayStatus({ segments: [seg("08:00", "09:00")] }, { isPast: true })).toBe("done");
    expect(dayStatus(null, { isPast: true })).toBe("empty");
    expect(dayStatus({ dayOff: "leave", segments: [] })).toBe("leave");
  });
});
