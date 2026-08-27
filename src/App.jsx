import { usePersistentState } from "./hooks/usePersistentState.js";
import TasksView from "./views/TasksView.jsx";
import MatrixView from "./views/MatrixView.jsx";
import CalendarView from "./views/CalendarView.jsx";
import CountdownsView from "./views/CountdownsView.jsx";
import TemplatesView from "./views/TemplatesView.jsx";
import TagsView from "./views/TagsView.jsx";
import HoursView from "./views/HoursView.jsx";
import { NavBar } from "./components/NavBar.jsx";
import { UpdatePrompt } from "./UpdatePrompt.jsx";

const VIEWS = {
  tasks: TasksView,
  matrix: MatrixView,
  calendar: CalendarView,
  countdowns: CountdownsView,
  templates: TemplatesView,
  tags: TagsView,
  hours: HoursView,
};

// Settings and a home/dashboard view are explicitly out of scope for now —
// see ARCHITECTURE.md §5 ("not built") and §7.
export default function App() {
  const [active, setActive] = usePersistentState("manifest.nav.active", "tasks");
  const ActiveView = VIEWS[active];

  return (
    <>
      <ActiveView />
      <NavBar active={active} onChange={setActive} />
      <UpdatePrompt />
    </>
  );
}
