import { describe, it, expect } from "vitest";
import { parseAmount, formatCents, centsToInput } from "./money.js";

describe("parseAmount", () => {
  it("reads Dutch and English notation", () => {
    expect(parseAmount("1.234,56")).toBe(123456);
    expect(parseAmount("1234,5")).toBe(123450);
    expect(parseAmount("1234.56")).toBe(123456);
    expect(parseAmount("1.234")).toBe(123400);
    expect(parseAmount("€ 7.047,73")).toBe(704773);
    expect(parseAmount(",5")).toBe(50);
  });
  it("applies the default sign only when none is typed", () => {
    expect(parseAmount("99,24", -1)).toBe(-9924);
    expect(parseAmount("+78,04", -1)).toBe(7804);
    expect(parseAmount("-5", 1)).toBe(-500);
    expect(parseAmount("3,65-")).toBe(-365);
    expect(parseAmount("−12")).toBe(-1200);
  });
  it("rejects junk and empty input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1,2,3")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats euros the Dutch way", () => {
    expect(formatCents(123456)).toBe("€ 1.234,56");
    expect(formatCents(-365)).toBe("−€ 3,65");
    expect(formatCents(500, { signed: true })).toBe("+€ 5,00");
    expect(formatCents(0, { signed: true })).toBe("€ 0,00");
  });
  it("round-trips through the input format", () => {
    for (const c of [0, 5, -365, 123456, -704773]) expect(parseAmount(centsToInput(c))).toBe(c);
  });
});
