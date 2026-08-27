import { usePersistentState } from "./hooks/usePersistentState.js";
import LauncherView from "./views/LauncherView.jsx";
import TaskManagerApp from "./apps/TaskManagerApp.jsx";
import CountdownsApp from "./apps/CountdownsApp.jsx";
import HoursApp from "./apps/HoursApp.jsx";
import { UpdatePrompt } from "./UpdatePrompt.jsx";

const APPS = {
  taskmanager: TaskManagerApp,
  countdowns: CountdownsApp,
  hours: HoursApp,
};

// Home screen launches into one of three apps; each app owns its own
// internal navigation (Task Manager has a bottom nav over its 5 views,
// Countdowns/Hours are single-view). See ARCHITECTURE.md §7.
export default function App() {
  const [activeApp, setActiveApp] = usePersistentState("manifest.nav.app", "home");
  const goHome = () => setActiveApp("home");

  if (activeApp === "home" || !APPS[activeApp]) {
    return (
      <>
        <LauncherView onOpen={setActiveApp} />
        <UpdatePrompt />
      </>
    );
  }

  const ActiveApp = APPS[activeApp];
  return (
    <>
      <ActiveApp onHome={goHome} />
      <UpdatePrompt />
    </>
  );
}
