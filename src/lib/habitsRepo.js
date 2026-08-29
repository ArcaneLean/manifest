import { getDB } from "./db.js";

export async function listHabits() {
  const db = await getDB();
  return db.getAll("habits");
}

export async function putHabit(habit) {
  const db = await getDB();
  await db.put("habits", habit);
  return habit;
}

export async function deleteHabit(id) {
  const db = await getDB();
  await db.delete("habits", id);
}

export async function listHabitEntries() {
  const db = await getDB();
  return db.getAll("habitEntries");
}

export async function putHabitEntry(entry) {
  const db = await getDB();
  await db.put("habitEntries", entry);
  return entry;
}

export async function deleteHabitEntry(id) {
  const db = await getDB();
  await db.delete("habitEntries", id);
}

// Bulk-delete every entry belonging to a habit, e.g. when the habit itself
// is deleted — entries have no foreign-key enforcement of their own since
// IndexedDB doesn't support it, so the caller is responsible for cascading.
export async function deleteHabitEntriesFor(habitId, entries) {
  const db = await getDB();
  const tx = db.transaction("habitEntries", "readwrite");
  await Promise.all(entries.filter((e) => e.habitId === habitId).map((e) => tx.store.delete(e.id)));
  await tx.done;
}
