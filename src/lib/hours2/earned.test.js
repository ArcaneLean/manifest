import { describe, it, expect } from "vitest";
import { apportion, earnedByCode } from "./earned.js";

const sum = (m) => Object.values(m).reduce((s, v) => s + v, 0);

describe("apportion", () => {
  it("sums exactly with uneven splits", () => {
    const r = apportion({ a: 1, b: 1, c: 1 }, 100);
    expect(sum(r)).toBe(100);
    expect(Object.values(r).sort()).toEqual([33, 33, 34]);
  });
  it("handles negative totals", () => {
    const r = apportion({ a: 2, b: 1 }, -31);
    expect(sum(r)).toBe(-31);
  });
  it("returns null when there's nothing to spread over", () => {
    expect(apportion({ a: 0 }, 10)).toBeNull();
    expect(apportion({}, 0)).toEqual({});
  });
});

describe("earnedByCode", () => {
  const logged = { a: 1200, b: 600 };
  it("proportional: spreads the gap by logged share, Σ earned = paid", () => {
    const { earned, gap } = earnedByCode(logged, 1900, { kind: "proportional" });
    expect(gap).toBe(100);
    expect(sum(earned)).toBe(1900);
    expect(earned.a).toBe(1267);
    expect(earned.b).toBe(633);
  });
  it("single: puts the whole gap on the chosen code, even an unlogged one", () => {
    const { earned } = earnedByCode(logged, 1900, { kind: "single", codeId: "c" });
    expect(earned).toEqual({ a: 1200, b: 600, c: 100 });
  });
  it("negative gap works in both modes", () => {
    expect(sum(earnedByCode(logged, 1770, { kind: "proportional" }).earned)).toBe(1770);
    expect(earnedByCode(logged, 1770, { kind: "single", codeId: "a" }).earned).toEqual({ a: 1170, b: 600 });
  });
  it("proportional with nothing logged is an error", () => {
    expect(earnedByCode({}, 480, { kind: "proportional" }).error).toBeTruthy();
    expect(earnedByCode({}, 480, { kind: "single", codeId: "a" }).earned).toEqual({ a: 480 });
  });
});
