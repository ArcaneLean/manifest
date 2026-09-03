import { getDB } from "./db.js";

// Per-calendar display prefs (color, hidden) — one row per Google calendar
// the account has ever synced, keyed by calendarId. See db.js v7 and
// googleCalendarSync.js, which keeps this store's rows in sync with the
// account's calendar list.

export async function listCalendarSettings() {
  const db = await getDB();
  return db.getAll("calendarSettings");
}

export async function getCalendarSettings(calendarId) {
  const db = await getDB();
  return db.get("calendarSettings", calendarId);
}

export async function putCalendarSettings(settings) {
  const db = await getDB();
  await db.put("calendarSettings", settings);
  return settings;
}

export async function deleteCalendarSettings(calendarId) {
  const db = await getDB();
  await db.delete("calendarSettings", calendarId);
}
