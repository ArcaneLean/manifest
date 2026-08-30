import { getDB } from "./db.js";

export async function listDayShapes() {
  const db = await getDB();
  return db.getAll("dayshapes");
}

export async function putDayShape(shape) {
  const db = await getDB();
  await db.put("dayshapes", shape);
  return shape;
}

export async function deleteDayShape(id) {
  const db = await getDB();
  await db.delete("dayshapes", id);
}

export async function listDayOverrides() {
  const db = await getDB();
  return db.getAll("dayoverrides");
}

export async function putDayOverride(override) {
  const db = await getDB();
  await db.put("dayoverrides", override);
  return override;
}

export async function deleteDayOverride(date) {
  const db = await getDB();
  await db.delete("dayoverrides", date);
}
