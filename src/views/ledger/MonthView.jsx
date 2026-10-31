// One month: balances, the bank's category totals and debt payments, then
// the reconciliation and "close" — see ARCHITECTURE.md §7 ("Ledger"). Also
// how history is viewed and corrected; every field saves on its own.
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { Segmented } from "../../components/Segmented.jsx";
import { addMonths, monthLabel, monthLongLabel } from "../../lib/ledger/month.js";
import { balancesAt, monthSummary } from "../../lib/ledger/summary.js";
import { debtSchedule, paymentIn } from "../../lib/ledger/debt.js";
import { formatCents } from "../../lib/ledger/money.js";
import { Page, Header, Section, Stats, linkStyle, primaryBtnStyle, secondaryBtnStyle } from "../hours/ui.jsx";
import { fieldStyle } from "../work/ui.jsx";
import { Money, AmountInput, FigureRow, LogLine, CheckToggle, uncheckedInputStyle, lineLabel, sortLines, groupByCategory, sortAccounts, smallDim } from "./ui.jsx";

const uncheckedTag = <span style={{ color: COLORS.amber }}>unchecked</span>;
const pair = (a, b) => <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>{a}{b}</span>;

function NewLineForm({ store, kind: initialKind, onDone }) {
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [kind, setKind] = useState(initialKind);
  const categories = [...new Set(store.lines.map((l) => l.category))].sort();
  const save = () => {
    if (!category.trim()) return;
    store.saveLine({ category: category.trim(), source: source.trim() || null, kind, nature: "variable", status: "estimate", rules: [], overrides: {} });
    onDone();
  };
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "6px", padding: "12px", marginTop: "10px" }}>
      <input autoFocus value={category} onChange={(e) => setCategory(e.target.value)} placeholder="bank category" list="ledger-categories" style={{ ...fieldStyle, marginBottom: "8px" }} />
      <datalist id="ledger-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="source (optional, e.g. Camper ver.)" style={{ ...fieldStyle, marginBottom: "8px" }} />
      <Segmented value={kind} onChange={setKind} options={[{ key: "expense", label: "expense" }, { key: "income", label: "income" }]} />
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
        <button onClick={onDone} style={secondaryBtnStyle}>
          cancel
        </button>
        <button onClick={save} style={{ ...primaryBtnStyle, opacity: category.trim() ? 1 : 0.5 }}>
          add line
        </button>
      </div>
    </div>
  );
}

function LinesSection({ label, kind, lines, store, month, summary, onOpenLine }) {
  const [adding, setAdding] = useState(false);
  const total = kind === "income" ? summary.actual.income : summary.actual.expense;
  return (
    <Section label={label} right={<Money cents={total} />}>
      {groupByCategory(lines).map((group) => (
        <div key={group.category} style={{ marginBottom: "6px" }}>
          {(group.lines.length > 1 || group.lines[0].source) && <div style={{ ...smallDim, marginTop: "6px" }}>{group.category}</div>}
          {group.lines.map((line) => {
            const expected = summary.expected.byLine[line.id] ?? 0;
            const unchecked = summary.unchecked.lines.includes(line.id);
            return (
              <FigureRow
                key={line.id}
                muted={line.status === "dropped" || line.archived}
                label={<span onClick={() => onOpenLine(line)} style={{ cursor: "pointer" }}>{group.lines.length > 1 || line.source ? line.source || "(other)" : line.category}</span>}
                sub={
                  <>
                    expected <Money cents={expected} />
                    {unchecked && <> · {uncheckedTag}</>}
                  </>
                }
                right={pair(
                  <CheckToggle unchecked={unchecked} onChange={(u) => store.setActualUnchecked(month, line.id, u, expected)} />,
                  <AmountInput
                    value={summary.actual.byLine[line.id] ?? null}
                    defaultSign={kind === "income" ? 1 : -1}
                    placeholder={kind === "income" ? "+0,00" : "-0,00"}
                    onCommit={(v) => store.setActual(month, line.id, v)}
                    style={unchecked ? uncheckedInputStyle : undefined}
                  />
                )}
              />
            );
          })}
        </div>
      ))}
      {adding ? (
        <NewLineForm store={store} kind={kind} onDone={() => setAdding(false)} />
      ) : (
        <span onClick={() => setAdding(true)} style={{ ...linkStyle, display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "6px" }}>
          <Plus size={11} /> line
        </span>
      )}
    </Section>
  );
}

