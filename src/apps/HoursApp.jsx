import { Clock, Folders } from "lucide-react";
import { usePersistentState } from "../hooks/usePersistentState.js";
import HoursView from "../views/HoursView.jsx";
import ProjectsView from "../views/ProjectsView.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { TopBar } from "../components/TopBar.jsx";

const VIEWS = {
  log: HoursView,
  projects: ProjectsView,
};

const NAV_ITEMS = [
  { key: "log", label: "log", icon: Clock },
  { key: "projects", label: "projects", icon: Folders },
];

export default function HoursApp({ onHome }) {
  const [active, setActive] = usePersistentState("manifest.hours.active", "log");
  const ActiveView = VIEWS[active] || HoursView;

  return (
    <>
      <TopBar title="hours" onBack={onHome} />
      <ActiveView />
      <NavBar active={active} onChange={setActive} items={NAV_ITEMS} />
    </>
  );
}
