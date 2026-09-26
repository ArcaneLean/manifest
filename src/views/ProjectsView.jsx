import { useRef, useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { COLORS, TAG_PALETTE } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";
import { NAV_HEIGHT } from "../components/NavBar.jsx";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { ColorPicker } from "../components/ColorPicker.jsx";

const MONO = "'IBM Plex Mono', monospace";

const smallInputStyle = {
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  borderRadius: "5px",
  outline: "none",
  color: COLORS.text,
  caretColor: COLORS.amber,
  fontFamily: MONO,
  fontSize: "12px",
  padding: "5px 7px",
  minWidth: 0,
};

// A project's booking codes (Hours 2.0 — see ARCHITECTURE.md §7). Each row:
// name ("billable"), the employer system's code (optional), and either
// delete (never used) or archive (used — kept so history keeps its label).
function CodesEditor({ drafts, setDrafts, usedCodeIds }) {
  const edit = (i, patch) => setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const remove = (i) => setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "8px" }}>booking codes</div>
      {drafts.map((d, i) => {
        const used = d.id && usedCodeIds.has(d.id);
        return (
          <div key={d.id || `new-${i}`} style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px", opacity: d.archived ? 0.55 : 1 }}>
            <input value={d.name} onChange={(e) => edit(i, { name: e.target.value })} placeholder="name (e.g. billable)" style={{ ...smallInputStyle, flex: 1.4 }} />
            <input value={d.code} onChange={(e) => edit(i, { code: e.target.value })} placeholder="code" style={{ ...smallInputStyle, flex: 1 }} />
            {used ? (
              <span
                onClick={() => edit(i, { archived: !d.archived })}
                style={{ fontSize: "10.5px", color: d.archived ? COLORS.amber : COLORS.dim, cursor: "pointer", width: "52px", textAlign: "right" }}
              >
                {d.archived ? "restore" : "archive"}
              </span>
            ) : (
              <span onClick={() => remove(i)} style={{ cursor: "pointer", width: "52px", display: "flex", justifyContent: "flex-end" }} aria-label="remove code">
                <X size={14} color={COLORS.dim} />
              </span>
            )}
          </div>
        );
      })}
      <div
        onClick={() => setDrafts((prev) => [...prev, { name: "", code: "", archived: false }])}
        style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: COLORS.dim, cursor: "pointer", marginTop: "2px" }}
      >
        <Plus size={12} /> add code
      </div>
    </div>
  );
}

function ProjectForm({ name, setName, color, setColor, codeDrafts, setCodeDrafts, usedCodeIds, onSave, onCancel, onDelete, inputRef }) {
  const valid = name.trim() && codeDrafts.some((d) => !d.archived && d.name.trim());
  return (
    <div style={{ padding: "14px 16px", background: COLORS.panel, border: `1px solid ${COLORS.borderBright}`, borderRadius: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
        <span style={{ color: COLORS.amber, fontSize: "14px", flexShrink: 0 }}>{">"}</span>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter") onSave();
          }}
          placeholder="project name"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: COLORS.text,
            caretColor: COLORS.amber,
            fontFamily: MONO,
            fontSize: "14px",
            width: "100%",
          }}
        />
      </div>
      <div style={{ marginBottom: "16px" }}>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <CodesEditor drafts={codeDrafts} setDrafts={setCodeDrafts} usedCodeIds={usedCodeIds} />
      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
        {onDelete ? (
          <button
            onClick={onDelete}
            style={{ background: "none", border: "none", color: COLORS.dim, fontFamily: MONO, fontSize: "12px", cursor: "pointer", padding: "7px 4px" }}
          >
            delete project
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.dim,
              fontFamily: MONO,
              fontSize: "12.5px",
              padding: "7px 14px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            cancel
          </button>
          <button
            onClick={onSave}
            disabled={!valid}
            style={{
              background: valid ? COLORS.amber : COLORS.border,
              border: "none",
              color: valid ? COLORS.bg : COLORS.dim,
              fontFamily: MONO,
              fontSize: "12.5px",
              fontWeight: 600,
              padding: "7px 14px",
              borderRadius: "6px",
              cursor: valid ? "pointer" : "default",
            }}
          >
            save
          </button>
        </div>
      </div>
    </div>
  );
}

// Codes referenced anywhere — logged segments, bookings, the opening bank —
// can only be archived, not deleted.
function usedCodeIdsOf(store) {
  const used = new Set();
  for (const day of Object.values(store.worklog)) for (const s of day.segments || []) if (s.codeId) used.add(s.codeId);
  for (const b of Object.values(store.bookings)) for (const l of b.lines || []) used.add(l.codeId);
  for (const id of Object.keys(store.settings.opening?.perCode || {})) used.add(id);
  return used;
}

