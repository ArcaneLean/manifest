import { getDB } from "./db.js";

// Read-only cache of Google Calendar events — see ARCHITECTURE.md §7
// ("Google Calendar integration"). `gcalMeta` holds the incremental-sync
// token and last-synced timestamp, keyed by a fixed "sync" row.
const META_KEY = "sync";

export async function listGCalEvents() {
  const db = await getDB();
  return db.getAll("gcalEvents");
}

export async function putGCalEvents(events) {
  if (events.length === 0) return;
  const db = await getDB();
  const tx = db.transaction("gcalEvents", "readwrite");
  await Promise.all(events.map((e) => tx.store.put(e)));
  await tx.done;
}

export async function deleteGCalEvents(ids) {
  if (ids.length === 0) return;
  const db = await getDB();
  const tx = db.transaction("gcalEvents", "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

export async function clearGCalEvents() {
  const db = await getDB();
  await db.clear("gcalEvents");
}

export async function getGCalMeta() {
  const db = await getDB();
  const row = await db.get("gcalMeta", META_KEY);
  return row || { key: META_KEY, syncToken: null, lastSyncedAt: null };
}

export async function putGCalMeta(patch) {
  const db = await getDB();
  const current = await getGCalMeta();
  const next = { ...current, ...patch, key: META_KEY };
  await db.put("gcalMeta", next);
  return next;
}

export async function clearGCalMeta() {
  const db = await getDB();
  await db.delete("gcalMeta", META_KEY);
}
