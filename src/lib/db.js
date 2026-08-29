import { openDB } from "idb";

// Single shared IndexedDB module — see ARCHITECTURE.md §4/§7 ("Shared schema").
// Object stores for every entity in the data model are created up front so
// later views (Tags, Templates, Countdowns, Hours) don't require a version
// bump / migration just to add a store.
const DB_NAME = "manifest";
const DB_VERSION = 2;

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
        // Google Calendar read-only sync cache — see ARCHITECTURE.md §7
        // ("Google Calendar integration").
        ensureStore(db, "gcalEvents", { keyPath: "id" });
        ensureStore(db, "gcalMeta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}
