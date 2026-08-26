import { getDB } from "./db.js";

export async function listCountdowns() {
  const db = await getDB();
  return db.getAll("countdowns");
}

export async function putCountdown(countdown) {
  const db = await getDB();
  await db.put("countdowns", countdown);
  return countdown;
}

export async function deleteCountdown(id) {
  const db = await getDB();
  await db.delete("countdowns", id);
}
