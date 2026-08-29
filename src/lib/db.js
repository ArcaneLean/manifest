import { openDB } from "idb";

// Single shared IndexedDB module — see ARCHITECTURE.md §4/§7 ("Shared schema").
// Object stores for every entity in the data model are created up front so
// later views (Tags, Templates, Countdowns, Hours) don't require a version
// bump / migration just to add a store.
const DB_NAME = "manifest";
const DB_VERSION = 4;

let dbPromise = null;

// createObjectStore throws if the store already exists, and the whole
// upgrade() callback re-runs (from oldVersion, not from scratch) on every
// version bump — so each store creation must be guarded rather than
// assumed fresh, once there's more than one DB_VERSION in the wild.
function ensureStore(db, name, options) {
  if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options);
}

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        ensureStore(db, "tasks", { keyPath: "id" });
        ensureStore(db, "tags", { keyPath: "id" });
        ensureStore(db, "templates", { keyPath: "id" });
        ensureStore(db, "countdowns", { keyPath: "id" });
        ensureStore(db, "worklog", { keyPath: "date" });
        ensureStore(db, "weektargets", { keyPath: "weekStartISO" });
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
      },
    });
  }
  return dbPromise;
}
