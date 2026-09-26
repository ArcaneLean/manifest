import { describe, it, expect } from "vitest";
import { parseSignedDuration, formatSignedHHMM, codeLabel } from "./codes.js";

describe("parseSignedDuration", () => {
  it("accepts h:mm, decimals, h/m suffixes and signs", () => {
    expect(parseSignedDuration("+2:30")).toBe(150);
    expect(parseSignedDuration("-1:15")).toBe(-75);
    expect(parseSignedDuration("2.5")).toBe(150);
    expect(parseSignedDuration("-0,5")).toBe(-30);
    expect(parseSignedDuration("90m")).toBe(90);
    expect(parseSignedDuration("2h30")).toBe(150);
    expect(parseSignedDuration("")).toBe(0);
    expect(parseSignedDuration("abc")).toBeNull();
  });
  it("round-trips through formatSignedHHMM", () => {
    for (const m of [0, 5, -75, 150, 600]) expect(parseSignedDuration(formatSignedHHMM(m))).toBe(m);
  });
});

describe("codeLabel", () => {
  const projects = [{ id: "p1", name: "HQPack" }, { id: "p2", name: "Blenddata" }];
  const codes = [
    { id: "a", projectId: "p1", name: "billable" },
    { id: "b", projectId: "p1", name: "unbillable" },
    { id: "c", projectId: "p2", name: "internal" },
  ];
  it("shows just the project when it has one code", () => {
    expect(codeLabel("a", codes, projects)).toBe("HQPack · billable");
    expect(codeLabel("c", codes, projects)).toBe("Blenddata");
    expect(codeLabel("zzz", codes, projects)).toBe("?");
  });
});
