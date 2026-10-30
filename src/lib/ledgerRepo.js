import { getDB } from "./db.js";
import { LEDGER_STORES } from "./ledger/io.js";

// Ledger's IndexedDB access — see ARCHITECTURE.md §7 ("Ledger"). Every
// Ledger store is loaded whole (they stay small: a few dozen lines and
// accounts, one row per line/account per month).
export async function loadLedger() {
  const db = await getDB();
  const tx = db.transaction(LEDGER_STORES, "readonly");
  const out = {};
  await Promise.all(LEDGER_STORES.map(async (name) => (out[name] = await tx.objectStore(name).getAll())));
  await tx.done;
  return out;
}

export async function putLedgerRow(store, row) {
  const db = await getDB();
  await db.put(store, row);
  return row;
}

export async function deleteLedgerRow(store, key) {
  const db = await getDB();
  await db.delete(store, key);
}

// Replaces every Ledger store (and nothing else) in one transaction — the
// Ledger file import. A failure aborts it, leaving the old data in place.
export async function replaceLedger(stores) {
  const db = await getDB();
  const tx = db.transaction(LEDGER_STORES, "readwrite");
  for (const name of LEDGER_STORES) {
    const store = tx.objectStore(name);
    await store.clear();
    for (const row of stores[name] || []) await store.put(row);
  }
  await tx.done;
}
