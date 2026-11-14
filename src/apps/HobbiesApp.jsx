import { useEffect, useState } from "react";
import { Zap, ListOrdered, Lightbulb, Archive } from "lucide-react";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { usePursuits } from "../hooks/usePursuits.js";
import NowView from "../views/hobbies/NowView.jsx";
import NextView from "../views/hobbies/NextView.jsx";
import IdeasView from "../views/hobbies/IdeasView.jsx";
import DoneView from "../views/hobbies/DoneView.jsx";
import { PursuitSheet } from "../views/hobbies/PursuitSheet.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { TopBar } from "../components/TopBar.jsx";

const NAV_ITEMS = [
  { key: "now", label: "now", icon: Zap },
  { key: "next", label: "next", icon: ListOrdered },
  { key: "ideas", label: "ideas", icon: Lightbulb },
  { key: "done", label: "done", icon: Archive },
];

const VIEWS = { now: NowView, next: NextView, ideas: IdeasView, done: DoneView };

// Hobbies — see ARCHITECTURE.md §7 ("Hobbies"). An entertainment / hobby
// project tracker: what's on the go, what's queued, ideas, and what's done.
// Like WorkTasksApp, all data is loaded once here and passed down as `store`.
export default function HobbiesApp({ onHome }) {
  const [tab, setTab] = usePersistentState("manifest.hobbies.tab", "now");
  const [editing, setEditing] = useState(null);
  const hobbies = usePursuits();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const store = {
    loading: hobbies.loading,
    pursuits: hobbies.pursuits,
    addPursuit: hobbies.addPursuit,
    setStatus: hobbies.setStatus,
    removePursuit: hobbies.removePursuit,
    reorder: hobbies.reorder,
    goTab: setTab,
    openPursuit: (p) => setEditing(p),
    newPursuit: (defaults) => setEditing({ isNew: true, ...defaults }),
    savePursuit: (p, fields) => {
      if (p.isNew) hobbies.addPursuit(fields);
      else hobbies.updatePursuit(p.id, fields);
    },
  };

  // Back from a non-root tab returns to "now" first, like Ledger.
  const onBack = () => {
    if (tab !== "now") setTab("now");
    else onHome();
  };

  const View = VIEWS[tab] || NowView;
  // Re-read the record being edited so the sheet never opens on a stale copy.
  const editingPursuit = editing && (editing.isNew ? editing : hobbies.pursuits.find((p) => p.id === editing.id));

  return (
    <>
      <TopBar title={tab === "now" ? "hobbies" : `hobbies / ${tab}`} onBack={onBack} />
      <View store={store} />
      <NavBar active={tab} onChange={setTab} items={NAV_ITEMS} />
      {editingPursuit && <PursuitSheet key={editingPursuit.id || "new"} pursuit={editingPursuit} store={store} onClose={() => setEditing(null)} />}
    </>
  );
}
