// End-to-end check of the v12 upgrade and of restoring a v1 (pre-Hours 2.0)
// backup, against an in-memory IndexedDB.
import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll } from "vitest";
import { openDB } from "idb";
import { getDB } from "../db.js";
import { restoreBackupSnapshot, buildBackupSnapshot, SNAPSHOT_VERSION } from "../backupSnapshot.js";
import { summarizeWeek, DEFAULT_SETTINGS } from "./summary.js";

const projects = [
  { id: "p-hq", name: "HQPack", color: "#c47b8b" },
  { id: "p-bd", name: "Blenddata", color: "#5fa8a0" },
];
const v11Worklog = [
  { date: "2026-09-22", segments: [{ start: "08:11", end: "12:00", projectId: "p-hq" }, { start: "12:00", end: "12:30", projectId: null }, { start: "12:30", end: "16:49", projectId: "p-hq" }] },
  { date: "2026-09-24", segments: [{ start: "07:40", end: "09:00", projectId: "p-bd" }, { start: "09:00", end: "09:57", projectId: "p-hq" }] },
];

function loggedTotalsOld(entries) {
  let total = 0;
  for (const e of entries) for (const s of e.segments) if (s.projectId && s.end) total += toMin(s.end) - toMin(s.start);
  return total;
}
function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

beforeAll(async () => {
  // Build a v11 database the way the previous app version left it.
  const old = await openDB("manifest", 11, {
    upgrade(db) {
      for (const name of ["worklog", "projects"]) db.createObjectStore(name, { keyPath: name === "worklog" ? "date" : "id" });
      db.createObjectStore("tasks", { keyPath: "id" });
    },
  });
  for (const p of projects) await old.put("projects", p);
  for (const e of v11Worklog) await old.put("worklog", e);
  old.close();
});

describe("DB v12 upgrade", () => {
  it("also creates the v13 Work tasks stores", async () => {
    const db = await getDB();
    for (const name of ["workTasks", "workProjects", "workTags"]) expect(db.objectStoreNames.contains(name)).toBe(true);
  });

  it("migrates worklog segments to codes and keeps logged totals", async () => {
    const db = await getDB();
    const codes = await db.getAll("bookingcodes");
    expect(codes.map((c) => c.id).sort()).toEqual(["code-p-bd", "code-p-hq"]);
    const worklog = await db.getAll("worklog");
    for (const e of worklog) for (const s of e.segments) expect("projectId" in s).toBe(false);
    const map = Object.fromEntries(worklog.map((e) => [e.date, e]));
    const s = summarizeWeek("2026-09-21", map, DEFAULT_SETTINGS, { todayISO: "2026-09-28" });
    expect(s.logged).toBe(loggedTotalsOld(v11Worklog));
    expect(s.paid).toBe(s.logged); // no office visits -> home days
  });

  it("restores a v1 backup into v12 shape", async () => {
    const snapshot = {
      version: 1,
      exportedAt: 0,
      stores: { projects, worklog: v11Worklog, tasks: [] },
    };
    await restoreBackupSnapshot(snapshot);
    const db = await getDB();
    const worklog = await db.getAll("worklog");
    expect(worklog.find((e) => e.date === "2026-09-24").segments[0]).toEqual({ start: "07:40", end: "09:00", codeId: "code-p-bd" });
    expect((await db.getAll("bookingcodes")).length).toBe(2);
    const snap = await buildBackupSnapshot();
    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(Array.isArray(snap.stores.bookings)).toBe(true);
  });
});
