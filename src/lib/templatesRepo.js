import { getDB } from "./db.js";

export async function listTemplates() {
  const db = await getDB();
  return db.getAll("templates");
}

export async function putTemplate(template) {
  const db = await getDB();
  await db.put("templates", template);
  return template;
}

export async function deleteTemplate(id) {
  const db = await getDB();
  await db.delete("templates", id);
}
