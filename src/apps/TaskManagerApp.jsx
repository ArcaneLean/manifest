import { usePersistentState } from "../hooks/usePersistentState.js";
import TasksView from "../views/TasksView.jsx";
import MatrixView from "../views/MatrixView.jsx";
import CalendarView from "../views/CalendarView.jsx";
import TemplatesView from "../views/TemplatesView.jsx";
import TagsView from "../views/TagsView.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { TopBar } from "../components/TopBar.jsx";

const VIEWS = {
  tasks: TasksView,
  matrix: MatrixView,
  calendar: CalendarView,
  templates: TemplatesView,
  tags: TagsView,
};

export default function TaskManagerApp({ onHome }) {
  const [active, setActive] = usePersistentState("manifest.taskmanager.active", "tasks");
  const ActiveView = VIEWS[active];

  return (
    <>
      <TopBar title="task manager" onBack={onHome} />
      <ActiveView />
      <NavBar active={active} onChange={setActive} />
    </>
  );
}
