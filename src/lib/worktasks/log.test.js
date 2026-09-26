import { it, expect } from "vitest";
import { logByWeek } from "./log.js";

const at = (iso, h = 12) => new Date(`${iso}T${String(h).padStart(2, "0")}:00:00`).getTime();

it("groups done tasks by ISO week then project, newest first", () => {
  const tasks = [
    { id: "a", status: "done", projectId: "p1", completedAt: at("2026-09-22") },
    { id: "b", status: "done", projectId: "p2", completedAt: at("2026-09-25") },
    { id: "c", status: "done", projectId: "p1", completedAt: at("2026-09-26") }, // saturday, same week
    { id: "d", status: "done", projectId: null, completedAt: at("2026-09-18") },
    { id: "e", status: "dropped", projectId: "p1", completedAt: null },
    { id: "f", status: "todo", projectId: "p1", completedAt: null },
  ];
  const log = logByWeek(tasks);
  expect(log.map((w) => w.weekStart)).toEqual(["2026-09-21", "2026-09-14"]);
  expect(log[0].count).toBe(3);
  expect(log[0].groups.map((g) => [g.projectId, g.tasks.map((t) => t.id)])).toEqual([
    ["p1", ["c", "a"]],
    ["p2", ["b"]],
  ]);
  expect(log[1].groups).toEqual([{ projectId: null, tasks: [tasks[3]] }]);
});
