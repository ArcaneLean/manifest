// Asked when ▶ is tapped on a task whose project has no (usable) Hours code
// — see ARCHITECTURE.md §7 ("Start working from a task").
import { useState } from "react";
import { COLORS } from "../../theme/colors.js";
import { PickChip, BracketCheck, primaryBtnStyle, secondaryBtnStyle, disabledStyle } from "../hours/ui.jsx";
import { codeLabel, codeColor, pickableCodes } from "../hours/codes.js";
import { Sheet, Field } from "./ui.jsx";

export function CodePickSheet({ task, store, onClose }) {
  const { codes, hoursProjects, workProjects, beginWork, updateProject } = store;
  const project = task.projectId && workProjects.find((p) => p.id === task.projectId);
  const options = pickableCodes(codes, hoursProjects);
  const [pick, setPick] = useState(null);
  const [remember, setRemember] = useState(true);

  const confirm = () => {
    if (!pick) return;
    if (project && remember) updateProject(project.id, { codeId: pick });
    beginWork(task, pick);
    onClose();
  };

  return (
    <Sheet title="clock in on which code?" onClose={onClose}>
      <div style={{ fontSize: "12.5px", marginBottom: "14px" }}>
        ▶ {task.title}
        <div style={{ fontSize: "11px", color: COLORS.dim, marginTop: "4px" }}>
          {project ? `${project.name} has no hours code linked` : "inbox task — no project, so no hours code"}
        </div>
      </div>
      {options.length === 0 ? (
        <div style={{ fontSize: "12px", color: COLORS.dim, marginBottom: "14px" }}>// no booking codes yet — add a project in hours first</div>
      ) : (
        <Field>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {options.map((c) => (
              <PickChip key={c.id} label={codeLabel(c.id, codes, hoursProjects)} color={codeColor(c.id, codes, hoursProjects)} active={pick === c.id} onClick={() => setPick(c.id)} />
            ))}
          </div>
        </Field>
      )}
      {project && (
        <div style={{ marginBottom: "16px" }}>
          <BracketCheck checked={remember} onChange={setRemember} label={`link ${project.name} to this code`} />
        </div>
      )}
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={secondaryBtnStyle}>
          cancel
        </button>
        <button onClick={confirm} disabled={!pick} style={disabledStyle(primaryBtnStyle, !pick)}>
          clock in
        </button>
      </div>
    </Sheet>
  );
}
