import { useEffect, useState } from "react";
import { Zap, FolderKanban, Columns3, ScrollText } from "lucide-react";
import { usePersistentState } from "../hooks/usePersistentState.js";
import { useClock } from "../hooks/useClock.js";
import { useWorkTasks } from "../hooks/useWorkTasks.js";
import { useWorkProjects } from "../hooks/useWorkProjects.js";
import { useWorkTags } from "../hooks/useWorkTags.js";
import { useHours } from "../hooks/useHours.js";
import { useProjects } from "../hooks/useProjects.js";
import { useBookingCodes } from "../hooks/useBookingCodes.js";
import { nowHHMM } from "../lib/timeUtils.js";
import { toISO } from "../lib/dateUtils.js";
import { isWeekend } from "../lib/hours2/week.js";
import { isOpen, toggledStatus } from "../lib/worktasks/model.js";
import { actualByTask, runningSegment, codeForTask } from "../lib/worktasks/time.js";
import NowView from "../views/work/NowView.jsx";
import WorkProjectsView from "../views/work/WorkProjectsView.jsx";
import BoardView from "../views/work/BoardView.jsx";
import LogView from "../views/work/LogView.jsx";
import { WorkTaskSheet } from "../views/work/WorkTaskSheet.jsx";
import { CodePickSheet } from "../views/work/CodePickSheet.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { TopBar } from "../components/TopBar.jsx";

const NAV_ITEMS = [
  { key: "now", label: "now", icon: Zap },
  { key: "projects", label: "projects", icon: FolderKanban },
  { key: "board", label: "board", icon: Columns3 },
  { key: "log", label: "log", icon: ScrollText },
];

const VIEWS = { now: NowView, board: BoardView, log: LogView };

// Work tasks — see ARCHITECTURE.md §7 ("Work tasks"). A fork of the personal
// Task manager, not a mode of it. Like HoursApp, all data is loaded once here
// and passed down as one `store`. It also loads Hours' worklog, projects and
// codes, for ▶ (clock in on a task) and per-task actual time. Hours keeps
// its own in-memory copy; only one app is open at a time and each reloads
// on open, so the two never write over each other.
export default function WorkTasksApp({ onHome }) {
  const [tab, setTab] = usePersistentState("manifest.work.tab", "now");
  const [projectId, setProjectId] = useState(null); // projects tab drill-down
  const [editing, setEditing] = useState(null); // task in the edit sheet
  const [picking, setPicking] = useState(null); // task waiting on a code pick
  const now = useClock(30000);

  const work = useWorkTasks();
  const workProjects = useWorkProjects();
  const tags = useWorkTags();
  const hours = useHours();
  const hoursProjects = useProjects();
  const codes = useBookingCodes();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, projectId]);

  const todayISO = toISO(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const running = runningSegment(hours.worklog, todayISO);
  // Hours never shows or counts weekends, so ▶ isn't offered then — time
  // logged on a Saturday would be invisible there.
  const canClock = !isWeekend(todayISO);

  // Clock times use the real current minute, not the 30s-stale `now`.
  const stopWork = () => hours.clockOut(toISO(new Date()), nowHHMM());

  // Status changes go through here so finishing the running task also
  // stops the clock.
  const setStatus = (task, status) => {
    work.setStatus(task.id, status);
    if ((status === "done" || status === "dropped") && running?.taskId === task.id) stopWork();
  };

  const beginWork = (task, codeId) => {
    const at = new Date();
    hours.clockIn(toISO(at), nowHHMM(at), codeId, task.id);
    if (task.status !== "doing" && isOpen(task)) work.setStatus(task.id, "doing");
  };

  const store = {
    loading: work.loading || workProjects.loading || tags.loading || hours.loading || codes.loading || hoursProjects.loading,
    tasks: work.tasks,
    workProjects: workProjects.projects,
    addProject: workProjects.addProject,
    updateProject: workProjects.updateProject,
    removeProject: workProjects.removeProject,
    tags: tags.tags,
    addTag: tags.addTag,
    updateTag: tags.updateTag,
    removeTag: tags.removeTag,
    stripTag: work.stripTag,
    removeTask: work.removeTask,
    hoursProjects: hoursProjects.projects,
    codes: codes.codes,
    actual: actualByTask(hours.worklog, { todayISO, nowMin }),
    running,
    canClock,
    todayISO,
    nowMin,
    nowMs: now.getTime(),
    goTab: setTab,
    openTask: (task) => setEditing(task),
    newTask: (defaults) => setEditing({ isNew: true, ...defaults }),
    toggle: (task) => setStatus(task, toggledStatus(task)),
    saveTask: (task, fields) => {
      if (task.isNew) work.addTask(fields);
      else {
        work.updateTask(task.id, fields);
        if ((fields.status === "done" || fields.status === "dropped") && running?.taskId === task.id) stopWork();
      }
    },
    startWork: (task) => {
      if (!canClock || running?.taskId === task.id) return;
      const codeId = codeForTask(task, workProjects.projects, codes.codes);
      if (codeId) beginWork(task, codeId);
      else setPicking(task);
    },
    beginWork,
    stopWork,
  };

  const onBack = () => {
    if (tab === "projects" && projectId) setProjectId(null);
    else onHome();
  };

  const projectTitle =
    projectId === "inbox" ? "inbox" : projectId ? workProjects.projects.find((p) => p.id === projectId)?.name?.toLowerCase() : null;
  const title = ["work", tab === "now" ? null : tab, tab === "projects" ? projectTitle : null].filter(Boolean).join(" / ");

  const View = VIEWS[tab];
  // Re-read the task being edited from the store, so the sheet never shows
  // a stale copy (e.g. after ▶ flipped it to doing).
  const editingTask = editing && (editing.isNew ? editing : work.tasks.find((t) => t.id === editing.id));

  return (
    <>
      <TopBar title={title} onBack={onBack} />
      {tab === "projects" ? <WorkProjectsView store={store} projectId={projectId} openProject={setProjectId} /> : View ? <View store={store} /> : <NowView store={store} />}
      <NavBar
        active={tab}
        onChange={(k) => {
          if (k === "projects") setProjectId(null);
          setTab(k);
        }}
        items={NAV_ITEMS}
      />
      {editingTask && <WorkTaskSheet key={editingTask.id || "new"} task={editingTask} store={store} onClose={() => setEditing(null)} />}
      {picking && <CodePickSheet task={picking} store={store} onClose={() => setPicking(null)} />}
    </>
  );
}
