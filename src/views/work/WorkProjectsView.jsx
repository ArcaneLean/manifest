// Work projects list + one project's tasks, plus work tags — see
// ARCHITECTURE.md §7 ("Work tasks"). A work project is its own entity,
// optionally linked to a Hours booking code (what ▶ clocks in on).
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { COLORS, TAG_PALETTE } from "../../theme/colors.js";
import { ColorPicker } from "../../components/ColorPicker.jsx";
import { Segmented } from "../../components/Segmented.jsx";
import { TagChip } from "../../components/TagChip.jsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { PROJECT_STATUSES } from "../../lib/worktasks/model.js";
import { projectStats, sortTasks } from "../../lib/worktasks/select.js";
import { actualByProject } from "../../lib/worktasks/time.js";
import { Page, Header, Section, PickChip, Badge, BracketCheck, Dot, fmt, linkStyle, primaryBtnStyle, secondaryBtnStyle, disabledStyle, MONO } from "../hours/ui.jsx";
import { codeLabel, codeColor, pickableCodes } from "../hours/codes.js";
import { TaskGroup } from "./WorkTaskRow.jsx";
import { Fab, Field, fieldStyle } from "./ui.jsx";

function statsLine(stats, actualMin) {
  const parts = [`${stats?.open || 0} open`];
  if (stats?.effortOpen) parts.push(`${fmt(stats.effortOpen)} est left`);
  if (actualMin) parts.push(`${fmt(actualMin)} worked`);
  return parts.join(" · ");
}

function ProjectForm({ project, store, onDone }) {
  const { codes, hoursProjects, tasks, addProject, updateProject, removeProject } = store;
  const [name, setName] = useState(project?.name || "");
  const [color, setColor] = useState(project?.color || TAG_PALETTE[store.workProjects.length % TAG_PALETTE.length]);
  const [codeId, setCodeId] = useState(project?.codeId || null);
  const [status, setStatus] = useState(project?.status || "active");
  const [archived, setArchived] = useState(!!project?.archived);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const options = pickableCodes(codes, hoursProjects);
  const linkedGone = codeId && !options.some((c) => c.id === codeId);
  const hasTasks = project && tasks.some((t) => t.projectId === project.id);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (project) updateProject(project.id, { name: trimmed, color, codeId, status, archived });
    else addProject({ name: trimmed, color, codeId, status });
    onDone();
  };

  return (
    <Section label={project ? "edit project" : "new project"}>
      <input
        autoFocus={!project}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onDone();
        }}
        placeholder="project name, e.g. MDS"
        className="task-input"
        style={{ ...fieldStyle, fontSize: "14px", marginBottom: "14px" }}
      />
      <Field label="color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="hours code — what ▶ clocks in on">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <PickChip label="none" color={COLORS.dim} active={!codeId} onClick={() => setCodeId(null)} />
          {linkedGone && <PickChip label={`${codeLabel(codeId, codes, hoursProjects)} (archived)`} color={COLORS.dim} active />}
          {options.map((c) => (
            <PickChip key={c.id} label={codeLabel(c.id, codes, hoursProjects)} color={codeColor(c.id, codes, hoursProjects)} active={codeId === c.id} onClick={() => setCodeId(c.id)} />
          ))}
        </div>
      </Field>
      <Field label="status">
        <Segmented value={status} onChange={setStatus} options={PROJECT_STATUSES.map((s) => ({ key: s, label: s }))} />
      </Field>
      {project && (
        <div style={{ marginBottom: "16px" }}>
          <BracketCheck checked={archived} onChange={setArchived} label="archived (hidden from lists and pickers)" />
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {project && !hasTasks ? (
          <button onClick={() => setConfirmDelete(true)} style={{ background: "none", border: "none", color: COLORS.dim, fontFamily: MONO, fontSize: "12px", cursor: "pointer", padding: "7px 4px" }}>
            delete
          </button>
        ) : (
          <span style={{ fontSize: "10.5px", color: COLORS.dim }}>{project ? "has tasks — archive instead" : ""}</span>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onDone} style={secondaryBtnStyle}>
            cancel
          </button>
          <button onClick={save} disabled={!name.trim()} style={disabledStyle(primaryBtnStyle, !name.trim())}>
            save
          </button>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="delete project?"
          message={`"${project.name}" has no tasks, so nothing else changes.`}
          confirmLabel="delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            removeProject(project.id);
            onDone(true);
          }}
        />
      )}
    </Section>
  );
}

