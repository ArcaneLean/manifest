import { getDB } from "./db.js";

// Read-only cache of Google Calendar events across every calendar on the
// account — see ARCHITECTURE.md §7 ("Google Calendar integration").
// `gcalEvents` rows are keyed by `${calendarId}:${eventId}` (event ids are
// only unique within their own calendar). `gcalMeta` holds one row per
// calendar — its incremental-sync token and last-synced time — keyed by
// calendarId, since Google issues syncTokens per calendar.

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

// `keys` are compound `${calendarId}:${eventId}` strings, matching the
// store's keyPath.
export async function deleteGCalEvents(keys) {
  if (keys.length === 0) return;
  const db = await getDB();
  const tx = db.transaction("gcalEvents", "readwrite");
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}

// Drops every cached event for one calendar — used on a stale syncToken
// (410) resync and when a calendar disappears from the account.
export async function deleteGCalEventsForCalendar(calendarId) {
  const db = await getDB();
  const allKeys = await db.getAllKeys("gcalEvents");
  const prefix = `${calendarId}:`;
  const keys = allKeys.filter((k) => k.startsWith(prefix));
  if (keys.length === 0) return;
  const tx = db.transaction("gcalEvents", "readwrite");
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}

export async function clearGCalEvents() {
  const db = await getDB();
  await db.clear("gcalEvents");
}

export async function listGCalMeta() {
  const db = await getDB();
  return db.getAll("gcalMeta");
}

export async function getGCalMeta(calendarId) {
  const db = await getDB();
  const row = await db.get("gcalMeta", calendarId);
  return row || { calendarId, syncToken: null, lastSyncedAt: null };
}

export async function putGCalMeta(calendarId, patch) {
  const db = await getDB();
  const current = await getGCalMeta(calendarId);
  const next = { ...current, ...patch, calendarId };
  await db.put("gcalMeta", next);
  return next;
}

export async function deleteGCalMeta(calendarId) {
  const db = await getDB();
  await db.delete("gcalMeta", calendarId);
}

export async function clearGCalMeta() {
  const db = await getDB();
  await db.clear("gcalMeta");
}