export default function ProjectsView({ store }) {
  const { projects, codes, projectsLoading: loading, addProject, updateProject, removeProject, addCode, updateCode, removeCode } = store;
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(TAG_PALETTE[0]);
  const [codeDrafts, setCodeDrafts] = useState([]);
  const [adding, setAdding] = useState(false);
  const editRef = useRef(null);
  const addRef = useRef(null);
  const now = useClock();
  const usedCodeIds = usedCodeIdsOf(store);

  useEffect(() => {
    if (editingId !== null && editRef.current) editRef.current.focus();
  }, [editingId]);

  useEffect(() => {
    if (adding && addRef.current) addRef.current.focus();
  }, [adding]);

  const codesOf = (projectId) => codes.filter((c) => c.projectId === projectId);

  const startEdit = (project) => {
    setAdding(false);
    setEditingId(project.id);
    setEditName(project.name);
    setEditColor(project.color);
    setCodeDrafts(codesOf(project.id).map((c) => ({ ...c, code: c.code || "" })));
  };

  // Diff the drafts against the stored codes: new rows are added, changed
  // rows updated, rows removed from the form deleted (the form only offers
  // removal for never-used codes).
  const saveCodes = (projectId) => {
    const original = codesOf(projectId);
    const keptIds = new Set(codeDrafts.filter((d) => d.id).map((d) => d.id));
    for (const c of original) if (!keptIds.has(c.id)) removeCode(c.id);
    for (const d of codeDrafts) {
      const name = d.name.trim();
      if (!d.id) {
        if (name) addCode({ projectId, name, code: d.code.trim() });
        continue;
      }
      const o = original.find((c) => c.id === d.id);
      const patch = { name: name || o.name, code: d.code.trim(), archived: !!d.archived };
      if (!o || o.name !== patch.name || (o.code || "") !== patch.code || !!o.archived !== patch.archived) updateCode(d.id, patch);
    }
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    updateProject(editingId, { name: editName.trim(), color: editColor });
    saveCodes(editingId);
    setEditingId(null);
  };

  const deleteProject = () => {
    removeProject(editingId);
    setEditingId(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setEditName("");
    setEditColor(TAG_PALETTE[projects.length % TAG_PALETTE.length]);
    setCodeDrafts([{ name: "default", code: "", archived: false }]);
    setAdding(true);
  };

  const saveAdd = () => {
    if (!editName.trim()) return;
    const project = addProject({ name: editName.trim(), color: editColor });
    saveCodes(project.id);
    setAdding(false);
  };

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  const formProps = { name: editName, setName: setEditName, color: editColor, setColor: setEditColor, codeDrafts, setCodeDrafts, usedCodeIds };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)",
        fontFamily: MONO,
        color: COLORS.text,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px", padding: `${TOPBAR_HEIGHT}px 0 ${100 + NAV_HEIGHT}px 0` }}>
        {/* Header */}
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>~/hours/projects</div>
          <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "4px" }}>
            {loading ? "loading…" : `${projects.length} defined · ${codes.filter((c) => !c.archived).length} active codes`}
          </div>
        </div>

        {/* List */}
        <div>
          {projects.map((project) =>
            editingId === project.id ? (
              <div key={project.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
                <ProjectForm {...formProps} onSave={saveEdit} onCancel={() => setEditingId(null)} onDelete={deleteProject} inputRef={editRef} />
              </div>
            ) : (
              <div
                key={project.id}
                onClick={() => startEdit(project)}
                style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}
              >
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: project.color, flexShrink: 0, marginTop: "3px" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", color: COLORS.text }}>{project.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                    {codesOf(project.id).map((c) => (
                      <span
                        key={c.id}
                        style={{
                          fontSize: "10.5px",
                          padding: "2px 7px",
                          borderRadius: "4px",
                          border: `1px solid ${c.archived ? COLORS.border : project.color}`,
                          color: c.archived ? COLORS.dim : project.color,
                          textDecoration: c.archived ? "line-through" : "none",
                        }}
                      >
                        {c.name}
                        {c.code ? ` · ${c.code}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    removeProject(project.id);
                  }}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  <X size={14} color={COLORS.dim} />
                </span>
              </div>
            )
          )}

          {!loading && projects.length === 0 && !adding && (
            <div style={{ padding: "40px 20px", color: COLORS.dim, fontSize: "13px", textAlign: "center" }}>
              // no projects yet
            </div>
          )}
        </div>

        {/* Add panel */}
        {adding && (
          <div style={{ margin: "16px 16px 0" }}>
            <ProjectForm {...formProps} onSave={saveAdd} onCancel={() => setAdding(false)} inputRef={addRef} />
          </div>
        )}

        {/* FAB */}
        {!adding && (
          <button
            className="fab"
            onClick={startAdd}
            style={{
              position: "fixed",
              bottom: `${28 + NAV_HEIGHT}px`,
              right: "calc(50% - 210px + 20px)",
              width: "52px",
              height: "52px",
              borderRadius: "8px",
              background: COLORS.amber,
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(255,176,0,0.35), 0 4px 12px rgba(0,0,0,0.5)",
              cursor: "pointer",
            }}
          >
            <Plus size={24} color={COLORS.bg} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