function TagsSection({ store }) {
  const { tags, addTag, updateTag, removeTag, stripTag } = store;
  const [editing, setEditing] = useState(null); // tag, or {} for new
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_PALETTE[0]);

  const begin = (tag) => {
    setEditing(tag);
    setName(tag.name || "");
    setColor(tag.color || TAG_PALETTE[tags.length % TAG_PALETTE.length]);
  };
  const save = () => {
    if (!name.trim()) return;
    if (editing.id) updateTag(editing.id, { name: name.trim(), color });
    else addTag({ name: name.trim(), color });
    setEditing(null);
  };

  return (
    <Section
      label="work tags"
      right={
        !editing && (
          <span onClick={() => begin({})} style={linkStyle}>
            + tag
          </span>
        )
      }
    >
      {editing ? (
        <>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(null);
            }}
            placeholder="tag name"
            style={{ ...fieldStyle, marginBottom: "12px" }}
          />
          <div style={{ marginBottom: "14px" }}>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {editing.id ? (
              <button
                onClick={() => {
                  stripTag(editing.id);
                  removeTag(editing.id);
                  setEditing(null);
                }}
                style={{ background: "none", border: "none", color: COLORS.dim, fontFamily: MONO, fontSize: "12px", cursor: "pointer", padding: "7px 4px" }}
              >
                delete tag
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setEditing(null)} style={secondaryBtnStyle}>
                cancel
              </button>
              <button onClick={save} disabled={!name.trim()} style={disabledStyle(primaryBtnStyle, !name.trim())}>
                save
              </button>
            </div>
          </div>
        </>
      ) : tags.length === 0 ? (
        <div style={{ fontSize: "12px", color: COLORS.dim }}>// none yet</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {tags.map((tag) => (
            <span key={tag.id} onClick={() => begin(tag)} style={{ cursor: "pointer" }}>
              <TagChip tag={tag} />
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}

function ProjectDetail({ projectId, store, onBack }) {
  const { tasks, workProjects, codes, hoursProjects, actual, newTask } = store;
  const [editing, setEditing] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const isInbox = projectId === "inbox";
  const project = !isInbox && workProjects.find((p) => p.id === projectId);
  if (!isInbox && !project) return null;

  const own = tasks.filter((t) => (isInbox ? !t.projectId : t.projectId === projectId));
  const by = (s) => sortTasks(own.filter((t) => t.status === s));
  const stats = projectStats(own)[isInbox ? "inbox" : projectId];
  const worked = actualByProject(own, actual)[isInbox ? "inbox" : projectId];
  const closed = own.filter((t) => t.status === "done" || t.status === "dropped").length;

  return (
    <Page>
      <Header
        title={isInbox ? "~/work/inbox" : project.name}
        sub={statsLine(stats, worked)}
        left={!isInbox && <Dot color={project.color} size={10} />}
        right={
          !isInbox &&
          !editing && (
            <span onClick={() => setEditing(true)} style={linkStyle}>
              edit
            </span>
          )
        }
      />
      {!isInbox && !editing && (
        <div style={{ padding: "10px 20px", fontSize: "11.5px", color: COLORS.dim, borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {project.codeId ? (
            <>
              <Dot color={codeColor(project.codeId, codes, hoursProjects)} size={6} />
              ▶ clocks in on {codeLabel(project.codeId, codes, hoursProjects)}
              {codes.find((c) => c.id === project.codeId)?.archived && <Badge>code archived</Badge>}
            </>
          ) : (
            "no hours code linked — ▶ will ask"
          )}
          {project.status !== "active" && <Badge>{project.status}</Badge>}
          {project.archived && <Badge>archived</Badge>}
        </div>
      )}
      {editing && <ProjectForm project={project} store={store} onDone={(deleted) => (deleted ? onBack() : setEditing(false))} />}
      <TaskGroup label="doing" tasks={by("doing")} store={store} showProject={false} color={COLORS.amber} />
      <TaskGroup label="todo" tasks={by("todo")} store={store} showProject={false} />
      <TaskGroup label="waiting" tasks={by("waiting")} store={store} showProject={false} color={COLORS.sage} />
      {closed > 0 && (
        <div style={{ padding: "14px 20px", fontSize: "12px", color: COLORS.dim }}>
          <span onClick={() => setShowClosed((v) => !v)} style={linkStyle}>
            {showClosed ? "hide" : "show"} {closed} done/dropped
          </span>
        </div>
      )}
      {showClosed && (
        <>
          <TaskGroup label="done" tasks={by("done")} store={store} showProject={false} />
          <TaskGroup label="dropped" tasks={by("dropped")} store={store} showProject={false} />
        </>
      )}
      {own.length === 0 && <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>// no tasks yet</div>}
      <Fab onClick={() => newTask({ projectId: isInbox ? null : projectId })} label="add work task" />
    </Page>
  );
}

export default function WorkProjectsView({ store, projectId, openProject }) {
  const { tasks, workProjects, codes, hoursProjects, actual, loading } = store;
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  if (projectId) return <ProjectDetail projectId={projectId} store={store} onBack={() => openProject(null)} />;

  const stats = projectStats(tasks);
  const worked = actualByProject(tasks, actual);
  const rank = { active: 0, "on-hold": 1, done: 2 };
  const visible = workProjects
    .filter((p) => showArchived || !p.archived)
    .sort((a, b) => !!a.archived - !!b.archived || rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));
  const archivedCount = workProjects.filter((p) => p.archived).length;
  const activeCount = workProjects.filter((p) => !p.archived && p.status === "active").length;

  const row = (key, { color, name, sub, badges, onClick }) => (
    <div key={key} onClick={onClick} className="task-row" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 20px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}>
      <Dot color={color} size={10} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{name}</span>
          {badges}
        </div>
        <div style={{ fontSize: "11px", color: COLORS.dim, marginTop: "3px" }}>{sub}</div>
      </div>
      <ChevronRight size={15} color={COLORS.dim} />
    </div>
  );

  return (
    <Page>
      <Header title="~/work/projects" sub={loading ? "loading…" : `${activeCount} active`} />
      {adding && <ProjectForm store={store} onDone={() => setAdding(false)} />}
      {stats.inbox?.open > 0 &&
        row("inbox", { color: COLORS.dim, name: "inbox", sub: statsLine(stats.inbox, worked.inbox), onClick: () => openProject("inbox") })}
      {visible.map((p) =>
        row(p.id, {
          color: p.color,
          name: p.name,
          sub: (
            <>
              {statsLine(stats[p.id], worked[p.id])}
              {p.codeId && <span style={{ color: codeColor(p.codeId, codes, hoursProjects) }}> · {codeLabel(p.codeId, codes, hoursProjects)}</span>}
            </>
          ),
          badges: (
            <>
              {p.status !== "active" && <Badge>{p.status}</Badge>}
              {p.archived && <Badge>archived</Badge>}
            </>
          ),
          onClick: () => openProject(p.id),
        })
      )}
      {!loading && workProjects.length === 0 && !adding && (
        <div style={{ padding: "32px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>// no projects yet — + to add one</div>
      )}
      {archivedCount > 0 && (
        <div style={{ padding: "14px 20px", fontSize: "12px" }}>
          <span onClick={() => setShowArchived((v) => !v)} style={linkStyle}>
            {showArchived ? "hide" : "show"} {archivedCount} archived
          </span>
        </div>
      )}
      <TagsSection store={store} />
      {!adding && <Fab onClick={() => setAdding(true)} label="add project" />}
    </Page>
  );
}
