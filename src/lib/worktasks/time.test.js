import { describe, it, expect } from "vitest";
import { actualByTask, actualByProject, runningSegment, codeForTask } from "./time.js";

const worklog = {
  "2026-09-25": {
    date: "2026-09-25",
    segments: [
      { start: "09:00", end: "10:30", codeId: "c1", taskId: "a" },
      { start: "10:30", end: "11:00", codeId: null, taskId: "a" }, // break never counts
      { start: "11:00", end: "12:00", codeId: "c1" },
      { start: "13:00", end: null, codeId: "c1", taskId: "b" }, // left open on a past day
    ],
  },
  "2026-09-26": {
    date: "2026-09-26",
    segments: [
      { start: "08:00", end: "08:30", codeId: "c1", taskId: "a" },
      { start: "08:30", end: null, codeId: "c2", taskId: "b" },
    ],
  },
};

describe("actualByTask", () => {
  it("sums coded segments per task, projecting today's open one to now", () => {
    expect(actualByTask(worklog, { todayISO: "2026-09-26", nowMin: 9 * 60 + 15 })).toEqual({ a: 120, b: 45 });
  });
  it("ignores open segments without a now", () => {
    expect(actualByTask(worklog)).toEqual({ a: 120 });
  });
});

it("actualByProject groups by the task's project", () => {
  const tasks = [
    { id: "a", projectId: "p1" },
    { id: "b", projectId: null },
    { id: "c", projectId: "p1" },
  ];
  expect(actualByProject(tasks, { a: 120, b: 45 })).toEqual({ p1: 120, inbox: 45 });
});

it("runningSegment is today's open segment", () => {
  expect(runningSegment(worklog, "2026-09-26")).toMatchObject({ taskId: "b", codeId: "c2" });
  expect(runningSegment(worklog, "2026-09-27")).toBe(null);
});

describe("codeForTask", () => {
  const projects = [
    { id: "mds", codeId: "c1" },
    { id: "old", codeId: "c9" },
    { id: "none" },
  ];
  const codes = [
    { id: "c1", archived: false },
    { id: "c9", archived: true },
  ];
  it("uses the project's linked, non-archived code", () => {
    expect(codeForTask({ projectId: "mds" }, projects, codes)).toBe("c1");
    expect(codeForTask({ projectId: "old" }, projects, codes)).toBe(null);
    expect(codeForTask({ projectId: "none" }, projects, codes)).toBe(null);
    expect(codeForTask({ projectId: null }, projects, codes)).toBe(null);
  });
});
