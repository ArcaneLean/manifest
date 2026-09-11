import { getDB } from "./db.js";

export async function listProjects() {
  const db = await getDB();
  return db.getAll("projects");
}

export async function putProject(project) {
  const db = await getDB();
  await db.put("projects", project);
  return project;
}

// Project deletion doesn't cascade — same call as tagsRepo.js's tag
// deletion. Stale projectIds left on worklog segments are handled at
// render time (project lookup returns undefined -> shown as "?").
export async function deleteProject(id) {
  const db = await getDB();
  await db.delete("projects", id);
}
