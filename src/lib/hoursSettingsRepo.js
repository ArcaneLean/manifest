import { getDB } from "./db.js";
import { DEFAULT_SETTINGS } from "./hours2/summary.js";

// Single-row Hours settings — see ARCHITECTURE.md §7 ("Hours 2.0"). Missing
// fields fall back to defaults, so no row is written until something changes.
export async function getHoursSettings() {
  const db = await getDB();
  const row = await db.get("hoursSettings", DEFAULT_SETTINGS.id);
  return { ...DEFAULT_SETTINGS, ...(row || {}) };
}

export async function putHoursSettings(settings) {
  const db = await getDB();
  const row = { ...settings, id: DEFAULT_SETTINGS.id };
  await db.put("hoursSettings", row);
  return row;
}
