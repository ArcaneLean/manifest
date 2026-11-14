import { describe, it, expect } from "vitest";
import {
  newPursuit,
  withStatus,
  moveToStatus,
  endRank,
  forTab,
  reorder,
  tabForStatus,
  kindSuggestions,
  addItem,
  toggleItem,
  updateItem,
  removeItem,
  moveItem,
  itemTally,
  currentItem,
} from "./model.js";

const p = (fields) => ({ id: fields.title, kind: "", rank: 0, items: [], createdAt: 0, startedAt: null, finishedAt: null, ...fields });

describe("newPursuit", () => {
  it("defaults to an idea with timestamps", () => {
    const x = newPursuit({ title: "manifest" }, 100);
    expect(x).toMatchObject({ title: "manifest", status: "idea", createdAt: 100, statusChangedAt: 100, startedAt: null, finishedAt: null, items: [] });
  });

  it("stamps startedAt when created active", () => {
    expect(newPursuit({ title: "Berserk", status: "active" }, 5).startedAt).toBe(5);
  });
});

describe("withStatus", () => {
  it("keeps the first startedAt through pause and resume", () => {
    let x = withStatus(p({ title: "a", status: "queued" }), "active", 10);
    x = withStatus(x, "paused", 20);
    x = withStatus(x, "active", 30);
    expect(x.startedAt).toBe(10);
    expect(x.statusChangedAt).toBe(30);
  });

  it("sets finishedAt only while done/dropped", () => {
    let x = withStatus(p({ title: "a", status: "active" }), "done", 10);
    expect(x.finishedAt).toBe(10);
    x = withStatus(x, "active", 20);
    expect(x.finishedAt).toBeNull();
  });

  it("is a no-op for the same status", () => {
    const x = p({ title: "a", status: "active" });
    expect(withStatus(x, "active", 99)).toBe(x);
  });
});

describe("ranks and tabs", () => {
  const list = [
    p({ title: "q1", status: "queued", rank: 0 }),
    p({ title: "q2", status: "queued", rank: 1 }),
    p({ title: "act", status: "active", rank: 0 }),
    p({ title: "pau", status: "paused", rank: 0 }),
    p({ title: "i-old", status: "idea", createdAt: 1 }),
    p({ title: "i-new", status: "idea", createdAt: 2 }),
    p({ title: "d-old", status: "done", finishedAt: 1 }),
    p({ title: "d-new", status: "dropped", finishedAt: 2 }),
  ];

  it("appends to the end of the target list", () => {
    expect(endRank(list, "queued")).toBe(2);
    expect(endRank(list, "game-over")).toBe(0);
    const moved = moveToStatus(list, list[4], "queued", 50);
    expect(moved).toMatchObject({ status: "queued", rank: 2, statusChangedAt: 50 });
  });

  it("orders each tab", () => {
    const titles = (tab) => forTab(list, tab).map((x) => x.title);
    expect(titles("now")).toEqual(["act", "pau"]);
    expect(titles("next")).toEqual(["q1", "q2"]);
    expect(titles("ideas")).toEqual(["i-new", "i-old"]);
    expect(titles("done")).toEqual(["d-new", "d-old"]);
  });

  it("maps statuses to tabs", () => {
    expect(tabForStatus("paused")).toBe("now");
    expect(tabForStatus("queued")).toBe("next");
    expect(tabForStatus("dropped")).toBe("done");
  });

  it("returns only the records whose rank changed", () => {
    const changed = reorder(list, ["q2", "q1"]);
    expect(changed.map((x) => [x.title, x.rank])).toEqual([
      ["q2", 0],
      ["q1", 1],
    ]);
    expect(reorder(list, ["q1", "q2"])).toEqual([]);
  });
});

describe("kindSuggestions", () => {
  it("puts used kinds first, by use, then unused defaults", () => {
    const list = [p({ title: "a", kind: "Code" }), p({ title: "b", kind: "code" }), p({ title: "c", kind: "manga" }), p({ title: "d", kind: "zine" })];
    const out = kindSuggestions(list);
    expect(out.slice(0, 3)).toEqual(["code", "manga", "zine"]);
    expect(out).toContain("book series");
    expect(out.filter((k) => k === "code")).toHaveLength(1);
  });
});

describe("items", () => {
  it("adds, toggles, edits, moves and removes", () => {
    let items = addItem([], "  dark mode ");
    items = addItem(items, "   ");
    items = addItem(items, "sync");
    expect(items.map((i) => i.title)).toEqual(["dark mode", "sync"]);
    const [a, b] = items;
    items = toggleItem(items, a.id);
    expect(items[0].status).toBe("done");
    items = toggleItem(items, a.id);
    expect(items[0].status).toBe("todo");
    items = updateItem(items, b.id, { status: "doing", note: "half" });
    expect(items[1]).toMatchObject({ status: "doing", note: "half" });
    items = moveItem(items, 1, 0);
    expect(items.map((i) => i.id)).toEqual([b.id, a.id]);
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(removeItem(items, a.id).map((i) => i.id)).toEqual([b.id]);
  });

  it("tallies without dropped items and finds the current one", () => {
    const items = [
      { id: "1", title: "vol 1", status: "done" },
      { id: "2", title: "vol 2", status: "dropped" },
      { id: "3", title: "vol 3", status: "todo" },
      { id: "4", title: "vol 4", status: "doing" },
    ];
    expect(itemTally(items)).toEqual({ done: 1, total: 3 });
    expect(currentItem(items).id).toBe("4");
    expect(currentItem(items.slice(0, 3)).id).toBe("3");
    expect(currentItem([])).toBeNull();
  });
});
