// Add/edit a debt's terms — see ARCHITECTURE.md §7 ("Ledger") for what each
// kind means.
import { useState } from "react";
import { COLORS } from "../../theme/colors.js";
import { Segmented } from "../../components/Segmented.jsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { isMonth } from "../../lib/ledger/month.js";
import { BracketCheck, primaryBtnStyle, secondaryBtnStyle, linkStyle } from "../hours/ui.jsx";
import { Sheet, Field, fieldStyle } from "../work/ui.jsx";
import { AmountInput, lineLabel, sortLines, monthInputStyle, smallDim } from "./ui.jsx";

const KINDS = [
  { key: "duo", label: "DUO" },
  { key: "annuity", label: "annuity" },
  { key: "fixed", label: "fixed" },
];
const KIND_HELP = {
  duo: "Interest compounds monthly. From the first payment month: the statutory annuity over the term, capped at 4% of income above the exempt amount. Left over at the end is forgiven.",
  annuity: "Recalculated every month over the months left, so paying extra lowers later payments.",
  fixed: "The same amount every month until it's paid off.",
};

function parseRate(text) {
  const n = parseFloat(String(text).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n / 100 : null;
}

export function DebtSheet({ debt, store, onClose, onDeleted }) {
  const { lines, saveDebt, deleteDebt, currentMonth } = store;
  const [name, setName] = useState(debt.name || "");
  const [kind, setKind] = useState(debt.kind || "annuity");
  const [rateText, setRateText] = useState(debt.rate != null ? String(+(debt.rate * 100).toFixed(4)).replace(".", ",") : "");
  const [rateValidUntil, setRateValidUntil] = useState(debt.rateValidUntil || "");
  const [firstPaymentMonth, setFirst] = useState(debt.firstPaymentMonth || currentMonth);
  const [lastPaymentMonth, setLast] = useState(debt.lastPaymentMonth || "");
  const [graceInterest, setGraceInterest] = useState(debt.graceInterest || "compound");
  const [assessmentIncome, setAssessment] = useState(debt.assessmentIncome ?? null);
  const [exemptIncome, setExempt] = useState(debt.exemptIncome ?? null);
  const [fixedPayment, setFixedPayment] = useState(debt.fixedPayment ?? null);
  const [lineId, setLineId] = useState(debt.lineId || "");
  const [notes, setNotes] = useState(debt.notes || "");
  const [archived, setArchived] = useState(!!debt.archived);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [startBalance, setStartBalance] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rate = parseRate(rateText);
  const valid = name.trim() && rate !== null && isMonth(firstPaymentMonth) && (!debt.isNew || (isMonth(startMonth) && startBalance != null));

  const save = () => {
    if (!valid) return;
    const { isNew, ...rest } = debt;
    saveDebt({
      ...rest,
      name: name.trim(),
      kind,
      rate,
      rateValidUntil: rateValidUntil || null,
      firstPaymentMonth,
      lastPaymentMonth: isMonth(lastPaymentMonth) ? lastPaymentMonth : null,
      graceInterest,
      assessmentIncome: kind === "duo" ? assessmentIncome : null,
      exemptIncome: kind === "duo" ? exemptIncome : null,
      fixedPayment: kind === "fixed" ? fixedPayment : null,
      lineId: lineId || null,
      notes: notes.trim() || null,
      archived,
      ...(isNew ? { checks: [{ month: startMonth, balance: startBalance, checkedOn: store.todayISO }], payments: {} } : {}),
    });
    onClose();
  };

  return (
    <Sheet title={debt.isNew ? "new debt" : "edit debt"} onClose={onClose}>
      <Field label="name">
        <input autoFocus={debt.isNew} value={name} onChange={(e) => setName(e.target.value)} placeholder="DUO Aron" style={fieldStyle} />
      </Field>
      <Field label="kind">
        <Segmented value={kind} onChange={setKind} options={KINDS} />
        <div style={{ ...smallDim, marginTop: "6px", lineHeight: 1.5 }}>{KIND_HELP[kind]}</div>
      </Field>
      {debt.isNew && (
        <Field label="balance at the start of">
          <div style={{ display: "flex", gap: "8px" }}>
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={monthInputStyle} />
            <AmountInput value={startBalance} onCommit={setStartBalance} placeholder="0,00" />
          </div>
        </Field>
      )}
      <div style={{ display: "flex", gap: "10px" }}>
        <Field label="interest % / year" style={{ flex: 1 }}>
          <input value={rateText} onChange={(e) => setRateText(e.target.value)} inputMode="decimal" placeholder="0,46" style={{ ...fieldStyle, borderColor: rateText && rate === null ? COLORS.amber : COLORS.border }} />
        </Field>
        <Field label="rate valid until" style={{ flex: 1 }}>
          <input type="date" value={rateValidUntil} onChange={(e) => setRateValidUntil(e.target.value)} style={fieldStyle} />
        </Field>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <Field label="first payment month" style={{ flex: 1 }}>
          <input type="month" value={firstPaymentMonth} onChange={(e) => setFirst(e.target.value)} style={{ ...monthInputStyle, width: "100%" }} />
        </Field>
        <Field label="last payment month" style={{ flex: 1 }}>
          <input type="month" value={lastPaymentMonth} onChange={(e) => setLast(e.target.value)} style={{ ...monthInputStyle, width: "100%" }} />
        </Field>
      </div>
      <Field label="interest before the first payment">
        <Segmented
          value={graceInterest}
          onChange={setGraceInterest}
          options={[
            { key: "compound", label: "added monthly" },
            { key: "simple", label: "added at first payment" },
          ]}
        />
      </Field>
      {kind === "duo" && (
        <>
          <Field label="assessment income / year (toetsingsinkomen)">
            <AmountInput value={assessmentIncome} onCommit={setAssessment} placeholder="unknown" style={{ width: "100%" }} />
          </Field>
          <Field label="exempt income / year (draagkrachtvrije voet)">
            <AmountInput value={exemptIncome} onCommit={setExempt} placeholder="unknown" style={{ width: "100%" }} />
          </Field>
        </>
      )}
      {kind === "fixed" && (
        <Field label="monthly payment">
          <AmountInput value={fixedPayment} onCommit={setFixedPayment} placeholder="0,00" style={{ width: "100%" }} />
        </Field>
      )}
      <Field label="booked on bank category">
        <select value={lineId} onChange={(e) => setLineId(e.target.value)} style={{ ...fieldStyle, background: COLORS.panel }}>
          <option value="">(none — counted as its own expense)</option>
          {sortLines(lines.filter((l) => l.kind !== "income" && !l.archived)).map((l) => (
            <option key={l.id} value={l.id}>
              {lineLabel(l)}
            </option>
          ))}
        </select>
        <div style={{ ...smallDim, marginTop: "6px", lineHeight: 1.5 }}>When the bank books the payments on a category, link it so the plan doesn't count them twice.</div>
      </Field>
      <Field label="notes">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={fieldStyle} />
      </Field>
      {!debt.isNew && (
        <div style={{ marginBottom: "16px" }}>
          <BracketCheck checked={archived} onChange={setArchived} label="archived (paid off / no longer tracked)" />
        </div>
      )}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {!debt.isNew && (
          <span onClick={() => setConfirmDelete(true)} style={{ ...linkStyle, color: COLORS.danger }}>
            delete
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={onClose} style={secondaryBtnStyle}>
          cancel
        </button>
        <button onClick={save} style={{ ...primaryBtnStyle, opacity: valid ? 1 : 0.5 }}>
          save
        </button>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title={`delete ${debt.name}?`}
          message="Deletes the debt with its balance checks and recorded payments."
          confirmLabel="delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteDebt(debt.id);
            onClose();
            onDeleted?.();
          }}
        />
      )}
    </Sheet>
  );
}
