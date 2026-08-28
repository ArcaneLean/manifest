import { useEffect } from "react";
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
//
// The device/browser back button fires `popstate`, not our own click
// handlers, so home <-> app transitions are mirrored onto the History API:
// opening an app pushes an entry, and popping it (back button, or the
// TopBar's own back arrow via history.back()) lands us on home. With no
// further entry to pop, the next back press falls through to the OS
// (exits the PWA) instead of leaving this component in a blank state.
export default function App() {
  const [activeApp, setActiveApp] = usePersistentState("manifest.nav.app", "home");

  useEffect(() => {
    if (activeApp !== "home" && APPS[activeApp]) {
      history.replaceState({ manifestApp: "home" }, "");
      history.pushState({ manifestApp: activeApp }, "");
    } else {
      history.replaceState({ manifestApp: "home" }, "");
    }
    // Only ever runs once, to seed history to match the persisted app on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onPopState(event) {
      setActiveApp(event.state?.manifestApp ?? "home");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setActiveApp]);

  const openApp = (appKey) => {
    history.pushState({ manifestApp: appKey }, "");
    setActiveApp(appKey);
  };

  // Back arrow in the TopBar pops the entry we pushed when the app opened;
  // the popstate handler above then syncs `activeApp` back to home.
  const goHome = () => history.back();

  if (activeApp === "home" || !APPS[activeApp]) {
    return (
      <>
        <LauncherView onOpen={openApp} />
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
