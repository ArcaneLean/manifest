import { openDB, deleteDB } from "idb";
import { getDB } from "./db.js";
import { MAIN_DB_NAME } from "./channel.js";
import { restoreBackupSnapshot, SNAPSHOT_VERSION } from "./backupSnapshot.js";

// PR previews start with an empty database of their own (see channel.js) —
// these pull the real app's data in as a starting point, or throw the
// preview's away. Data only ever flows main → preview, never back.

// Reads every store of another database on this origin into the same shape
// buildBackupSnapshot produces. Opened without a version, so it never
// upgrades (or downgrades into an error) whatever schema that database is
// at, and closed straight away so it can't block main's own next upgrade.
async function readDatabaseAsSnapshot(name) {
  const existing = await indexedDB.databases?.();
  if (existing && !existing.some((d) => d.name === name)) throw new Error("no data from the main app on this device");
  const source = await openDB(name, undefined, { blocking: () => source.close() });
  try {
    const storeNames = Array.from(source.objectStoreNames);
    if (storeNames.length === 0) throw new Error("no data from the main app on this device");
    const tx = source.transaction(storeNames, "readonly");
    const stores = {};
    await Promise.all(
      storeNames.map(async (s) => {
        stores[s] = await tx.objectStore(s).getAll();
      })
    );
    await tx.done;
    return { version: SNAPSHOT_VERSION, exportedAt: Date.now(), stores };
  } finally {
    source.close();
  }
}

// Replaces this build's data with a copy of `fromName`'s — same
// clear-and-refill, all-or-nothing path as restoring a backup, so stores the
// preview's schema doesn't have are skipped and rebuildable caches aren't
// copied. Callers reload afterwards.
export async function copyDataFrom(fromName = MAIN_DB_NAME) {
  return restoreBackupSnapshot(await readDatabaseAsSnapshot(fromName));
}

// Deletes this build's database entirely; it's recreated empty (at this
// build's schema) on the next getDB() after the reload callers do.
export async function deleteOwnData() {
  const db = await getDB();
  const name = db.name;
  db.close();
  await deleteDB(name);
}
