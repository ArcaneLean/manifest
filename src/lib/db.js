import { openDB } from "idb";
import { timeToMinutes, minutesToTime } from "./timeUtils.js";
import { TAG_PALETTE } from "../theme/colors.js";

// Single shared IndexedDB module — see ARCHITECTURE.md §4/§7 ("Shared schema").
// Object stores for every entity in the data model are created up front so
// later views (Tags, Templates, Countdowns, Hours) don't require a version
// bump / migration just to add a store.
const DB_NAME = "manifest";
const DB_VERSION = 10;

let dbPromise = null;

// createObjectStore throws if the store already exists, and the whole
// upgrade() callback re-runs (from oldVersion, not from scratch) on every
// version bump — so each store creation must be guarded rather than
// assumed fresh, once there's more than one DB_VERSION in the wild.
function ensureStore(db, name, options) {
  if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options);
}

// Fixed-id fallback project that pre-v10 worklog entries (single
// session/day, no project concept) are migrated onto.
const LEGACY_PROJECT_ID = "legacy-general";

// Pre-v10 entries recorded one session/day as {start, end, breakMin} with no
// record of *when* the break happened, only its duration. The break is
// placed as a synthetic trailing segment so the visible start-end span and
// the total worked minutes both still match the original entry exactly.
function legacySegments(entry, legacyProjectId) {
  if (!entry.end) return [{ start: entry.start, end: null, projectId: legacyProjectId }];
  const startMin = timeToMinutes(entry.start);
  const endMin = timeToMinutes(entry.end);
  const brk = entry.breakMin || 0;
  const workEndMin = Math.max(startMin, endMin - brk);
  const segments = [{ start: entry.start, end: minutesToTime(workEndMin), projectId: legacyProjectId }];
  if (workEndMin < endMin) segments.push({ start: minutesToTime(workEndMin), end: entry.end, projectId: null });
  return segments;
}

// v10: Hours reworked from one session/day to multiple project-tagged
// segments/day — see ARCHITECTURE.md §4/§7. Runs inside the versionchange
// transaction itself (not lazily on read from hoursRepo.js) so the fallback
// "general" project it creates can never race a concurrent read of the
// `projects` store from useProjects — by the time getDB() resolves for
// anyone, migrated entries and their project already both exist.
async function migrateWorklogToSegments(transaction) {
  const worklogStore = transaction.objectStore("worklog");
  const entries = await worklogStore.getAll();
  const legacyEntries = entries.filter((e) => !e.segments);
  if (legacyEntries.length === 0) return;

  const projectsStore = transaction.objectStore("projects");
  let legacyProject = await projectsStore.get(LEGACY_PROJECT_ID);
  if (!legacyProject) {
    legacyProject = { id: LEGACY_PROJECT_ID, name: "general", color: TAG_PALETTE[0] };
    await projectsStore.put(legacyProject);
  }

  await Promise.all(
    legacyEntries.map((entry) => worklogStore.put({ date: entry.date, segments: legacySegments(entry, legacyProject.id) }))
  );
}

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, newVersion, transaction) {
        ensureStore(db, "tasks", { keyPath: "id" });
        ensureStore(db, "tags", { keyPath: "id" });
        ensureStore(db, "templates", { keyPath: "id" });
        ensureStore(db, "countdowns", { keyPath: "id" });
        ensureStore(db, "worklog", { keyPath: "date" });
        ensureStore(db, "projects", { keyPath: "id" });
        if (oldVersion < 10) await migrateWorklogToSegments(transaction);
        // v8: Hours reworked from a per-week target into a running flex-time
        // balance derived from worklog entries directly (see
        // ARCHITECTURE.md §4/§5) — weektargets is no longer read or written.
        if (db.objectStoreNames.contains("weektargets")) db.deleteObjectStore("weektargets");
        // Habits app — see ARCHITECTURE.md §5. `habits` holds the tracked
        // habit itself (name, positive/negative); `habitEntries` is the
        // event log (one row per time it was done), which both "last done"
        // and the contribution heatmap are derived from at render time.
        ensureStore(db, "habits", { keyPath: "id" });
        ensureStore(db, "habitEntries", { keyPath: "id" });
        // Google Calendar read-only sync cache — see ARCHITECTURE.md §7
        // ("Google Calendar integration"). v3: now caches every calendar on
        // the account, not just the primary one, so events are keyed by
        // `${calendarId}:${eventId}` (an event id is only unique within its
        // own calendar) and meta is one row per calendar (keyed by
        // calendarId) rather than a single fixed row. Recreated rather than
        // migrated in place — this is a rebuildable read-only cache, not
        // user data.
        if (db.objectStoreNames.contains("gcalEvents")) db.deleteObjectStore("gcalEvents");
        if (db.objectStoreNames.contains("gcalMeta")) db.deleteObjectStore("gcalMeta");
        db.createObjectStore("gcalEvents", { keyPath: "key" });
        db.createObjectStore("gcalMeta", { keyPath: "calendarId" });
        // v7: per-calendar display prefs (color, hidden) — one row per
        // calendar, keyed by calendarId like gcalMeta. Kept in sync with the
        // account's calendar list by googleCalendarSync.js; unlike gcalMeta
        // this is a user choice, not a rebuildable cache, so it's a plain
        // ensureStore rather than recreated on every version bump.
        ensureStore(db, "calendarSettings", { keyPath: "calendarId" });
        // Day Planner app — see ARCHITECTURE.md §7 ("Day Planner"). A
        // DayShape is a named set of blocks (commute, work, routines);
        // `dayoverrides` holds at most one row per date, only when that
        // date needs something different from its weekday default (a
        // different DayShape, a one-off wake time, and/or ad hoc extra
        // blocks just for that date).
        ensureStore(db, "dayshapes", { keyPath: "id" });
        ensureStore(db, "dayoverrides", { keyPath: "date" });
        // v6: habits/tasks are no longer auto-included in a day's plan —
        // `dayplans` holds the explicit opt-in list per date (habitIds,
        // taskIds), decoupled from Task.startDate/dueDate so planning a
        // task for a day never mutates the task itself.
        ensureStore(db, "dayplans", { keyPath: "date" });
        // Shortlist app — see ARCHITECTURE.md §7 ("Shortlist"). A single row
        // (fixed id) holding three ordered arrays of compound item ids
        // ("task:<id>" / "habit:<id>"), one per bucket — same
        // ordered-array-per-list shape as `dayplans`' habitIds/taskIds, so
        // manual reorder within a bucket is just an array position. It's a
        // pure overlay: no task/habit data is duplicated here, only which
        // bucket each item is in and its rank within that bucket.
        ensureStore(db, "shortlist", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}
