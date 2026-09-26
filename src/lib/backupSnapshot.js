import { getDB } from "./db.js";
import { migrateHoursRecords } from "./hours2/migrate.js";

// Snapshot format version — bump if the shape below ever changes, so the
// restore path can tell old blobs apart from new ones. v2: Hours 2.0 (DB v12)
// — worklog segments carry `codeId` instead of `projectId`, plus the
// `bookingcodes` store; see upgradeSnapshot.
export const SNAPSHOT_VERSION = 2;

// Rebuildable caches (Calendar sync cache, weather forecasts) — included in
// a snapshot since it just dumps every store, but never restored: they
// refill themselves from their source on the next sync/fetch, and restoring
// gcalMeta's sync tokens onto a device whose gcalEvents didn't come from
// them would only confuse incremental sync.
const REBUILDABLE_STORES = new Set(["gcalEvents", "gcalMeta", "weatherCache"]);

// Dumps every IndexedDB store into one plain object, keyed by store name.
// Reads `db.objectStoreNames` rather than a hardcoded list so a newly added
// store is included automatically, with no separate list to keep in sync.
export async function buildBackupSnapshot() {
  const db = await getDB();
  const storeNames = Array.from(db.objectStoreNames);
  const tx = db.transaction(storeNames, "readonly");
  const stores = {};
  await Promise.all(
    storeNames.map(async (name) => {
      stores[name] = await tx.objectStore(name).getAll();
    })
  );
  await tx.done;
  return { version: SNAPSHOT_VERSION, exportedAt: Date.now(), stores };
}

// Throws with a user-readable message if `snapshot` isn't something
// buildBackupSnapshot could have produced — guards the file-import path in
// particular, where any JSON file can be picked.
export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.stores || typeof snapshot.stores !== "object") {
    throw new Error("not a manifest backup");
  }
  if (typeof snapshot.version !== "number" || snapshot.version > SNAPSHOT_VERSION) {
    throw new Error(`unsupported backup version ${snapshot.version} — update the app first`);
  }
}

// Brings an older snapshot's records up to the current schema before it's
// restored — the DB's own upgrade() migrations only ever run on data already
// in IndexedDB, so a v1 backup restored as-is would put `projectId`
// segments into a v12 database. Pure; returns a new snapshot.
export function upgradeSnapshot(snapshot) {
  if (snapshot.version >= 2 || !Array.isArray(snapshot.stores.worklog)) return snapshot;
  const { worklog, bookingcodes } = migrateHoursRecords({
    worklog: snapshot.stores.worklog,
    projects: snapshot.stores.projects || [],
    bookingcodes: snapshot.stores.bookingcodes || [],
  });
  return { ...snapshot, version: 2, stores: { ...snapshot.stores, worklog, bookingcodes } };
}

// Stores a restore would actually replace: present in both the snapshot and
// this device's current schema, and not a rebuildable cache.
async function restorableStoreNames(snapshot) {
  const db = await getDB();
  return Array.from(db.objectStoreNames).filter(
    (name) => !REBUILDABLE_STORES.has(name) && Array.isArray(snapshot.stores[name])
  );
}

// Per-store record counts, shown before restoring so the user can sanity
// check they picked the right backup.
export async function summarizeSnapshot(snapshot) {
  validateSnapshot(snapshot);
  snapshot = upgradeSnapshot(snapshot);
  const names = await restorableStoreNames(snapshot);
  return names.map((name) => ({ store: name, count: snapshot.stores[name].length }));
}

// Replaces local data with the snapshot's — see ARCHITECTURE.md §7 ("Drive
// backup"). Each restorable store is cleared and refilled inside a single
// readwrite transaction, so a bad record (e.g. missing its key) aborts the
// whole restore and leaves the existing data untouched rather than
// half-replaced. Stores the snapshot doesn't have (a backup from before a
// store existed) are left as they are. Callers reload the page afterwards,
// since every hook holds its own in-memory copy of what it loaded.
export async function restoreBackupSnapshot(snapshot) {
  validateSnapshot(snapshot);
  snapshot = upgradeSnapshot(snapshot);
  const names = await restorableStoreNames(snapshot);
  if (names.length === 0) throw new Error("backup contains no restorable data");
  const db = await getDB();
  const tx = db.transaction(names, "readwrite");
  // Requests on one store run in the order issued, so each clear() lands
  // before that store's puts even though they're all awaited together.
  const requests = [];
  try {
    for (const name of names) {
      const store = tx.objectStore(name);
      requests.push(store.clear());
      for (const record of snapshot.stores[name]) requests.push(store.put(record));
    }
  } catch (err) {
    // put() throws synchronously for a record missing its key, which does
    // NOT abort the transaction on its own — without this, the clears and
    // puts already issued would commit.
    requests.forEach((p) => p.catch(() => {}));
    tx.done.catch(() => {});
    tx.abort();
    throw err;
  }
  // A request failing asynchronously aborts the transaction by itself.
  await Promise.all([...requests, tx.done]);
  return names;
}
