// Expected income & expenses and the forecast of available money — see
// ARCHITECTURE.md §7 ("Ledger").
import { useState } from "react";
import { Plus } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { Segmented } from "../../components/Segmented.jsx";
import { usePersistentState } from "../../hooks/usePersistentState.js";
import { addMonths, monthLabel } from "../../lib/ledger/month.js";
import { forecast, debtSchedules, expectedFor } from "../../lib/ledger/plan.js";
import { assetTotals, latestBalanceMonth } from "../../lib/ledger/summary.js";
import { Page, Header, Section, Stats, Badge, Row, linkStyle } from "../hours/ui.jsx";
import { Money, FigureRow, lineLabel, sortLines, groupByCategory, smallDim } from "./ui.jsx";

const HORIZONS = [
  { key: "12", label: "1y" },
  { key: "36", label: "3y" },
  { key: "60", label: "5y" },
  { key: "120", label: "10y" },
];
const STATUS_COLOR = { fixed: COLORS.sage, estimate: COLORS.dim, buffer: COLORS.amberDim, dropped: COLORS.border };

function ForecastRow({ row, lines, debts }) {
  const [open, setOpen] = useState(false);
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  const debtById = Object.fromEntries(debts.map((d) => [d.id, d]));
  const parts = [
    ...Object.entries(row.byLine).map(([id, v]) => ({ key: id, label: lineLabel(byId[id]), v })),
    ...Object.entries(row.byDebt).map(([id, v]) => ({ key: id, label: `debt · ${debtById[id]?.name}`, v })),
  ].sort((a, b) => a.v - b.v);
  return (
    <Row onClick={() => setOpen((o) => !o)} style={{ padding: "9px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
        <span style={{ width: "58px" }}>{monthLabel(row.month)}</span>
        <Money cents={row.net} signed color={true} style={{ flex: 1 }} />
        <Money cents={row.balance} color={row.balance < 0 ? COLORS.danger : COLORS.text} style={{ fontWeight: 600 }} />
      </div>
      {open && (
        <div style={{ marginTop: "8px" }}>
          {parts.map((p) => (
            <FigureRow key={p.key} label={<span style={{ color: COLORS.dim, fontSize: "11.5px" }}>{p.label}</span>} right={<Money cents={p.v} style={{ fontSize: "11.5px" }} />} style={{ padding: "3px 0" }} />
          ))}
        </div>
      )}
    </Row>
  );
}

export default function PlanView({ store, onOpenLine }) {
  const { lines, debts, accounts, balances, currentMonth: cur } = store;
  const [horizon, setHorizon] = usePersistentState("manifest.ledger.horizon", "36");
  const latest = latestBalanceMonth(balances);
  const from = latest || addMonths(cur, -1);
  const start = latest ? assetTotals(accounts, balances, latest).available : 0;
  const { rows, lowest } = forecast({ lines, debts, fromMonth: from, toMonth: addMonths(from, Number(horizon)), startBalance: start });
  const schedules = debtSchedules(debts);
  const nextMonth = addMonths(from, 1);
  const active = sortLines(lines.filter((l) => !l.archived));
  const end = rows[rows.length - 1];

  return (
    <Page>
      <Header title="~/ledger/plan" sub={`expected from ${monthLabel(nextMonth)}`} right={<Segmented value={horizon} onChange={setHorizon} options={HORIZONS} />} />
      <Section label="available money">
        <Stats
          items={[
            { label: `now · ${monthLabel(from)}`, value: <Money cents={start} /> },
            { label: end ? `end · ${monthLabel(end.month)}` : "end", value: <Money cents={end?.balance ?? null} /> },
            { label: lowest ? `lowest · ${monthLabel(lowest.month)}` : "lowest", value: <Money cents={lowest?.balance ?? null} />, color: lowest && lowest.balance < 0 ? COLORS.danger : COLORS.amber },
          ]}
        />
      </Section>

      {["income", "expense"].map((kind) => {
        const ofKind = active.filter((l) => (kind === "income" ? l.kind === "income" : l.kind !== "income"));
        const total = ofKind.reduce((s, l) => s + expectedFor(l, nextMonth, schedules), 0);
        return (
          <Section
            key={kind}
            label={kind === "income" ? `income · ${monthLabel(nextMonth)}` : `expenses · ${monthLabel(nextMonth)}`}
            right={<Money cents={total} />}
          >
            {groupByCategory(ofKind).map((group) => (
              <div key={group.category}>
                {group.lines.map((line) => (
                  <FigureRow
                    key={line.id}
                    onClick={() => onOpenLine(line)}
                    muted={line.status === "dropped"}
                    label={lineLabel(line)}
                    sub={
                      <span style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                        <Badge color={STATUS_COLOR[line.status] || COLORS.dim}>{line.status}</Badge>
                        {line.nature}
                        {(line.rules || []).some((r) => r.every > 1) && " · periodic"}
                        {schedules.some((s) => s.debt.lineId === line.id) && " · debt"}
                      </span>
                    }
                    right={<Money cents={expectedFor(line, nextMonth, schedules)} dim={!expectedFor(line, nextMonth, schedules)} />}
                  />
                ))}
              </div>
            ))}
            <span
              onClick={() => onOpenLine({ isNew: true, kind, nature: "variable", status: "estimate", rules: [], overrides: {} })}
              style={{ ...linkStyle, display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "6px" }}
            >
              <Plus size={11} /> line
            </span>
          </Section>
        );
      })}

      <div style={{ padding: "14px 20px 6px", display: "flex", gap: "10px", fontSize: "11px", color: COLORS.dim }}>
        <span style={{ width: "58px" }}>month</span>
        <span style={{ flex: 1 }}>net</span>
        <span>available</span>
      </div>
      {rows.length === 0 && <div style={{ ...smallDim, padding: "0 20px" }}>// add lines and rules to see a forecast</div>}
      {rows.map((r) => (
        <ForecastRow key={r.month} row={r} lines={lines} debts={debts} />
      ))}
    </Page>
  );
}
