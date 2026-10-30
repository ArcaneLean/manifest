// Ledger's landing view: net worth, accounts, debts and the next months —
// see ARCHITECTURE.md §7 ("Ledger").
import { useRef, useState } from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { addMonths, monthLabel } from "../../lib/ledger/month.js";
import { assetTotals, latestBalanceMonth, staleAccounts, nextMonthToClose } from "../../lib/ledger/summary.js";
import { debtSummary } from "../../lib/ledger/debt.js";
import { forecast } from "../../lib/ledger/plan.js";
import { buildLedgerFile, parseLedgerFile } from "../../lib/ledger/io.js";
import { Page, Header, Section, Stats, Badge, primaryBtnStyle, linkStyle } from "../hours/ui.jsx";
import { Money, FigureRow, sortAccounts, smallDim, downloadJSON, LogLine } from "./ui.jsx";
import { AccountSheet } from "./AccountSheet.jsx";

export default function NowView({ store, go, hidden, setHidden }) {
  const { accounts, balances, debts, lines, months, currentMonth: cur, todayISO } = store;
  const [editing, setEditing] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [log, setLog] = useState(null);
  const fileRef = useRef(null);

  const latest = latestBalanceMonth(balances);
  const assets = latest ? assetTotals(accounts, balances, latest) : { total: 0, available: 0, earmarked: {}, accounts: {} };
  const activeDebts = debts.filter((d) => !d.archived);
  const debtRows = activeDebts.map((d) => ({ debt: d, summary: debtSummary(d, cur) }));
  const owed = debtRows.reduce((s, r) => s + r.summary.owed, 0);
  const stale = new Set(staleAccounts(accounts, balances, todayISO));
  const toClose = nextMonthToClose(months, cur);
  const from = latest || addMonths(cur, -1);
  const next = forecast({ lines, debts, fromMonth: from, toMonth: addMonths(from, 3), startBalance: assets.available });
  const shownAccounts = sortAccounts(accounts).filter((a) => !a.archived || assets.accounts[a.id]?.amount);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPendingImport(parseLedgerFile(JSON.parse(await file.text())));
    } catch (err) {
      setLog(`$ import failed · ${err.message}`);
    }
  };

  return (
    <Page>
      <Header
        title="~/ledger"
        sub={latest ? `balances as of ${monthLabel(latest)}` : "no balances yet"}
        right={
          <button onClick={() => setHidden(!hidden)} aria-label={hidden ? "show amounts" : "hide amounts"} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
            {hidden ? <EyeOff size={16} color={COLORS.dim} /> : <Eye size={16} color={COLORS.dim} />}
          </button>
        }
      />
      <Section label="net worth">
        <div style={{ fontSize: "26px", fontWeight: 600, marginBottom: "14px" }}>
          <Money cents={assets.total - owed} color={true} />
        </div>
        <Stats
          items={[
            { label: "assets", value: <Money cents={assets.total} /> },
            { label: "debts", value: <Money cents={-owed} /> },
            { label: "available", value: <Money cents={assets.available} />, color: COLORS.amber },
          ]}
        />
        {Object.keys(assets.earmarked).length > 0 && (
          <div style={{ marginTop: "14px" }}>
            {Object.entries(assets.earmarked).map(([label, cents]) => (
              <FigureRow key={label} label={<span style={{ color: COLORS.dim }}>earmarked · {label}</span>} right={<Money cents={cents} dim />} />
            ))}
          </div>
        )}
      </Section>

      {toClose && (
        <Section>
          <button onClick={() => go({ view: "month", month: toClose })} style={{ ...primaryBtnStyle, width: "100%", padding: "10px" }}>
            close {monthLabel(toClose)} →
          </button>
        </Section>
      )}

      <Section
        label="accounts"
        right={
          <span onClick={() => setEditing({ isNew: true })} style={{ ...linkStyle, display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <Plus size={11} /> account
          </span>
        }
      >
        {shownAccounts.length === 0 && <div style={smallDim}>// no accounts yet</div>}
        {shownAccounts.map((a) => {
          const b = assets.accounts[a.id];
          return (
            <FigureRow
              key={a.id}
              onClick={() => setEditing(a)}
              muted={a.archived}
              label={a.name}
              sub={[a.type, a.available ? null : "not available", a.earmark].filter(Boolean).join(" · ")}
              right={
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {stale.has(a.id) && <Badge color={COLORS.amberDim}>stale</Badge>}
                  <Money cents={b?.amount ?? null} />
                </span>
              }
            />
          );
        })}
      </Section>

      {debtRows.length > 0 && (
        <Section label="debts" right={<span onClick={() => go({ tab: "debts" })} style={linkStyle}>all</span>}>
          {debtRows.map(({ debt, summary }) => (
            <FigureRow
              key={debt.id}
              onClick={() => go({ tab: "debts", view: "debt", debtId: debt.id })}
              label={debt.name}
              sub={
                summary.next ? (
                  <>
                    next {monthLabel(summary.next.month)} · <Money cents={-summary.next.amount} />
                  </>
                ) : (
                  "no payments due"
                )
              }
              right={<Money cents={summary.owed} />}
            />
          ))}
        </Section>
      )}

      {next.rows.length > 0 && (
        <Section label="next months · expected" right={<span onClick={() => go({ tab: "plan" })} style={linkStyle}>plan</span>}>
          {next.rows.map((r) => (
            <FigureRow
              key={r.month}
              label={monthLabel(r.month)}
              sub={
                <>
                  net <Money cents={r.net} signed />
                </>
              }
              right={<Money cents={r.balance} color={r.balance < 0 ? COLORS.danger : undefined} />}
            />
          ))}
          <div style={{ ...smallDim, marginTop: "6px" }}>available money after each month, per the plan</div>
        </Section>
      )}

      <Section label="data">
        <div style={{ display: "flex", gap: "16px" }}>
          <span onClick={() => downloadJSON(`ledger-${todayISO}.json`, buildLedgerFile(store.raw))} style={linkStyle}>
            export ledger
          </span>
          <span onClick={() => fileRef.current?.click()} style={linkStyle}>
            import ledger
          </span>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
        </div>
        <div style={{ ...smallDim, marginTop: "8px", lineHeight: 1.5 }}>Ledger data only. Also part of the regular app backup.</div>
      </Section>
      <LogLine text={log} />

      {editing && <AccountSheet account={editing} store={store} onClose={() => setEditing(null)} />}
      {pendingImport && (
        <ConfirmDialog
          title="replace ledger data?"
          message={`Replaces all ledger data on this device with the file's ${pendingImport.finAccounts.length} account(s), ${pendingImport.finLines.length} line(s), ${pendingImport.finDebts.length} debt(s) and their history. Other apps are untouched.`}
          confirmLabel="replace"
          onCancel={() => setPendingImport(null)}
          onConfirm={async () => {
            const stores = pendingImport;
            setPendingImport(null);
            await store.importLedger(stores);
            setLog(`$ imported ledger · ${stores.finActuals.length} actuals · ${stores.finBalances.length} balances`);
          }}
        />
      )}
    </Page>
  );
}
