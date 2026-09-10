import { usePersistentState } from "../hooks/usePersistentState.js";
import TasksView from "../views/TasksView.jsx";
import TemplatesView from "../views/TemplatesView.jsx";
import RecurringView from "../views/RecurringView.jsx";
import TagsView from "../views/TagsView.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { TopBar } from "../components/TopBar.jsx";

// Matrix and Calendar are archived — unwired but kept unused. See
// ARCHITECTURE.md §5/§7.
const VIEWS = {
  tasks: TasksView,
  templates: TemplatesView,
  recurring: RecurringView,
  tags: TagsView,
};

export default function TaskManagerApp({ onHome }) {
  const [active, setActive] = usePersistentState("manifest.taskmanager.active", "tasks");
  // Falls back to Tasks for a persisted tab that's no longer wired (e.g.
  // "matrix"/"calendar" from before they were archived).
  const ActiveView = VIEWS[active] || TasksView;

  return (
    <>
      <TopBar title="task manager" onBack={onHome} />
      <ActiveView />
      <NavBar active={active} onChange={setActive} />
    </>
  );
}
