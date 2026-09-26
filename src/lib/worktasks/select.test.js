import { describe, it, expect } from "vitest";
import { nowSections, compareTasks, daysWaiting, effortDueBy, filterTasks, projectStats } from "./select.js";

const TODAY = "2026-09-26";
let n = 0;
const t = (fields) => ({ id: `t${++n}`, status: "todo", priority: "medium", tags: [], projectId: "p1", createdAt: n, ...fields });

describe("compareTasks", () => {
  it("due first, hard deadline before soft on the same day, then priority, then age", () => {
    const a = t({ dueDate: "2026-09-30" });
    const b = t({ dueDate: "2026-09-30", hardDeadline: true });
    const c = t({ dueDate: "2026-09-28", priority: "low" });
    const d = t({ priority: "high" });
    const e = t({});
    expect([a, b, c, d, e].sort(compareTasks).map((x) => x.id)).toEqual([c.id, b.id, a.id, d.id, e.id]);
  });
});

describe("nowSections", () => {
  it("puts each open task in its first matching section", () => {
    const doing = t({ status: "doing", startDate: "2026-12-01" }); // shown despite future start
    const overdue = t({ dueDate: "2026-09-20", priority: "high" });
    const soon = t({ dueDate: "2026-10-03" });
    const later = t({ dueDate: "2026-10-04" });
    const high = t({ priority: "high" });
    const future = t({ priority: "high", startDate: "2026-10-01" });
    const waiting = t({ status: "waiting", statusChangedAt: 5 });
    const waitingOlder = t({ status: "waiting", statusChangedAt: 1 });
    const done = t({ status: "done", dueDate: "2026-09-20" });
    const inbox = t({ projectId: null });
    const s = nowSections([doing, overdue, soon, later, high, future, waiting, waitingOlder, done, inbox], TODAY);
    expect(s.doing).toEqual([doing]);
    expect(s.overdue).toEqual([overdue]);
    expect(s.dueSoon).toEqual([soon]);
    expect(s.high).toEqual([high]);
    expect(s.waiting).toEqual([waitingOlder, waiting]);
    expect(s.otherCount).toBe(2); // later, inbox
    expect(s.inboxCount).toBe(1);
  });
});

it("daysWaiting counts whole days", () => {
  expect(daysWaiting({ statusChangedAt: 0 }, 5 * 86400000 + 1000)).toBe(5);
});

it("effortDueBy sums open tasks due by the date, overdue included", () => {
  const list = [
    t({ dueDate: "2026-09-20", effortMin: 60 }),
    t({ dueDate: "2026-09-28", effortMin: 90 }),
    t({ dueDate: "2026-10-05", effortMin: 30 }),
    t({ dueDate: "2026-09-27", effortMin: 30, status: "done" }),
    t({ effortMin: 30 }),
  ];
  expect(effortDueBy(list, "2026-09-28")).toBe(150);
});

describe("filterTasks", () => {
  const a = t({ status: "doing", tags: ["x"] });
  const b = t({ projectId: null, tags: ["y"] });
  const c = t({ projectId: "p2" });
  it("filters by status, project (incl. inbox) and any tag", () => {
    expect(filterTasks([a, b, c], { status: "doing" })).toEqual([a]);
    expect(filterTasks([a, b, c], { projectIds: ["inbox", "p2"] })).toEqual([b, c]);
    expect(filterTasks([a, b, c], { tagIds: ["x", "y"] })).toEqual([a, b]);
    expect(filterTasks([a, b, c])).toEqual([a, b, c]);
  });
});

it("projectStats counts open tasks and open effort per project", () => {
  const s = projectStats([t({ effortMin: 60 }), t({ status: "done", effortMin: 30 }), t({ projectId: null, effortMin: 30 })]);
  expect(s.p1).toEqual({ open: 1, total: 2, effortOpen: 60 });
  expect(s.inbox).toEqual({ open: 1, total: 1, effortOpen: 30 });
});
