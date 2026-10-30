// Add/edit an account — see ARCHITECTURE.md §7 ("Ledger").
import { useState } from "react";
import { COLORS } from "../../theme/colors.js";
import { Segmented } from "../../components/Segmented.jsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { monthLabel } from "../../lib/ledger/month.js";
import { BracketCheck, primaryBtnStyle, secondaryBtnStyle, linkStyle } from "../hours/ui.jsx";
import { Sheet, Field, fieldStyle } from "../work/ui.jsx";
import { Money, FigureRow } from "./ui.jsx";

export const ACCOUNT_TYPES = [
  { key: "checking", label: "checking" },
  { key: "savings", label: "savings" },
  { key: "other", label: "other" },
];

export function AccountSheet({ account, store, onClose }) {
  const { accounts, balances, saveAccount, deleteAccount } = store;
  const [name, setName] = useState(account.name || "");
  const [type, setType] = useState(account.type || "savings");
  const [available, setAvailable] = useState(account.available ?? true);
  const [earmark, setEarmark] = useState(account.earmark || "");
  const [archived, setArchived] = useState(!!account.archived);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const earmarks = [...new Set(accounts.map((a) => a.earmark).filter(Boolean))];
  const history = balances.filter((b) => b.accountId === account.id).sort((a, b) => (a.month < b.month ? 1 : -1));

  const save = () => {
    if (!name.trim()) return;
    const { isNew, ...rest } = account;
    saveAccount({ ...rest, name: name.trim(), type, available, earmark: earmark.trim() || null, archived });
    onClose();
  };

  return (
    <Sheet title={account.isNew ? "new account" : "edit account"} onClose={onClose}>
      <Field label="name">
        <input autoFocus={account.isNew} value={name} onChange={(e) => setName(e.target.value)} placeholder="ASN Betaal" style={fieldStyle} />
      </Field>
      <Field label="type">
        <Segmented value={type} onChange={setType} options={ACCOUNT_TYPES} />
      </Field>
      <Field label="earmarked for">
        <input value={earmark} onChange={(e) => setEarmark(e.target.value)} placeholder="(none)" list="ledger-earmarks" style={fieldStyle} />
        <datalist id="ledger-earmarks">
          {earmarks.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </Field>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
        <BracketCheck checked={available} onChange={setAvailable} label="available (counts toward spendable money)" />
        {!account.isNew && <BracketCheck checked={archived} onChange={setArchived} label="archived (closed account)" />}
      </div>
      {history.length > 0 && (
        <Field label="balance history">
          {history.slice(0, 12).map((b) => (
            <FigureRow key={b.key} label={monthLabel(b.month)} sub={b.checkedOn ? `checked ${b.checkedOn}` : null} right={<Money cents={b.amount} />} />
          ))}
        </Field>
      )}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "8px" }}>
        {!account.isNew && (
          <span onClick={() => setConfirmDelete(true)} style={{ ...linkStyle, color: COLORS.danger }}>
            delete
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={onClose} style={secondaryBtnStyle}>
          cancel
        </button>
        <button onClick={save} disabled={!name.trim()} style={{ ...primaryBtnStyle, opacity: name.trim() ? 1 : 0.5 }}>
          save
        </button>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title={`delete ${account.name}?`}
          message={`This also deletes its ${history.length} balance snapshot(s). To keep the history of a closed account, archive it instead.`}
          confirmLabel="delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteAccount(account.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
