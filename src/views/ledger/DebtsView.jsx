// Debts list and one debt's prognosis — see ARCHITECTURE.md §7 ("Ledger").
import { useState } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { monthLabel, isMonth } from "../../lib/ledger/month.js";
import { debtSummary, anchorOf, rateExpiringSoon, duoCapacity } from "../../lib/ledger/debt.js";
import { Page, Header, Section, Stats, Badge, Row, linkStyle } from "../hours/ui.jsx";
import { Money, AmountInput, FigureRow, monthInputStyle, smallDim } from "./ui.jsx";
import { DebtSheet } from "./DebtSheet.jsx";

const pct = (rate) => `${(rate * 100).toLocaleString("nl-NL", { maximumFractionDigits: 3 })}%`;

export function DebtsView({ store, go }) {
  const { debts, currentMonth, todayISO } = store;
  const [editing, setEditing] = useState(null);
  const rows = debts
    .map((d) => ({ debt: d, s: debtSummary(d, currentMonth) }))
    .sort((a, b) => Number(!!a.debt.archived) - Number(!!b.debt.archived) || b.s.owed - a.s.owed);
  const active = rows.filter((r) => !r.debt.archived);
  const total = active.reduce((s, r) => s + r.s.owed, 0);
  const monthly = active.reduce((s, r) => s + r.s.paymentNow, 0);
  const interest = active.reduce((s, r) => s + r.s.remainingInterest, 0);

  return (
    <Page>
      <Header title="~/ledger/debts" sub={`as of ${monthLabel(currentMonth)}`} />
      <Section
        right={
          <span onClick={() => setEditing({ isNew: true })} style={{ ...linkStyle, display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <Plus size={11} /> debt
          </span>
        }
        label="total"
      >
        <Stats
          items={[
            { label: "owed", value: <Money cents={total} />, color: COLORS.amber },
            { label: "paying / mo", value: <Money cents={monthly} /> },
            { label: "interest left", value: <Money cents={interest} /> },
          ]}
        />
      </Section>
      {rows.map(({ debt, s }) => (
        <Row key={debt.id} onClick={() => go({ view: "debt", debtId: debt.id })} style={{ opacity: debt.archived ? 0.55 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ flex: 1, fontSize: "13px" }}>{debt.name}</span>
            {rateExpiringSoon(debt, todayISO) && <Badge color={COLORS.amber}>rate ends</Badge>}
            <Money cents={s.owed} style={{ fontSize: "13px", fontWeight: 600 }} />
          </div>
          <div style={{ ...smallDim, marginTop: "4px" }}>
            {pct(debt.rate || 0)} · {s.next ? <>next {monthLabel(s.next.month)} <Money cents={s.next.amount} /></> : "nothing due"}
            {s.payoffMonth ? ` · paid off ${monthLabel(s.payoffMonth)}` : s.forgiven ? " · rest forgiven" : ""}
          </div>
        </Row>
      ))}
      {rows.length === 0 && <div style={{ ...smallDim, padding: "16px 20px" }}>// no debts</div>}
      {editing && <DebtSheet debt={editing} store={store} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function YearRows({ rows }) {
  const [open, setOpen] = useState(null);
  const years = [];
  for (const r of rows) {
    const y = r.month.slice(0, 4);
    let g = years[years.length - 1];
    if (!g || g.year !== y) years.push((g = { year: y, rows: [], interest: 0, payment: 0 }));
    g.rows.push(r);
    g.interest += r.interest;
    g.payment += r.payment;
  }
  return years.map((g) => (
    <div key={g.year}>
      <Row onClick={() => setOpen(open === g.year ? null : g.year)} style={{ padding: "9px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
          {open === g.year ? <ChevronDown size={12} color={COLORS.dim} /> : <ChevronRight size={12} color={COLORS.dim} />}
          <span style={{ width: "40px" }}>{g.year}</span>
          <span style={{ flex: 1, color: COLORS.dim }}>
            paid <Money cents={g.payment} /> · int <Money cents={g.interest} />
          </span>
          <Money cents={g.rows[g.rows.length - 1].closing} style={{ fontWeight: 600 }} />
        </div>
      </Row>
      {open === g.year &&
        g.rows.map((r) => (
          <div key={r.month} style={{ display: "flex", gap: "8px", padding: "5px 20px 5px 40px", fontSize: "11px", color: COLORS.dim, borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ width: "52px", color: COLORS.text }}>{monthLabel(r.month)}</span>
            <span style={{ flex: 1 }}>
              {r.grace ? "grace" : <Money cents={r.payment} />}
              {r.actual ? " ✓" : ""} · int <Money cents={r.interest} />
            </span>
            <Money cents={r.closing} />
          </div>
        ))}
    </div>
  ));
}

export function DebtView({ store, debtId, back }) {
  const { debts, currentMonth, todayISO, saveDebt } = store;
  const debt = debts.find((d) => d.id === debtId);
  const [editing, setEditing] = useState(false);
  const [checkMonth, setCheckMonth] = useState(currentMonth);
  const [extra, setExtra] = useState(null);
  const [lumpMonth, setLumpMonth] = useState(currentMonth);
  const [lump, setLump] = useState(null);
  if (!debt) return <Page><Header title="~/ledger/debts" sub="debt not found" /></Page>;

  const s = debtSummary(debt, currentMonth);
  const whatIf = extra || lump ? debtSummary(debt, currentMonth, { extraMonthly: extra || 0, lumpSums: lump ? { [lumpMonth]: lump } : {} }) : null;
  const anchor = anchorOf(debt);
  const checks = [...(debt.checks || [])].sort((a, b) => (a.month < b.month ? 1 : -1));
  const cap = debt.kind === "duo" ? duoCapacity(debt) : null;

  const addCheck = (balance) => {
    if (balance == null || !isMonth(checkMonth)) return;
    const rest = (debt.checks || []).filter((c) => c.month !== checkMonth);
    saveDebt({ ...debt, checks: [...rest, { month: checkMonth, balance, checkedOn: todayISO }] });
  };
  const removeCheck = (month) => {
    if ((debt.checks || []).length <= 1) return;
    saveDebt({ ...debt, checks: debt.checks.filter((c) => c.month !== month) });
  };

  return (
    <Page>
      <Header
        title={debt.name}
        sub={[debt.kind === "duo" ? "DUO" : debt.kind, pct(debt.rate || 0), debt.rateValidUntil ? `rate until ${debt.rateValidUntil}` : null].filter(Boolean).join(" · ")}
        right={
          <span onClick={() => setEditing(true)} style={linkStyle}>
            edit
          </span>
        }
      />
      <Section>
        <Stats
          items={[
            { label: "owed now", value: <Money cents={s.owed} />, color: COLORS.amber },
            { label: "this month", value: <Money cents={s.paymentNow} /> },
            { label: "interest left", value: <Money cents={s.remainingInterest} /> },
          ]}
        />
        <div style={{ marginTop: "12px" }}>
          {s.next && <FigureRow label="next payment" right={<span>{monthLabel(s.next.month)} · <Money cents={s.next.amount} /></span>} />}
          {s.schedule.statutory !== null && <FigureRow label="statutory monthly amount" right={<Money cents={s.schedule.statutory} />} />}
          {cap !== null && <FigureRow label="draagkracht cap" sub="4% × (income − exempt) / 12" right={<Money cents={cap} />} />}
          <FigureRow label="still to pay" right={<Money cents={s.remainingPayments} />} />
          {s.payoffMonth && <FigureRow label="paid off" right={monthLabel(s.payoffMonth)} />}
          {s.forgiven > 0 && <FigureRow label={`forgiven after ${monthLabel(s.endMonth)}`} right={<Money cents={s.forgiven} color={COLORS.sage} />} />}
          {rateExpiringSoon(debt, todayISO) && <div style={{ fontSize: "11.5px", color: COLORS.amber, marginTop: "6px" }}>! the interest rate is only fixed until {debt.rateValidUntil} — update it when the new rate is known</div>}
          {debt.notes && <div style={{ ...smallDim, marginTop: "8px" }}>{debt.notes}</div>}
        </div>
      </Section>

      <Section label="balance checks · the schedule starts from the latest">
        {checks.map((c) => (
          <FigureRow
            key={c.month}
            label={`start of ${monthLabel(c.month)}`}
            sub={c.checkedOn ? `checked ${c.checkedOn}${c === anchor ? " · in use" : ""}` : c === anchor ? "in use" : null}
            right={
              <span style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <Money cents={c.balance} />
                {checks.length > 1 && (
                  <span onClick={() => removeCheck(c.month)} style={{ ...linkStyle, fontSize: "10.5px" }}>
                    remove
                  </span>
                )}
              </span>
            }
          />
        ))}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
          <input type="month" value={checkMonth} onChange={(e) => setCheckMonth(e.target.value)} style={monthInputStyle} />
          <AmountInput key={checks.length} value={null} onCommit={addCheck} placeholder="new balance" />
        </div>
      </Section>

      <Section label="what if">
        <FigureRow label="extra every month" right={<AmountInput value={extra} onCommit={setExtra} placeholder="0,00" />} />
        <FigureRow
          label="one-off payment"
          sub={<input type="month" value={lumpMonth} onChange={(e) => setLumpMonth(e.target.value)} style={{ ...monthInputStyle, marginTop: "4px", fontSize: "11px", padding: "3px 6px" }} />}
          right={<AmountInput value={lump} onCommit={setLump} placeholder="0,00" />}
        />
        {whatIf && (
          <div style={{ marginTop: "10px" }}>
            <FigureRow label="interest saved" right={<Money cents={s.remainingInterest - whatIf.remainingInterest} color={COLORS.sage} />} />
            <FigureRow label="total paid instead" right={<Money cents={whatIf.remainingPayments} />} />
            <FigureRow label="ends" right={whatIf.payoffMonth ? monthLabel(whatIf.payoffMonth) : whatIf.endMonth ? `${monthLabel(whatIf.endMonth)} (rest forgiven)` : "—"} />
            {whatIf.forgiven > 0 && <FigureRow label="forgiven" right={<Money cents={whatIf.forgiven} />} />}
            {debt.kind === "annuity" && <div style={{ ...smallDim, marginTop: "6px" }}>annuity: extra lowers later payments, the term stays</div>}
          </div>
        )}
      </Section>

      <div style={{ padding: "14px 20px 6px", fontSize: "11px", color: COLORS.dim }}>schedule · balance at year end</div>
      <YearRows rows={s.schedule.rows} />
      {editing && <DebtSheet debt={debt} store={store} onClose={() => setEditing(false)} onDeleted={back} />}
    </Page>
  );
}
