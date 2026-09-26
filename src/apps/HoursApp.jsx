import { useEffect, useState } from "react";
import { CalendarRange, Folders } from "lucide-react";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { useClock } from "../hooks/useClock.js";
import { useHours } from "../hooks/useHours.js";
import { useProjects } from "../hooks/useProjects.js";
import { useBookingCodes } from "../hooks/useBookingCodes.js";
import { useBookings } from "../hooks/useBookings.js";
import { useHoursSettings } from "../hooks/useHoursSettings.js";
import { useWorkTasks } from "../hooks/useWorkTasks.js";
import { isoWeekNumber, dayLabel } from "../lib/hours2/week.js";
import ProjectsView from "../views/ProjectsView.jsx";
import WeeksView from "../views/hours/WeeksView.jsx";
import WeekView from "../views/hours/WeekView.jsx";
import DayView from "../views/hours/DayView.jsx";
import BookingView from "../views/hours/BookingView.jsx";
import BankView from "../views/hours/BankView.jsx";
import { Page, Header } from "../views/hours/ui.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { TopBar } from "../components/TopBar.jsx";

const NAV_ITEMS = [
  { key: "weeks", label: "weeks", icon: CalendarRange },
  { key: "projects", label: "projects", icon: Folders },
];

function crumb(route) {
  if (route.view === "week") return `wk${isoWeekNumber(route.weekStart)}`;
  if (route.view === "booking") return "booking";
  if (route.view === "day") return dayLabel(route.date);
  if (route.view === "bank") return "bank";
  return null;
}

// Hours 2.0 — see ARCHITECTURE.md §7. Drill-down weeks → week → day (plus
// booking and bank) kept as an in-memory route stack: the TopBar back arrow
// pops one level and only leaves the app from the root. All Hours data is
// loaded once here and passed down, so every level sees the same state.
export default function HoursApp({ onHome }) {
  const [tab, setTab] = usePersistentState("manifest.hours.tab", "weeks");
  const [stack, setStack] = useState([{ view: "weeks" }]);
  const now = useClock(30000);

  const hours = useHours();
  const projects = useProjects();
  const codes = useBookingCodes();
  const bookings = useBookings();
  const settings = useHoursSettings();
  // Only for showing which work task a segment was started from.
  const work = useWorkTasks();
  const store = {
    ...hours,
    ...projects,
    ...codes,
    ...bookings,
    ...settings,
    workTasks: work.tasks,
    projectsLoading: projects.loading,
    loading: hours.loading || projects.loading || codes.loading || bookings.loading || settings.loading,
  };

  const route = stack[stack.length - 1];
  const go = (r) => setStack((s) => [...s, r]);
  const replace = (r) => setStack((s) => [...s.slice(0, -1), r]);
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route, tab]);

  const onBack = () => {
    if (tab === "weeks" && stack.length > 1) back();
    else onHome();
  };

  const title = tab === "projects" ? "hours / projects" : ["hours", ...stack.map(crumb).filter(Boolean)].join(" / ");
  const props = { store, now, go, replace, back };

  let content;
  if (tab === "projects") content = <ProjectsView store={store} />;
  else if (store.loading)
    content = (
      <Page>
        <Header title="~/hours" sub="loading…" />
      </Page>
    );
  else if (route.view === "week") content = <WeekView key={route.weekStart} weekStart={route.weekStart} {...props} />;
  else if (route.view === "day") content = <DayView date={route.date} {...props} />;
  else if (route.view === "booking") content = <BookingView key={route.weekStart} weekStart={route.weekStart} {...props} />;
  else if (route.view === "bank") content = <BankView {...props} />;
  else content = <WeeksView {...props} />;

  return (
    <>
      <TopBar title={title} onBack={onBack} />
      {content}
      <NavBar
        active={tab}
        onChange={(k) => {
          if (k === tab && k === "weeks") setStack([{ view: "weeks" }]);
          setTab(k);
        }}
        items={NAV_ITEMS}
      />
    </>
  );
}
