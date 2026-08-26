import { getDB } from "./db.js";

export async function listTasks() {
  const db = await getDB();
  return db.getAll("tasks");
}

export async function putTask(task) {
  const db = await getDB();
  await db.put("tasks", task);
  return task;
}

export async function deleteTask(id) {
  const db = await getDB();
  await db.delete("tasks", id);
}
