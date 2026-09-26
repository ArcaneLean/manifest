// Booking-code labelling/lookup helpers for the Hours views.
import { COLORS } from "../../theme/colors.js";

export function activeCodesOf(projectId, codes) {
  return codes.filter((c) => c.projectId === projectId && !c.archived);
}

// "HQPack · billable", or just "Blenddata" when the project has a single
// code. Unknown codes/projects (deleted) render as "?" like before.
export function codeLabel(codeId, codes, projects) {
  const code = codes.find((c) => c.id === codeId);
  if (!code) return "?";
  const project = projects.find((p) => p.id === code.projectId);
  if (!project) return `? · ${code.name}`;
  const siblings = codes.filter((c) => c.projectId === code.projectId);
  return siblings.length <= 1 ? project.name : `${project.name} · ${code.name}`;
}

export function codeColor(codeId, codes, projects) {
  const code = codes.find((c) => c.id === codeId);
  const project = code && projects.find((p) => p.id === code.projectId);
  return project ? project.color : COLORS.dim;
}

// Codes that can be picked for new work: not archived, project still exists.
export function pickableCodes(codes, projects) {
  const order = new Map(projects.map((p, i) => [p.id, i]));
  return codes
    .filter((c) => !c.archived && order.has(c.projectId))
    .sort((a, b) => order.get(a.projectId) - order.get(b.projectId) || a.name.localeCompare(b.name));
}

// Orders a set of code ids the same way pickableCodes would, unknown last.
export function sortCodeIds(ids, codes, projects) {
  const order = new Map(pickableCodes(codes, projects).map((c, i) => [c.id, i]));
  return [...ids].sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) || (a < b ? -1 : 1));
}

// Title of the work task a segment was started from (ARCHITECTURE.md §7
// "Work tasks"), or null — also when that task has since been deleted.
export function taskTitle(taskId, workTasks) {
  if (!taskId) return null;
  return (workTasks || []).find((t) => t.id === taskId)?.title || null;
}

// Parses "+2:30", "-1:15", "2.5", "-0.5", "90m", "2h30" into signed minutes;
// null if unparseable.
export function parseSignedDuration(text) {
  const t = String(text).trim().replace(",", ".");
  if (!t) return 0;
  const sign = t.startsWith("-") ? -1 : 1;
  const body = t.replace(/^[+-]/, "").trim();
  let m;
  if ((m = body.match(/^(\d+):(\d{1,2})$/))) return sign * (Number(m[1]) * 60 + Number(m[2]));
  if ((m = body.match(/^(\d+)h\s*(\d{1,2})?m?$/))) return sign * (Number(m[1]) * 60 + Number(m[2] || 0));
  if ((m = body.match(/^(\d+)m$/))) return sign * Number(m[1]);
  if ((m = body.match(/^\d+(\.\d+)?$/))) return sign * Math.round(Number(body) * 60);
  return null;
}

export function formatSignedHHMM(min) {
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}
