// Hobbies record rules — see ARCHITECTURE.md §4/§7 ("Hobbies"). Pure: no
// IndexedDB/React. A Pursuit is anything done for fun (a manga, a book
// series, a code project, an idea); its `items` are the planned work /
// features / books of a series, kept inside the record in manual order.

export const STATUSES = ["idea", "queued", "active", "paused", "done", "dropped"];
export const ITEM_STATUSES = ["todo", "doing", "done", "dropped"];
const FINISHED = new Set(["done", "dropped"]);

// Which statuses each tab shows, in display order.
export const TAB_STATUSES = {
  now: ["active", "paused"],
  next: ["queued"],
  ideas: ["idea"],
  done: ["done", "dropped"],
};

export const DEFAULT_KINDS = ["manga", "book", "book series", "code", "game", "show"];

export function tabForStatus(status) {
  return Object.keys(TAB_STATUSES).find((tab) => TAB_STATUSES[tab].includes(status)) || "now";
}

export function isFinished(p) {
  return FINISHED.has(p.status);
}

export function newPursuit(fields = {}, now = Date.now()) {
  const { status = "idea", ...rest } = fields;
  return withStatus(
    {
      id: crypto.randomUUID(),
      title: "",
      kind: "",
      where: "",
      notes: "",
      link: null,
      rank: 0,
      items: [],
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      statusChangedAt: now,
      ...rest,
      status: null,
    },
    status,
    now
  );
}

// Status change with its timestamps: startedAt is the first time it went
// active (kept through pauses and re-queues), finishedAt is only set while
// done/dropped.
export function withStatus(p, status, now = Date.now()) {
  if (p.status === status) return p;
  return {
    ...p,
    status,
    statusChangedAt: now,
    startedAt: status === "active" && !p.startedAt ? now : p.startedAt,
    finishedAt: FINISHED.has(status) ? now : null,
  };
}

// Rank that puts a record at the end of `status`'s list.
export function endRank(pursuits, status, exceptId = null) {
  const ranks = pursuits.filter((p) => p.status === status && p.id !== exceptId).map((p) => p.rank ?? 0);
  return ranks.length ? Math.max(...ranks) + 1 : 0;
}

// Status change that also moves the record to the end of its new list.
export function moveToStatus(pursuits, p, status, now = Date.now()) {
  if (p.status === status) return p;
  return { ...withStatus(p, status, now), rank: endRank(pursuits, status, p.id) };
}

const byRank = (a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.createdAt - b.createdAt;

// The records a tab shows, in display order. Now: active then paused, by
// rank. Next: the queue, by rank. Ideas: newest first. Done: latest finish first.
export function forTab(pursuits, tab) {
  const statuses = TAB_STATUSES[tab] || [];
  const rows = pursuits.filter((p) => statuses.includes(p.status));
  if (tab === "ideas") return rows.sort((a, b) => b.createdAt - a.createdAt);
  if (tab === "done") return rows.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
  return rows.sort((a, b) => statuses.indexOf(a.status) - statuses.indexOf(b.status) || byRank(a, b));
}

// Records whose rank changes when a list is put into `orderedIds` order.
export function reorder(pursuits, orderedIds) {
  const byId = new Map(pursuits.map((p) => [p.id, p]));
  return orderedIds
    .map((id, rank) => byId.get(id) && { ...byId.get(id), rank })
    .filter((p) => p && p.rank !== byId.get(p.id).rank);
}

// Distinct kinds, most used first, then the defaults not yet used.
export function kindSuggestions(pursuits) {
  const counts = new Map();
  for (const p of pursuits) {
    const k = (p.kind || "").trim().toLowerCase();
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const used = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  return [...used, ...DEFAULT_KINDS.filter((k) => !counts.has(k))];
}

// ---- items ----

export function newItem(title) {
  return { id: crypto.randomUUID(), title: title.trim(), status: "todo", note: "" };
}

export function addItem(items, title) {
  return title.trim() ? [...items, newItem(title)] : items;
}

export function updateItem(items, id, patch) {
  return items.map((i) => (i.id === id ? { ...i, ...patch } : i));
}

// Checkbox: anything not done → done, done → todo.
export function toggleItem(items, id) {
  return items.map((i) => (i.id === id ? { ...i, status: i.status === "done" ? "todo" : "done" } : i));
}

export function removeItem(items, id) {
  return items.filter((i) => i.id !== id);
}

export function moveItem(items, from, to) {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// `4/9`-style tally; dropped items don't count either way.
export function itemTally(items = []) {
  const live = items.filter((i) => i.status !== "dropped");
  return { done: live.filter((i) => i.status === "done").length, total: live.length };
}

// What's being worked on, or else what's up next: the first doing item,
// else the first todo one.
export function currentItem(items = []) {
  return items.find((i) => i.status === "doing") || items.find((i) => i.status === "todo") || null;
}
