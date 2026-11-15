import { getDB } from "./db.js";

// Hobbies — see ARCHITECTURE.md §7 ("Hobbies").
export async function listPursuits() {
  const db = await getDB();
  return db.getAll("pursuits");
}

export async function putPursuit(record) {
  const db = await getDB();
  await db.put("pursuits", record);
  return record;
}

export async function deletePursuit(id) {
  const db = await getDB();
  await db.delete("pursuits", id);
}
