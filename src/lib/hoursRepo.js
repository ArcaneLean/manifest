import { getDB } from "./db.js";

export async function listWorklog() {
  const db = await getDB();
  return db.getAll("worklog");
}

export async function putWorklogEntry(entry) {
  const db = await getDB();
  await db.put("worklog", entry);
  return entry;
}

export async function deleteWorklogEntry(date) {
  const db = await getDB();
  await db.delete("worklog", date);
}

export async function listWeekTargets() {
  const db = await getDB();
  return db.getAll("weektargets");
}

export async function putWeekTarget(target) {
  const db = await getDB();
  await db.put("weektargets", target);
  return target;
}
