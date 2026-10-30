import { describe, it, expect } from "vitest";
import { addMonths, monthDiff, monthRange, monthLabel, isMonth } from "./month.js";

describe("months", () => {
  it("adds and diffs across years", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthDiff("2027-08", "2036-07")).toBe(107);
    expect(monthDiff("2026-03", "2025-12")).toBe(-3);
  });
  it("ranges inclusively and labels", () => {
    expect(monthRange("2026-11", "2027-01")).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(monthLabel("2026-09")).toBe("sep '26");
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-09")).toBe(true);
  });
});
