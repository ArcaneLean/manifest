// Copying the main app's data into a preview database, against an in-memory
// IndexedDB. Tests run as the "main" channel, so getDB() is "manifest" here
// and a separate database stands in for main as the copy source.
import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll } from "vitest";
import { openDB } from "idb";
import { getDB } from "./db.js";
import { copyDataFrom } from "./previewData.js";

const SOURCE = "manifest-source";

beforeAll(async () => {
  const src = await openDB(SOURCE, 99, {
    upgrade(db) {
      db.createObjectStore("tasks", { keyPath: "id" });
      db.createObjectStore("weatherCache", { keyPath: "key" });
      db.createObjectStore("onlyInNewerSchema", { keyPath: "id" });
    },
  });
  await src.put("tasks", { id: "t1", title: "real task" });
  await src.put("weatherCache", { key: "52,4", data: 1 });
  await src.put("onlyInNewerSchema", { id: "x" });
  src.close();

  const own = await getDB();
  await own.put("tasks", { id: "t-preview", title: "preview-only task" });
});

describe("copyDataFrom", () => {
  it("replaces own stores with the source's, skipping caches and unknown stores", async () => {
    const copied = await copyDataFrom(SOURCE);
    const db = await getDB();
    expect(await db.getAll("tasks")).toEqual([{ id: "t1", title: "real task" }]);
    expect(await db.getAll("weatherCache")).toEqual([]);
    expect(copied).toContain("tasks");
    expect(copied).not.toContain("onlyInNewerSchema");
  });

  it("leaves the source database at its own version", async () => {
    const src = await openDB(SOURCE);
    expect(src.version).toBe(99);
    src.close();
  });

  it("refuses when the source doesn't exist", async () => {
    await expect(copyDataFrom("does-not-exist")).rejects.toThrow(/no data/);
  });
});
