// Building blocks for the Ledger views — see ARCHITECTURE.md §7 ("Ledger").
// Page/Header/Section etc. come from Hours' UI kit and Sheet/Field from
// Work's, so Ledger looks like the rest of the app (§3).
import { createContext, useContext, useEffect, useState } from "react";
import { CircleCheck, CircleDashed } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { formatCents, parseAmount, centsToInput } from "../../lib/ledger/money.js";
import { MONO, timeInputStyle } from "../hours/ui.jsx";

// "hide amounts" — for when someone's looking over your shoulder.
export const HiddenContext = createContext(false);

export function centsColor(cents) {
  if (!cents) return COLORS.text;
  return cents > 0 ? COLORS.sage : COLORS.amber;
}

export function Money({ cents, signed, color, dim, style }) {
  const hidden = useContext(HiddenContext);
  const text = cents == null ? "—" : hidden ? "€ •••" : formatCents(cents, { signed });
  return (
    <span style={{ whiteSpace: "nowrap", color: dim ? COLORS.dim : color === true ? centsColor(cents) : color || undefined, ...style }}>
      {text}
    </span>
  );
}

export const amountInputStyle = { ...timeInputStyle, width: "108px", textAlign: "right", boxSizing: "border-box" };

// Amount field that commits on blur/Enter: parsed cents, or null when
// cleared. Unsigned input gets `defaultSign` (−1 on expense lines). Invalid
// text is kept and outlined instead of being committed.
export function AmountInput({ value, onCommit, defaultSign = 1, placeholder, style }) {
  const hidden = useContext(HiddenContext);
  const [text, setText] = useState(centsToInput(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(centsToInput(value));
  }, [value, focused]);
  const parsed = text.trim() === "" ? null : parseAmount(text, defaultSign);
  const invalid = text.trim() !== "" && parsed === null;
  const commit = () => {
    setFocused(false);
    if (invalid || parsed === value) return;
    onCommit(parsed);
  };
  return (
    <input
      value={hidden && !focused && text ? "•••" : text}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder={placeholder}
      inputMode="decimal"
      style={{ ...amountInputStyle, borderColor: invalid ? COLORS.amber : COLORS.border, ...style }}
    />
  );
}

export function lineLabel(line) {
  if (!line) return "?";
  return line.source ? `${line.category} · ${line.source}` : line.category;
}

// Income first, then expenses; within each, by category then source.
export function sortLines(lines) {
  const kindRank = (l) => (l.kind === "income" ? 0 : 1);
  return [...lines].sort(
    (a, b) => kindRank(a) - kindRank(b) || a.category.localeCompare(b.category) || (a.source || "").localeCompare(b.source || "")
  );
}

export function groupByCategory(lines) {
  const groups = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.category === line.category) last.lines.push(line);
    else groups.push({ category: line.category, lines: [line] });
  }
  return groups;
}

export function sortAccounts(accounts) {
  return [...accounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

export const monthInputStyle = { ...timeInputStyle, boxSizing: "border-box" };

export const smallDim = { fontSize: "11px", color: COLORS.dim };

export function LogLine({ text }) {
  if (!text) return null;
  return <div style={{ padding: "10px 20px", fontSize: "11.5px", color: COLORS.sage, fontFamily: MONO }}>{text}</div>;
}

// Label left, figure right — the basic Ledger list row.
export function FigureRow({ label, sub, right, onClick, muted, style }) {
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", cursor: onClick ? "pointer" : "default", opacity: muted ? 0.55 : 1, ...style }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        {sub && <div style={{ fontSize: "10.5px", color: COLORS.dim, marginTop: "2px" }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Toggle beside an amount: checked (looked up) or unchecked (assumed — an
// account without easy access, or what should have been taken from it).
export function CheckToggle({ unchecked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!unchecked)}
      aria-label={unchecked ? "mark checked" : "mark unchecked"}
      aria-pressed={!!unchecked}
      title={unchecked ? "unchecked — tap when verified" : "mark unchecked"}
      style={{ background: "none", border: "none", padding: "4px", cursor: disabled ? "default" : "pointer", display: "inline-flex", opacity: disabled ? 0.25 : 1 }}
    >
      {unchecked ? <CircleDashed size={15} color={COLORS.amber} /> : <CircleCheck size={15} color={COLORS.dim} style={{ opacity: 0.45 }} />}
    </button>
  );
}

export const uncheckedInputStyle = { borderStyle: "dashed", color: COLORS.amber };
