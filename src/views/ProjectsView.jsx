import { useRef, useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { COLORS, TAG_PALETTE } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";
import { useProjects } from "../hooks/useProjects.js";
import { NAV_HEIGHT } from "../components/NavBar.jsx";
import { TOPBAR_HEIGHT } from "../components/TopBar.jsx";
import { ColorPicker } from "../components/ColorPicker.jsx";

function ProjectForm({ name, setName, color, setColor, onSave, onCancel, onDelete, inputRef }) {
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
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "14px",
            width: "100%",
          }}
        />
      </div>
      <div style={{ marginBottom: "16px" }}>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
        {onDelete ? (
          <button
            onClick={onDelete}
            style={{
              background: "none",
              border: "none",
              color: COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              cursor: "pointer",
              padding: "7px 4px",
            }}
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
              fontFamily: "'IBM Plex Mono', monospace",
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
            disabled={!name.trim()}
            style={{
              background: name.trim() ? COLORS.amber : COLORS.border,
              border: "none",
              color: name.trim() ? COLORS.bg : COLORS.dim,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12.5px",
              fontWeight: 600,
              padding: "7px 14px",
              borderRadius: "6px",
              cursor: name.trim() ? "pointer" : "default",
            }}
          >
            save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsView() {
  const { projects, loading, addProject, updateProject, removeProject } = useProjects();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(TAG_PALETTE[0]);
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addColor, setAddColor] = useState(TAG_PALETTE[0]);
  const editRef = useRef(null);
  const addRef = useRef(null);
  const now = useClock();

  useEffect(() => {
    if (editingId !== null && editRef.current) editRef.current.focus();
  }, [editingId]);

  useEffect(() => {
    if (adding && addRef.current) addRef.current.focus();
  }, [adding]);

  const startEdit = (project) => {
    setAdding(false);
    setEditingId(project.id);
    setEditName(project.name);
    setEditColor(project.color);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    updateProject(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const deleteProject = () => {
    removeProject(editingId);
    setEditingId(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setAddName("");
    setAddColor(TAG_PALETTE[projects.length % TAG_PALETTE.length]);
    setAdding(true);
  };

  const saveAdd = () => {
    if (!addName.trim()) return;
    addProject({ name: addName.trim(), color: addColor });
    setAdding(false);
  };

  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)",
        fontFamily: "'IBM Plex Mono', monospace",
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
            {loading ? "loading…" : `${projects.length} defined`}
          </div>
        </div>

        {/* List */}
        <div>
          {projects.map((project) =>
            editingId === project.id ? (
              <div key={project.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
                <ProjectForm
                  name={editName}
                  setName={setEditName}
                  color={editColor}
                  setColor={setEditColor}
                  onSave={saveEdit}
                  onCancel={() => setEditingId(null)}
                  onDelete={deleteProject}
                  inputRef={editRef}
                />
              </div>
            ) : (
              <div
                key={project.id}
                onClick={() => startEdit(project)}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}
              >
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: project.color, flexShrink: 0 }} />
                <span style={{ fontSize: "14px", color: COLORS.text, flex: 1 }}>{project.name}</span>
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
            <ProjectForm name={addName} setName={setAddName} color={addColor} setColor={setAddColor} onSave={saveAdd} onCancel={() => setAdding(false)} inputRef={addRef} />
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
