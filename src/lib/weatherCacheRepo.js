import { getDB } from "./db.js";

// Cache key groups nearby ride windows onto one forecast fetch — two-decimal
// lat/lon is ~1km resolution, well under model grid spacing, so nothing is
// lost by rounding.
export function locationKey(lat, lon) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function getCachedForecast(key) {
  const db = await getDB();
  return db.get("weatherCache", key);
}

export async function putCachedForecast(entry) {
  const db = await getDB();
  await db.put("weatherCache", entry);
  return entry;
}
