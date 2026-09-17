import { getDB } from "./db.js";

// A RideWindow models a whole commute *route*, not a single spot along it —
// `stops` is the ordered set of places the ride passes through, sharing one
// weekly recurrence and one time-of-day window. Forecasts are aggregated
// across every stop (see cyclingWeather.js's forecastForRoute) so a route
// gets one verdict, not one per stop.
//
// Pre-route records stored a single `{locationLabel, lat, lon}` directly on
// the window instead of `stops`. `listRideWindows` migrates those on read:
// a lone legacy record becomes a one-stop route; several legacy records that
// share the exact same days/startTime/endTime (the "same commute, different
// waypoint" shape a user gets from adding one leg at a time) are merged into
// a single multi-stop route instead, since that recurrence match is what
// actually identifies them as one route rather than a coincidence. Only
// legacy records are ever auto-merged — once a record has `stops`, it's left
// alone, so two deliberately-created routes that happen to share a time never
// get merged into each other.
function isLegacyShape(w) {
  return !Array.isArray(w.stops) && w.lat != null && w.lon != null;
}

function recurrenceKey(w) {
  return `${[...w.days].sort((a, b) => a - b).join(",")}|${w.startTime}|${w.endTime}`;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strips each member's own city name off its label (e.g. "morning commute
// Veldhoven" -> "morning commute") and uses that as the merged route's label
// when every member agrees on it — otherwise falls back to the first
// member's label untouched rather than guessing.
function mergedLabel(members) {
  const stripped = members.map((w) => {
    const city = (w.locationLabel || "").split(",")[0].trim();
    if (!city) return null;
    return w.label.replace(new RegExp(`\\s*${escapeRegExp(city)}\\s*$`, "i"), "").trim();
  });
  const [first] = stripped;
  if (first && stripped.every((s) => s && s.toLowerCase() === first.toLowerCase())) return first;
  return members[0].label;
}

function toRoute(w) {
  return {
    id: w.id,
    label: w.label,
    stops: [{ label: w.locationLabel, lat: w.lat, lon: w.lon }],
    days: w.days,
    startTime: w.startTime,
    endTime: w.endTime,
    direction: w.direction ?? null,
  };
}

function mergeGroup(members) {
  return {
    id: crypto.randomUUID(),
    label: mergedLabel(members),
    stops: members.map((w) => ({ label: w.locationLabel, lat: w.lat, lon: w.lon })),
    days: members[0].days,
    startTime: members[0].startTime,
    endTime: members[0].endTime,
    direction: members.find((w) => w.direction != null)?.direction ?? null,
  };
}

// Splits legacy records into recurrence-matched groups and turns each group
// into one route (merged if it has company, a plain one-stop route
// otherwise). Returns the migrated routes plus which DB writes that took —
// callers persist those so the migration only ever runs once per record.
function migrateLegacy(raw) {
  const legacy = raw.filter(isLegacyShape);
  const current = raw.filter((w) => !isLegacyShape(w));

  const groups = new Map();
  for (const w of legacy) {
    const key = recurrenceKey(w);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }

  const migrated = [];
  const toPut = [];
  const toDelete = [];
  for (const members of groups.values()) {
    if (members.length > 1) {
      const route = mergeGroup(members);
      migrated.push(route);
      toPut.push(route);
      toDelete.push(...members.map((w) => w.id));
    } else {
      const route = toRoute(members[0]);
      migrated.push(route);
      toPut.push(route);
    }
  }

  return { windows: [...current, ...migrated], toPut, toDelete };
}

export async function listRideWindows() {
  const db = await getDB();
  const raw = await db.getAll("rideWindows");
  const { windows, toPut, toDelete } = migrateLegacy(raw);
  if (toPut.length > 0 || toDelete.length > 0) {
    const tx = db.transaction("rideWindows", "readwrite");
    await Promise.all([...toPut.map((w) => tx.store.put(w)), ...toDelete.map((id) => tx.store.delete(id))]);
    await tx.done;
  }
  return windows;
}

export async function putRideWindow(rideWindow) {
  const db = await getDB();
  await db.put("rideWindows", rideWindow);
  return rideWindow;
}

export async function deleteRideWindow(id) {
  const db = await getDB();
  await db.delete("rideWindows", id);
}
