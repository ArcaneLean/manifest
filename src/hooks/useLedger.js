import { useCallback, useEffect, useState } from "react";
import { loadLedger, putLedgerRow, deleteLedgerRow, replaceLedger } from "../lib/ledgerRepo.js";
import { balanceKey, actualKey } from "../lib/ledger/summary.js";

const EMPTY = { finAccounts: [], finBalances: [], finLines: [], finActuals: [], finMonths: [], finDebts: [] };
const KEY = { finAccounts: "id", finBalances: "key", finLines: "id", finActuals: "key", finMonths: "month", finDebts: "id" };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// All Ledger data, loaded once by LedgerApp and passed down (like Hours) —
// see ARCHITECTURE.md §7 ("Ledger"). Writes are optimistic: state updates
// first, IndexedDB follows.
export function useLedger() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => loadLedger().then((loaded) => {
    setData(loaded);
    setLoading(false);
  }), []);

  useEffect(() => {
    reload();
  }, [reload]);

  const put = (store, row) => {
    const key = KEY[store];
    setData((d) => ({ ...d, [store]: [...d[store].filter((r) => r[key] !== row[key]), row] }));
    putLedgerRow(store, row);
    return row;
  };
  const remove = (store, keyValue) => {
    const key = KEY[store];
    setData((d) => ({ ...d, [store]: d[store].filter((r) => r[key] !== keyValue) }));
    deleteLedgerRow(store, keyValue);
  };
  const nextOrder = (rows) => rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0) + 1;

  const saveAccount = (account) =>
    put("finAccounts", account.id ? account : { ...account, id: crypto.randomUUID(), order: nextOrder(data.finAccounts), createdAt: Date.now() });
  const deleteAccount = (id) => {
    for (const b of data.finBalances) if (b.accountId === id) remove("finBalances", b.key);
    remove("finAccounts", id);
  };
  // `amount` null clears that month's snapshot for the account.
  const setBalance = (month, accountId, amount) => {
    const key = balanceKey(month, accountId);
    if (amount == null) remove("finBalances", key);
    else put("finBalances", { key, month, accountId, amount, checkedOn: todayISO() });
  };

  const saveLine = (line) =>
    put("finLines", line.id ? line : { rules: [], overrides: {}, ...line, id: crypto.randomUUID(), order: nextOrder(data.finLines), createdAt: Date.now() });
  const deleteLine = (id) => {
    for (const a of data.finActuals) if (a.lineId === id) remove("finActuals", a.key);
    remove("finLines", id);
  };
  const setActual = (month, lineId, amount) => {
    const key = actualKey(month, lineId);
    if (amount == null) remove("finActuals", key);
    else put("finActuals", { key, month, lineId, amount });
  };

  const updateMonth = (month, patch) => {
    const prev = data.finMonths.find((m) => m.month === month) || { month, bankNet: null, closedAt: null };
    return put("finMonths", { ...prev, ...patch });
  };

  const saveDebt = (debt) => put("finDebts", debt.id ? debt : { checks: [], payments: {}, ...debt, id: crypto.randomUUID(), createdAt: Date.now() });
  const deleteDebt = (id) => remove("finDebts", id);
  const setDebtPayment = (debt, month, amount) => {
    const payments = { ...(debt.payments || {}) };
    if (amount == null) delete payments[month];
    else payments[month] = amount;
    return put("finDebts", { ...debt, payments });
  };

  const importLedger = async (stores) => {
    await replaceLedger(stores);
    await reload();
  };

  return {
    loading,
    accounts: data.finAccounts,
    balances: data.finBalances,
    lines: data.finLines,
    actuals: data.finActuals,
    months: data.finMonths,
    debts: data.finDebts,
    raw: data,
    todayISO: todayISO(),
    saveAccount,
    deleteAccount,
    setBalance,
    saveLine,
    deleteLine,
    setActual,
    updateMonth,
    saveDebt,
    deleteDebt,
    setDebtPayment,
    importLedger,
  };
}
