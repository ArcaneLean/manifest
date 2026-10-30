import { useEffect, useState } from "react";
import { Wallet, CalendarDays, LineChart, Landmark } from "lucide-react";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { useLedger } from "../hooks/useLedger.js";
import { currentMonth, monthLabel } from "../lib/ledger/month.js";
import NowView from "../views/ledger/NowView.jsx";
import MonthsView from "../views/ledger/MonthsView.jsx";
import MonthView from "../views/ledger/MonthView.jsx";
import PlanView from "../views/ledger/PlanView.jsx";
import { DebtsView, DebtView } from "../views/ledger/DebtsView.jsx";
import { LineSheet } from "../views/ledger/LineSheet.jsx";
import { HiddenContext } from "../views/ledger/ui.jsx";
import { Page, Header } from "../views/hours/ui.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { TopBar } from "../components/TopBar.jsx";

const NAV_ITEMS = [
  { key: "now", label: "now", icon: Wallet },
  { key: "months", label: "months", icon: CalendarDays },
  { key: "plan", label: "plan", icon: LineChart },
  { key: "debts", label: "debts", icon: Landmark },
];

// Ledger — personal accounting, see ARCHITECTURE.md §7 ("Ledger"). Same
// shell as Hours: all data loaded once here and passed down, a bottom tab
// bar, and an in-memory drill-down stack (a month, a debt) that the TopBar
// back arrow pops before leaving the app.
export default function LedgerApp({ onHome }) {
  const [tab, setTab] = usePersistentState("manifest.ledger.tab", "now");
  const [hidden, setHidden] = usePersistentState("manifest.ledger.hidden", false);
  const [stack, setStack] = useState([]);
  const [editingLine, setEditingLine] = useState(null);
  const ledger = useLedger();
  const store = { ...ledger, currentMonth: currentMonth() };

  const route = stack[stack.length - 1] || null;
  // `{ tab }` switches tab (optionally straight into one of its views).
  const go = (r) => {
    if (r.tab) {
      setTab(r.tab);
      const { tab: _t, ...view } = r;
      setStack(view.view ? [view] : []);
    } else setStack((s) => [...s, r]);
  };
  const replace = (r) => setStack((s) => [...s.slice(0, -1), r]);
  const back = () => setStack((s) => s.slice(0, -1));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route?.view, route?.debtId, tab]);

  const onBack = () => (stack.length ? back() : onHome());
  const crumb = route?.view === "month" ? monthLabel(route.month) : route?.view === "debt" ? store.debts.find((d) => d.id === route.debtId)?.name : null;
  const title = ["ledger", tab === "now" && !route ? null : route?.view === "month" ? "months" : tab, crumb].filter(Boolean).join(" / ");
  const props = { store, go, replace, back, onOpenLine: setEditingLine };

  let content;
  if (ledger.loading)
    content = (
      <Page>
        <Header title="~/ledger" sub="loading…" />
      </Page>
    );
  else if (route?.view === "month") content = <MonthView key={route.month} month={route.month} {...props} />;
  else if (route?.view === "debt") content = <DebtView debtId={route.debtId} {...props} />;
  else if (tab === "months") content = <MonthsView {...props} />;
  else if (tab === "plan") content = <PlanView {...props} />;
  else if (tab === "debts") content = <DebtsView {...props} />;
  else content = <NowView {...props} hidden={hidden} setHidden={setHidden} />;

  return (
    <HiddenContext.Provider value={hidden}>
      <TopBar title={title} onBack={onBack} />
      {content}
      {editingLine && <LineSheet line={editingLine} store={store} onClose={() => setEditingLine(null)} />}
      <NavBar
        active={tab}
        onChange={(k) => {
          setStack([]);
          setTab(k);
        }}
        items={NAV_ITEMS}
      />
    </HiddenContext.Provider>
  );
}
