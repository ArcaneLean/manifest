// Historic months, newest first — see ARCHITECTURE.md §7 ("Ledger").
import { useState } from "react";
import { COLORS } from "../../theme/colors.js";
import { monthLabel, isMonth, addMonths } from "../../lib/ledger/month.js";
import { knownMonths, monthSummary } from "../../lib/ledger/summary.js";
import { Page, Header, Section, Row, Badge, linkStyle, primaryBtnStyle } from "../hours/ui.jsx";
import { Money, monthInputStyle, smallDim } from "./ui.jsx";

export default function MonthsView({ store, go }) {
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState(addMonths(store.currentMonth, -1));
  const list = knownMonths(store);
  const summaries = list.map((m) => monthSummary(store, m));
  const withNet = summaries.filter((s) => s.net !== null);
  const avg = withNet.length ? Math.round(withNet.reduce((s, x) => s + x.net, 0) / withNet.length) : null;

  return (
    <Page>
      <Header title="~/ledger/months" sub={`${list.length} month(s) recorded`} />
      <Section
        label={avg !== null ? "average net / month" : null}
        right={
          <span onClick={() => setPicking((p) => !p)} style={linkStyle}>
            + month
          </span>
        }
      >
        {avg !== null && (
          <div style={{ fontSize: "18px", fontWeight: 600 }}>
            <Money cents={avg} signed color={true} />
          </div>
        )}
        {picking && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "12px" }}>
            <input type="month" value={pick} onChange={(e) => setPick(e.target.value)} style={monthInputStyle} />
            <button onClick={() => isMonth(pick) && go({ view: "month", month: pick })} style={primaryBtnStyle}>
              open
            </button>
          </div>
        )}
      </Section>
      {summaries.length === 0 && <div style={{ ...smallDim, padding: "16px 20px" }}>// nothing recorded yet — close a month from ~/ledger</div>}
      {summaries.map((s) => (
        <Row key={s.month} onClick={() => go({ view: "month", month: s.month })}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12.5px", flex: 1 }}>{monthLabel(s.month)}</span>
            {s.closedAt ? <Badge color={COLORS.sage}>closed</Badge> : null}
            {s.unchecked.count ? <Badge color={COLORS.amberDim}>{s.unchecked.count} unchecked</Badge> : null}
            {s.unexplained ? <Badge color={COLORS.amberDim}>Δ</Badge> : null}
            <Money cents={s.net} signed color={true} style={{ fontSize: "12.5px", fontWeight: 600 }} />
          </div>
          <div style={{ ...smallDim, marginTop: "3px", display: "flex", gap: "10px" }}>
            {s.actual.count ? (
              <>
                <span>
                  in <Money cents={s.actual.income} />
                </span>
                <span>
                  out <Money cents={s.actual.expense} />
                </span>
              </>
            ) : (
              <span>bank net only</span>
            )}
          </div>
        </Row>
      ))}
    </Page>
  );
}
