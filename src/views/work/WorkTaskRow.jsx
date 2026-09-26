// One work task in any list — see ARCHITECTURE.md §7 ("Work tasks"). Left:
// checkbox (todo ↔ done). Middle: opens the edit sheet. Right: ▶ starts
// working on it in Hours, ■ stops when it's the running task.
import { Flag, Hourglass, Play, Square, Clock, ListChecks, Link2 } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { formatShortDate } from "../../lib/dateUtils.js";
import { Checkbox } from "../../components/Checkbox.jsx";
import { TagChip } from "../../components/TagChip.jsx";
import { priorityOf, isOpen, notStartedYet } from "../../lib/worktasks/model.js";
import { isOverdue, daysWaiting } from "../../lib/worktasks/select.js";
import { fmt, Dot } from "../hours/ui.jsx";
import { counter } from "./ui.jsx";

const meta = { display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", color: COLORS.dim, whiteSpace: "nowrap" };

export function WorkTaskRow({ task, store, showProject = true }) {
  const { workProjects, tags, actual, running, canClock, todayISO, nowMs, toggle, openTask, startWork, stopWork } = store;
  const open = isOpen(task);
  const p = priorityOf(task);
  const project = task.projectId && workProjects.find((x) => x.id === task.projectId);
  const overdue = isOverdue(task, todayISO);
  const isRunning = running?.taskId === task.id;
  const spent = actual[task.id] || 0;
  const checklist = task.checklist || [];

  return (
    <div
      className="task-row"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "13px 16px 13px 14px",
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${open ? p.color : COLORS.border}`,
        background: isRunning ? `${COLORS.amber}0d` : undefined,
      }}
    >
      <span onClick={() => toggle(task)} style={{ cursor: "pointer" }} aria-label={open ? "mark done" : "reopen"}>
        <Checkbox done={!open} />
      </span>
      <div onClick={() => openTask(task)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div
          style={{
            fontSize: "14px",
            lineHeight: 1.45,
            color: open ? COLORS.text : COLORS.dim,
            textDecorationLine: open ? "none" : "line-through",
            textDecorationColor: COLORS.dim,
            wordBreak: "break-word",
          }}
        >
          {task.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
          {showProject && (
            <span style={meta}>
              <Dot color={project ? project.color : COLORS.dim} size={6} />
              <span style={{ color: project ? project.color : COLORS.dim }}>{project ? project.name : "inbox"}</span>
            </span>
          )}
          {task.status === "doing" && <span style={{ ...meta, color: COLORS.amber }}>doing</span>}
          {task.status === "waiting" && (
            <span style={{ ...meta, color: COLORS.sage }}>
              {counter(daysWaiting(task, nowMs))} waiting{task.waitingOn ? ` · ${task.waitingOn}` : ""}
            </span>
          )}
          {task.status === "dropped" && <span style={meta}>dropped</span>}
          {task.dueDate && (
            <span style={{ ...meta, color: overdue ? COLORS.amber : COLORS.dim, fontWeight: overdue && task.hardDeadline ? 600 : 400 }}>
              <Flag size={10} />
              {task.hardDeadline ? "deadline" : "due"} {formatShortDate(task.dueDate)}
            </span>
          )}
          {open && notStartedYet(task, todayISO) && (
            <span style={meta}>
              <Hourglass size={10} />
              starts {formatShortDate(task.startDate)}
            </span>
          )}
          {(task.effortMin > 0 || spent > 0) && (
            <span style={{ ...meta, color: task.effortMin && spent > task.effortMin ? COLORS.amber : COLORS.dim }}>
              <Clock size={10} />
              {spent > 0 ? fmt(spent) : ""}
              {spent > 0 && task.effortMin ? " / " : ""}
              {task.effortMin ? `${fmt(task.effortMin)}${spent > 0 ? "" : " est"}` : ""}
            </span>
          )}
          {checklist.length > 0 && (
            <span style={meta}>
              <ListChecks size={10} />
              {checklist.filter((c) => c.done).length}/{checklist.length}
            </span>
          )}
          {task.link && (
            <span style={meta}>
              <Link2 size={10} />
            </span>
          )}
          {(task.tags || []).map((id) => {
            const tag = tags.find((t) => t.id === id);
            return tag ? <TagChip key={id} tag={tag} small /> : null;
          })}
        </div>
      </div>
      {isRunning ? (
        <span onClick={stopWork} style={{ cursor: "pointer", flexShrink: 0, paddingTop: "3px" }} aria-label="stop working">
          <Square size={15} color={COLORS.amber} fill={COLORS.amber} />
        </span>
      ) : (
        open &&
        canClock && (
          <span onClick={() => startWork(task)} style={{ cursor: "pointer", flexShrink: 0, paddingTop: "3px" }} aria-label="start working">
            <Play size={15} color={COLORS.dim} />
          </span>
        )
      )}
    </div>
  );
}

// Labelled group of rows, for Now / project detail.
export function TaskGroup({ label, tasks, store, showProject, right, color = COLORS.dim }) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 20px",
          fontSize: "10.5px",
          letterSpacing: "0.5px",
          color,
          background: COLORS.panel,
          borderBottom: `1px solid ${COLORS.border}`,
          textTransform: "uppercase",
        }}
      >
        <span>
          {label} · {tasks.length}
        </span>
        {right}
      </div>
      {tasks.map((t) => (
        <WorkTaskRow key={t.id} task={t} store={store} showProject={showProject} />
      ))}
    </div>
  );
}
