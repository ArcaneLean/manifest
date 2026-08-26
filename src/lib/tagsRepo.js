import { getDB } from "./db.js";

export async function listTags() {
  const db = await getDB();
  return db.getAll("tags");
}

export async function putTag(tag) {
  const db = await getDB();
  await db.put("tags", tag);
  return tag;
}

// Tag deletion doesn't cascade — see ARCHITECTURE.md §7 ("Tag deletion
// cascade", still undecided). Stale tag ids left on tasks/templates are
// filtered out at render time (tagById lookup returns undefined).
export async function deleteTag(id) {
  const db = await getDB();
  await db.delete("tags", id);
}
