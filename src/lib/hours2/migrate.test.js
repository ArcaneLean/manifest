import { describe, it, expect } from "vitest";
import { migrateHoursRecords } from "./migrate.js";

const projects = [
  { id: "p1", name: "HQPack", color: "#c47b8b" },
  { id: "p2", name: "Blenddata", color: "#5fa8a0" },
];
const worklog = [
  { date: "2026-09-24", segments: [{ start: "07:40", end: "09:00", projectId: "p2" }, { start: "09:00", end: "09:30", projectId: null }, { start: "09:30", end: "11:19", projectId: "p1" }] },
];

describe("migrateHoursRecords", () => {
  it("creates one default code per project and maps segments onto it", () => {
    const out = migrateHoursRecords({ worklog, projects });
    expect(out.bookingcodes.map((c) => [c.id, c.projectId, c.name])).toEqual([
      ["code-p1", "p1", "default"],
      ["code-p2", "p2", "default"],
    ]);
    expect(out.worklog[0].segments).toEqual([
      { start: "07:40", end: "09:00", codeId: "code-p2" },
      { start: "09:00", end: "09:30", codeId: null },
      { start: "09:30", end: "11:19", codeId: "code-p1" },
    ]);
    expect(out.worklog[0].officeIn).toBeUndefined();
  });

  it("is idempotent", () => {
    const once = migrateHoursRecords({ worklog, projects });
    const twice = migrateHoursRecords({ ...once, projects });
    expect(twice).toEqual(once);
  });
});
