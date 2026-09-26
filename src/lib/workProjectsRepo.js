import { getDB } from "./db.js";

// Work projects — separate from Hours' `projects`; see ARCHITECTURE.md §7 ("Work tasks").
export async function listWorkProjects() {
  const db = await getDB();
  return db.getAll("workProjects");
}

export async function putWorkProject(record) {
  const db = await getDB();
  await db.put("workProjects", record);
  return record;
}

export async function deleteWorkProject(id) {
  const db = await getDB();
  await db.delete("workProjects", id);
}
