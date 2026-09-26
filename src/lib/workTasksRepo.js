import { getDB } from "./db.js";

// Work tasks — see ARCHITECTURE.md §7 ("Work tasks"). Completed tasks are kept, never purged.
export async function listWorkTasks() {
  const db = await getDB();
  return db.getAll("workTasks");
}

export async function putWorkTask(record) {
  const db = await getDB();
  await db.put("workTasks", record);
  return record;
}

export async function deleteWorkTask(id) {
  const db = await getDB();
  await db.delete("workTasks", id);
}
