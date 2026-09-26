import { describe, it, expect } from "vitest";
import { newWorkTask, withStatus, toggledStatus, stepEffort, notStartedYet } from "./model.js";

describe("newWorkTask", () => {
  it("fills defaults and starts as todo", () => {
    const t = newWorkTask({ title: "x" }, 1000);
    expect(t).toMatchObject({ title: "x", status: "todo", priority: "medium", projectId: null, tags: [], completedAt: null, statusChangedAt: 1000, createdAt: 1000 });
    expect(t.id).toBeTruthy();
  });

  it("honours an initial status", () => {
    expect(newWorkTask({ title: "x", status: "done" }, 5).completedAt).toBe(5);
  });
});

describe("withStatus", () => {
  const base = newWorkTask({ title: "x" }, 0);

  it("sets completedAt only while done", () => {
    const done = withStatus(base, "done", 10);
    expect(done.completedAt).toBe(10);
    expect(withStatus(done, "todo", 20).completedAt).toBe(null);
    expect(withStatus(base, "dropped", 20).completedAt).toBe(null);
  });

  it("is a no-op for the same status, so re-saving keeps completedAt", () => {
    const done = withStatus(base, "done", 10);
    expect(withStatus(done, "done", 99)).toBe(done);
  });

  it("keeps waitingOn only while waiting", () => {
    const w = withStatus({ ...base, waitingOn: "anna" }, "waiting", 5);
    expect(w.waitingOn).toBe("anna");
    expect(withStatus(w, "doing", 6).waitingOn).toBe(null);
  });

  it("rejects unknown statuses", () => {
    expect(() => withStatus(base, "backlog")).toThrow();
  });
});

describe("toggledStatus", () => {
  it("open → done, closed → todo", () => {
    expect(toggledStatus({ status: "waiting" })).toBe("done");
    expect(toggledStatus({ status: "dropped" })).toBe("todo");
  });
});

describe("stepEffort", () => {
  it("steps in 30m and clears below one step", () => {
    expect(stepEffort(null, 1)).toBe(30);
    expect(stepEffort(90, 1)).toBe(120);
    expect(stepEffort(30, -1)).toBe(null);
    expect(stepEffort(null, -1)).toBe(null);
  });
});

it("notStartedYet compares startDate to today", () => {
  expect(notStartedYet({ startDate: "2026-10-01" }, "2026-09-26")).toBe(true);
  expect(notStartedYet({ startDate: "2026-09-26" }, "2026-09-26")).toBe(false);
  expect(notStartedYet({}, "2026-09-26")).toBe(false);
});
