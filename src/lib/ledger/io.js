// Ledger-only export/import file — see ARCHITECTURE.md §7 ("Ledger"). Unlike
// the whole-app backup restore, this touches only the Ledger stores, so it
// can bring in history (e.g. converted from the old spreadsheet) without
// replacing anything else on the device.
export const LEDGER_STORES = ["finAccounts", "finBalances", "finLines", "finActuals", "finMonths", "finDebts"];
export const LEDGER_FILE_KIND = "manifest-ledger";
export const LEDGER_FILE_VERSION = 1;

export function buildLedgerFile(stores, now = Date.now()) {
  return {
    kind: LEDGER_FILE_KIND,
    version: LEDGER_FILE_VERSION,
    exportedAt: now,
    stores: Object.fromEntries(LEDGER_STORES.map((name) => [name, stores[name] || []])),
  };
}

const KEY_FIELDS = { finAccounts: "id", finBalances: "key", finLines: "id", finActuals: "key", finMonths: "month", finDebts: "id" };

// Throws a user-readable Error when `file` isn't a Ledger file this version
// can read; returns its stores, every Ledger store present (missing → []).
export function parseLedgerFile(file) {
  if (!file || typeof file !== "object" || file.kind !== LEDGER_FILE_KIND) throw new Error("not a ledger file");
  if (typeof file.version !== "number" || file.version > LEDGER_FILE_VERSION) throw new Error("ledger file is from a newer version of the app");
  const stores = {};
  for (const name of LEDGER_STORES) {
    const rows = file.stores?.[name] ?? [];
    if (!Array.isArray(rows)) throw new Error(`${name} is not a list`);
    for (const row of rows) if (!row || typeof row !== "object" || row[KEY_FIELDS[name]] == null) throw new Error(`${name} has a row without ${KEY_FIELDS[name]}`);
    stores[name] = rows;
  }
  return stores;
}
