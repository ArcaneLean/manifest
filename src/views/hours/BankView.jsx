// Per-code bank + the opening balance. See ARCHITECTURE.md §7 ("Hours 2.0").
import { useState } from "react";
import { COLORS } from "../../theme/colors.js";
import { weekStartOf, weekLabel } from "../../lib/hours2/week.js";
import { isConfirmed, countsForBank, weekDelta } from "../../lib/hours2/bank.js";
import { Page, Header, Section, Row, Dot, timeInputStyle, primaryBtnStyle, secondaryBtnStyle, linkStyle, fmtSigned, signColor } from "./ui.jsx";
import { bankNow, sumValues, clockContext } from "./model.js";
import { codeLabel, codeColor, pickableCodes, sortCodeIds, parseSignedDuration, formatSignedHHMM } from "./codes.js";

function OpeningForm({ store, now, onDone }) {
  const { settings, codes, projects, updateSettings } = store;
  const opening = settings.opening || { weekStart: weekStartOf(clockContext(now).todayISO), perCode: {} };
  const ids = sortCodeIds(new Set([...pickableCodes(codes, projects).map((c) => c.id), ...Object.keys(opening.perCode)]), codes, projects);
  const [weekDate, setWeekDate] = useState(opening.weekStart);
  const [values, setValues] = useState(Object.fromEntries(ids.map((id) => [id, opening.perCode[id] ? formatSignedHHMM(opening.perCode[id]) : ""])));
  const parsed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parseSignedDuration(v)]));
  const invalid = Object.values(parsed).some((v) => v === null) || !weekDate;

  const save = () => {
    if (invalid) return;
    const perCode = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== 0));
    updateSettings({ opening: { weekStart: weekStartOf(weekDate), perCode } });
    onDone();
  };

  return (
    <Section label="opening balance">
      <div style={{ fontSize: "11.5px", color: COLORS.dim, marginBottom: "12px", lineHeight: 1.5 }}>
        Copy each code's balance from the old system, as of the start of a week. Weeks before it don't count toward the bank. Format: +2:30, -1:15 or 2.5.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", color: COLORS.dim }}>as of</span>
        <input type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} style={timeInputStyle} />
        {weekDate && <span style={{ fontSize: "11px", color: COLORS.dim }}>{weekLabel(weekStartOf(weekDate))}</span>}
      </div>
      {ids.map((id) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <Dot color={codeColor(id, codes, projects)} />
          <span style={{ flex: 1, fontSize: "12.5px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{codeLabel(id, codes, projects)}</span>
          <input
            value={values[id] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
            placeholder="+0:00"
            inputMode="text"
            style={{ ...timeInputStyle, width: "86px", textAlign: "right", borderColor: parsed[id] === null ? COLORS.amber : COLORS.border }}
          />
        </div>
      ))}
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" }}>
        <button onClick={onDone} style={secondaryBtnStyle}>
          cancel
        </button>
        <button onClick={save} disabled={invalid} style={{ ...primaryBtnStyle, opacity: invalid ? 0.5 : 1 }}>
          save
        </button>
      </div>
    </Section>
  );
}

export default function BankView({ store, now, go }) {
  const { settings, codes, projects, bookings } = store;
  const [editing, setEditing] = useState(!settings.opening);
  const bank = bankNow(store);
  const total = sumValues(bank);
  const ids = sortCodeIds(Object.keys(bank).filter((k) => bank[k] !== 0), codes, projects);
  const history = Object.values(bookings)
    .filter((b) => isConfirmed(b) && countsForBank(b.weekStart, settings.opening))
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));

  return (
    <Page>
      <Header title="~/hours/bank" sub="per booking code" />
      <Section label="total">
        <div style={{ fontSize: "26px", fontWeight: 600, color: signColor(total) }}>{fmtSigned(total)}</div>
      </Section>
      <Section label="per code">
        {ids.length === 0 && <div style={{ fontSize: "12px", color: COLORS.dim }}>// all codes at zero</div>}
        {ids.map((id) => (
          <div key={id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "5px 0" }}>
            <Dot color={codeColor(id, codes, projects)} />
            <span style={{ flex: 1, fontSize: "12.5px" }}>{codeLabel(id, codes, projects)}</span>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: signColor(bank[id]) }}>{fmtSigned(bank[id])}</span>
          </div>
        ))}
      </Section>

      {editing ? (
        <OpeningForm store={store} now={now} onDone={() => setEditing(false)} />
      ) : (
        <Section
          label="opening balance"
          right={
            <span onClick={() => setEditing(true)} style={linkStyle}>
              edit
            </span>
          }
        >
          <div style={{ fontSize: "12px", color: COLORS.dim }}>
            as of {weekLabel(settings.opening.weekStart)} · {fmtSigned(sumValues(settings.opening.perCode))} over {Object.keys(settings.opening.perCode).length} code(s)
          </div>
        </Section>
      )}

      {history.length > 0 && (
        <>
          <div style={{ padding: "14px 20px 6px", fontSize: "11px", color: COLORS.dim }}>booked weeks</div>
          {history.map((b) => {
            const delta = sumValues(weekDelta(b));
            return (
              <Row key={b.weekStart} onClick={() => go({ view: "week", weekStart: b.weekStart })}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                  <span>{weekLabel(b.weekStart)}</span>
                  <span style={{ color: signColor(delta), fontWeight: 600 }}>{fmtSigned(delta)}</span>
                </div>
              </Row>
            );
          })}
        </>
      )}
    </Page>
  );
}
