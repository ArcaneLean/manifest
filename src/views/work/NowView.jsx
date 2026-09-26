// Work tasks' default tab — see ARCHITECTURE.md §7 ("Work tasks").
import { COLORS } from "../../theme/colors.js";
import { addDaysISO, weekStartOf } from "../../lib/hours2/week.js";
import { isOpen } from "../../lib/worktasks/model.js";
import { nowSections, effortDueBy } from "../../lib/worktasks/select.js";
import { Page, Header, fmt, linkStyle } from "../hours/ui.jsx";
import { TaskGroup } from "./WorkTaskRow.jsx";
import { WorkingStrip } from "./WorkingStrip.jsx";
import { Fab } from "./ui.jsx";

export default function NowView({ store }) {
  const { tasks, todayISO, loading, newTask, goTab } = store;
  const s = nowSections(tasks, todayISO);
  const open = tasks.filter(isOpen).length;
  const weekEnd = addDaysISO(weekStartOf(todayISO), 6);
  const dueThisWeek = effortDueBy(tasks, weekEnd);

  const sub = loading
    ? "loading…"
    : [`${open} open`, s.inboxCount ? `${s.inboxCount} in inbox` : null, dueThisWeek ? `${fmt(dueThisWeek)} est due this week` : null].filter(Boolean).join(" · ");
  const shown = s.doing.length + s.overdue.length + s.dueSoon.length + s.high.length + s.waiting.length;

  return (
    <Page>
      <Header title="~/work" sub={sub} />
      <WorkingStrip store={store} />
      <TaskGroup label="doing" tasks={s.doing} store={store} color={COLORS.amber} />
      <TaskGroup label="overdue" tasks={s.overdue} store={store} color={COLORS.amber} />
      <TaskGroup label="due in 7 days" tasks={s.dueSoon} store={store} />
      <TaskGroup label="high priority" tasks={s.high} store={store} />
      <TaskGroup label="waiting" tasks={s.waiting} store={store} color={COLORS.sage} />

      {!loading && tasks.length === 0 && (
        <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>// no work tasks yet — + to add one</div>
      )}
      {!loading && tasks.length > 0 && shown === 0 && (
        <div style={{ padding: "32px 20px 8px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>// nothing pressing</div>
      )}
      {s.otherCount > 0 && (
        <div style={{ padding: "16px 20px", fontSize: "12px", color: COLORS.dim }}>
          {s.otherCount} more todo ·{" "}
          <span onClick={() => goTab("board")} style={linkStyle}>
            board →
          </span>
        </div>
      )}
      <Fab onClick={() => newTask({})} label="add work task" />
    </Page>
  );
}
