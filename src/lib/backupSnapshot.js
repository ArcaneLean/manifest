import { getDB } from "./db.js";

// Snapshot format version — bump if the shape below ever changes, so a
// future restore path can tell old blobs apart from new ones.
const SNAPSHOT_VERSION = 1;

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