export default function MonthView({ store, month, replace, onOpenLine }) {
  const { accounts, balances, lines, actuals, debts, setBalance, setBalanceUnchecked, updateMonth, setDebtPayment } = store;
  const [log, setLog] = useState(null);
  const summary = monthSummary(store, month);
  const prev = addMonths(month, -1);
  const now = balancesAt(accounts, balances, month);
  const before = balancesAt(accounts, balances, prev);
  const hasActual = new Set(actuals.filter((a) => a.month === month).map((a) => a.lineId));
  // Archived lines only show up where they already hold a value.
  const visible = sortLines(lines.filter((l) => !l.archived || hasActual.has(l.id)));
  const shownAccounts = sortAccounts(accounts).filter((a) => !a.archived || (now[a.id] && !now[a.id].carried));
  const activeDebts = debts.filter((d) => !d.archived);

  const close = () => {
    updateMonth(month, { closedAt: Date.now() });
    const parts = [`$ closed ${monthLabel(month)}`];
    if (summary.net !== null) parts.push(`net ${formatCents(summary.net, { signed: true })}`);
    if (summary.unexplained !== null) parts.push(`Δ ${formatCents(summary.unexplained, { signed: true })}`);
    if (summary.unchecked.count) parts.push(`${summary.unchecked.count} unchecked`);
    setLog(parts.join(" · "));
  };

  const nav = (m) => (
    <button onClick={() => replace({ view: "month", month: m })} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }} aria-label={monthLabel(m)}>
      {m < month ? <ChevronLeft size={16} color={COLORS.dim} /> : <ChevronRight size={16} color={COLORS.dim} />}
    </button>
  );

  return (
    <Page>
      <Header
        title={monthLongLabel(month)}
        sub={[
          summary.closedAt ? `closed ${new Date(summary.closedAt).toLocaleDateString("en-GB")}` : "open",
          summary.unchecked.count ? `${summary.unchecked.count} unchecked` : null,
        ].filter(Boolean).join(" · ")}
        left={nav(prev)}
        right={nav(addMonths(month, 1))}
      />

      <Section label="balances · end of month" right={<Money cents={Object.values(now).reduce((s, b) => s + b.amount, 0)} />}>
        {shownAccounts.length === 0 && <div style={smallDim}>// add accounts on ~/ledger first</div>}
        {shownAccounts.map((a) => {
          const b = now[a.id];
          const p = before[a.id];
          const unchecked = summary.unchecked.accounts.includes(a.id);
          return (
            <FigureRow
              key={a.id}
              label={a.name}
              sub={
                b?.carried ? (
                  <>
                    carried from {monthLabel(b.month)}
                    {b.unchecked && " (unchecked)"}
                  </>
                ) : p ? (
                  <>
                    {monthLabel(prev)} <Money cents={p.amount} />
                    {unchecked && <> · {uncheckedTag}</>}
                  </>
                ) : unchecked ? (
                  uncheckedTag
                ) : null
              }
              right={pair(
                <CheckToggle unchecked={unchecked} disabled={!b} onChange={(u) => setBalanceUnchecked(month, a.id, u, b?.amount)} />,
                <AmountInput
                  value={b && !b.carried ? b.amount : null}
                  placeholder={b ? "same" : "0,00"}
                  onCommit={(v) => setBalance(month, a.id, v)}
                  style={unchecked ? uncheckedInputStyle : undefined}
                />
              )}
            />
          );
        })}
      </Section>

      <Section label="bank · net total for the month">
        <FigureRow
          label="net per bank"
          sub="optional: the month's in − out as the bank reports it"
          right={<AmountInput value={summary.bankNet} onCommit={(v) => updateMonth(month, { bankNet: v })} placeholder="±0,00" />}
        />
      </Section>

      <LinesSection label="income" kind="income" lines={visible.filter((l) => l.kind === "income")} store={store} month={month} summary={summary} onOpenLine={onOpenLine} />
      <LinesSection label="expenses" kind="expense" lines={visible.filter((l) => l.kind !== "income")} store={store} month={month} summary={summary} onOpenLine={onOpenLine} />

      {activeDebts.length > 0 && (
        <Section label="debt payments">
          {activeDebts.map((d) => {
            const scheduled = paymentIn(debtSchedule({ ...d, payments: { ...d.payments, [month]: undefined } }), month);
            return (
              <FigureRow
                key={d.id}
                label={d.name}
                sub={
                  <>
                    scheduled <Money cents={scheduled} />
                    {d.lineId ? ` · booked on ${lineLabel(lines.find((l) => l.id === d.lineId))}` : ""}
                  </>
                }
                right={<AmountInput value={d.payments?.[month] ?? null} placeholder={scheduled ? "as planned" : "0,00"} onCommit={(v) => setDebtPayment(d, month, v)} />}
              />
            );
          })}
        </Section>
      )}

      <Section label="summary">
        <Stats
          items={[
            { label: "actual net", value: <Money cents={summary.actual.count ? summary.actual.net : null} signed color={true} /> },
            { label: "expected", value: <Money cents={summary.expected.net} signed /> },
            { label: "difference", value: <Money cents={summary.actual.count ? summary.actual.net - summary.expected.net : null} signed color={true} /> },
          ]}
        />
        <div style={{ marginTop: "14px" }}>
          <FigureRow label="balance change" sub={summary.delta === null ? `needs balances for ${monthLabel(prev)} and ${monthLabel(month)}` : "all accounts vs last month"} right={<Money cents={summary.delta} signed />} />
          <FigureRow
            label="unexplained"
            sub={summary.unchecked.count ? "checked balances' change − net of the checked lines" : "balance change − net of the lines (or the bank's net)"}
            right={<Money cents={summary.unexplained} signed color={summary.unexplained ? COLORS.amber : COLORS.sage} />}
          />
          {summary.unchecked.count > 0 && (
            <FigureRow
              label={<span style={{ color: COLORS.amber }}>unchecked · {summary.unchecked.count}</span>}
              sub="assumed values, left out of the checks above"
              right={
                <span style={{ ...smallDim, textAlign: "right" }}>
                  {summary.unchecked.accounts.length > 0 && (
                    <div>
                      {summary.unchecked.accounts.length} balance(s){summary.delta !== null && <> <Money cents={summary.unchecked.delta} signed /></>}
                    </div>
                  )}
                  {summary.unchecked.lines.length > 0 && (
                    <div>
                      {summary.unchecked.lines.length} line(s) <Money cents={summary.unchecked.net} signed />
                    </div>
                  )}
                </span>
              }
            />
          )}
          {summary.vsBank !== null && (
            <FigureRow label="lines vs bank net" sub="should be zero if every category was entered" right={<Money cents={summary.vsBank} signed color={summary.vsBank ? COLORS.amber : COLORS.sage} />} />
          )}
        </div>
        <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
          {summary.closedAt ? (
            <span onClick={() => updateMonth(month, { closedAt: null })} style={linkStyle}>
              reopen month
            </span>
          ) : (
            <button onClick={close} style={primaryBtnStyle}>
              close {monthLabel(month)}
            </button>
          )}
        </div>
      </Section>
      <LogLine text={log} />
    </Page>
  );
}
