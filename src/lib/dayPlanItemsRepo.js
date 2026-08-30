import { getDB } from "./db.js";

export async function listDayPlanItems() {
  const db = await getDB();
  return db.getAll("dayplans");
}

export async function putDayPlanItems(entry) {
  const db = await getDB();
  await db.put("dayplans", entry);
  return entry;
}

export async function deleteDayPlanItems(date) {
  const db = await getDB();
  await db.delete("dayplans", date);
}
