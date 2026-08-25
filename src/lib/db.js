import { openDB } from "idb";

// Single shared IndexedDB module — see ARCHITECTURE.md §4/§7 ("Shared schema").
// Object stores for every entity in the data model are created up front so
// later views (Tags, Templates, Countdowns, Hours) don't require a version
// bump / migration just to add a store.
const DB_NAME = "manifest";
const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("tasks", { keyPath: "id" });
        db.createObjectStore("tags", { keyPath: "id" });
        db.createObjectStore("templates", { keyPath: "id" });
        db.createObjectStore("countdowns", { keyPath: "id" });
        db.createObjectStore("worklog", { keyPath: "date" });
        db.createObjectStore("weektargets", { keyPath: "weekStartISO" });
      },
    });
  }
  return dbPromise;
}
