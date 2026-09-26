import { getDB } from "./db.js";

// Work tags — separate from the personal `tags`; see ARCHITECTURE.md §7 ("Work tasks").
export async function listWorkTags() {
  const db = await getDB();
  return db.getAll("workTags");
}

export async function putWorkTag(record) {
  const db = await getDB();
  await db.put("workTags", record);
  return record;
}

export async function deleteWorkTag(id) {
  const db = await getDB();
  await db.delete("workTags", id);
}
