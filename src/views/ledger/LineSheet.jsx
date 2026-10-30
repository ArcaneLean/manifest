// Edit an income/expense line: its bank category, status and the rules that
// make up its expected amount — see ARCHITECTURE.md §7 ("Ledger").
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { Segmented } from "../../components/Segmented.jsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { LINE_STATUSES, RULE_EVERY } from "../../lib/ledger/plan.js";
import { monthLabel, isMonth, addMonths } from "../../lib/ledger/month.js";
import { BracketCheck, primaryBtnStyle, secondaryBtnStyle, linkStyle } from "../hours/ui.jsx";
import { Sheet, Field, fieldStyle } from "../work/ui.jsx";
import { Money, AmountInput, FigureRow, monthInputStyle, smallDim } from "./ui.jsx";

const EVERY_LABEL = { 1: "monthly", 2: "every 2 mo", 3: "quarterly", 4: "every 4 mo", 6: "half-yearly", 12: "yearly" };
const selectStyle = { ...fieldStyle, width: "auto", padding: "6px 8px", background: COLORS.panel };

function RuleEditor({ rule, sign, onChange, onRemove }) {
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "10px", marginBottom: "8px" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
        <AmountInput value={rule.amount} defaultSign={sign} onCommit={(v) => onChange({ ...rule, amount: v ?? 0 })} />
        <select value={rule.every} onChange={(e) => onChange({ ...rule, every: Number(e.target.value) })} style={selectStyle}>
          {RULE_EVERY.map((n) => (
            <option key={n} value={n}>
              {EVERY_LABEL[n]}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <span onClick={onRemove} style={{ cursor: "pointer" }} aria-label="remove rule">
          <X size={14} color={COLORS.dim} />
        </span>
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={smallDim}>from</span>
        <input type="month" value={rule.from || ""} onChange={(e) => onChange({ ...rule, from: e.target.value })} style={monthInputStyle} />
        <span style={smallDim}>until</span>
        <input type="month" value={rule.until || ""} onChange={(e) => onChange({ ...rule, until: e.target.value || null })} style={monthInputStyle} />
      </div>
    </div>
  );
}

export function LineSheet({ line, store, onClose }) {
  const { lines, actuals, debts, saveLine, deleteLine, currentMonth } = store;
  const [category, setCategory] = useState(line.category || "");
  const [source, setSource] = useState(line.source || "");
  const [kind, setKind] = useState(line.kind || "expense");
  const [nature, setNature] = useState(line.nature || "variable");
  const [status, setStatus] = useState(line.status || "estimate");
  const [rules, setRules] = useState(line.rules || []);
  const [overrides, setOverrides] = useState(line.overrides || {});
  const [note, setNote] = useState(line.note || "");
  const [archived, setArchived] = useState(!!line.archived);
  const [ovMonth, setOvMonth] = useState(currentMonth);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sign = kind === "income" ? 1 : -1;
  const categories = [...new Set(lines.map((l) => l.category))].sort();
  const history = actuals.filter((a) => a.lineId === line.id).sort((a, b) => (a.month < b.month ? 1 : -1));
  const linkedDebts = debts.filter((d) => d.lineId && d.lineId === line.id);
  const recent = history.slice(0, 12);
  const avg = recent.length ? Math.round(recent.reduce((s, a) => s + a.amount, 0) / recent.length) : null;

  const save = () => {
    if (!category.trim()) return;
    const { isNew, ...rest } = line;
    saveLine({
      ...rest,
      category: category.trim(),
      source: source.trim() || null,
      kind,
      nature,
      status,
      rules: rules.filter((r) => isMonth(r.from)),
      overrides,
      note: note.trim() || null,
      archived,
    });
    onClose();
  };

  const addRule = () => setRules((r) => [...r, { id: crypto.randomUUID(), amount: avg ?? 0, every: 1, from: addMonths(currentMonth, 1), until: null }]);
  const setOverride = (month, v) =>
    setOverrides((o) => {
      const next = { ...o };
      if (v == null) delete next[month];
      else next[month] = v;
      return next;
    });

  return (
    <Sheet title={line.isNew ? "new line" : "edit line"} onClose={onClose}>
      <Field label="bank category">
        <input autoFocus={line.isNew} value={category} onChange={(e) => setCategory(e.target.value)} list="ledger-line-categories" style={fieldStyle} />
        <datalist id="ledger-line-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="source (optional)">
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="split a category, e.g. Camper ver." style={fieldStyle} />
      </Field>
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
        <Segmented value={kind} onChange={setKind} options={[{ key: "expense", label: "expense" }, { key: "income", label: "income" }]} />
        <Segmented value={nature} onChange={setNature} options={[{ key: "fixed", label: "fixed" }, { key: "variable", label: "variable" }]} />
      </div>
      <Field label="expected status">
        <Segmented value={status} onChange={setStatus} options={LINE_STATUSES.map((s) => ({ key: s, label: s }))} />
      </Field>

      <Field label="expected amount · rules add up">
        {linkedDebts.length > 0 && (
          <div style={{ ...smallDim, marginBottom: "8px", lineHeight: 1.5 }}>
            Expected comes from {linkedDebts.map((d) => d.name).join(", ")}'s payment schedule — rules are ignored.
          </div>
        )}
        {rules.map((rule, i) => (
          <RuleEditor
            key={rule.id || i}
            rule={rule}
            sign={sign}
            onChange={(r) => setRules((all) => all.map((x, j) => (j === i ? r : x)))}
            onRemove={() => setRules((all) => all.filter((_, j) => j !== i))}
          />
        ))}
        <span onClick={addRule} style={{ ...linkStyle, display: "inline-flex", alignItems: "center", gap: "3px" }}>
          <Plus size={11} /> rule
        </span>
      </Field>

      <Field label="one-off months · replace the rules for that month">
        {Object.keys(overrides)
          .sort()
          .map((m) => (
            <FigureRow
              key={m}
              label={monthLabel(m)}
              right={
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <AmountInput value={overrides[m]} defaultSign={sign} onCommit={(v) => setOverride(m, v ?? 0)} />
                  <span onClick={() => setOverride(m, null)} style={{ cursor: "pointer" }} aria-label="remove">
                    <X size={14} color={COLORS.dim} />
                  </span>
                </span>
              }
            />
          ))}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
          <input type="month" value={ovMonth} onChange={(e) => setOvMonth(e.target.value)} style={monthInputStyle} />
          <span onClick={() => isMonth(ovMonth) && overrides[ovMonth] == null && setOverride(ovMonth, 0)} style={linkStyle}>
            + month
          </span>
        </div>
      </Field>

      <Field label="note">
        <input value={note} onChange={(e) => setNote(e.target.value)} style={fieldStyle} />
      </Field>

      {recent.length > 0 && (
        <Field label={`actuals · avg ${recent.length} mo`}>
          <FigureRow label="average" right={<Money cents={avg} />} style={{ borderBottom: `1px solid ${COLORS.border}` }} />
          {recent.map((a) => (
            <FigureRow key={a.key} label={monthLabel(a.month)} right={<Money cents={a.amount} dim />} />
          ))}
        </Field>
      )}

      {!line.isNew && (
        <div style={{ marginBottom: "16px" }}>
          <BracketCheck checked={archived} onChange={setArchived} label="archived (hidden from new months)" />
        </div>
      )}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {!line.isNew && (
          <span onClick={() => setConfirmDelete(true)} style={{ ...linkStyle, color: COLORS.danger }}>
            delete
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={onClose} style={secondaryBtnStyle}>
          cancel
        </button>
        <button onClick={save} style={{ ...primaryBtnStyle, opacity: category.trim() ? 1 : 0.5 }}>
          save
        </button>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="delete line?"
          message={`This also deletes its ${history.length} recorded month(s). To keep the history, archive it instead.`}
          confirmLabel="delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteLine(line.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
