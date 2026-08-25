import { getDB } from "./db.js";
import { toISO, startOfWeekMonday, addDays, startOfToday } from "./dateUtils.js";

// Seed data ported from prototypes/HoursView.jsx.
const today0 = startOfToday();
const monday0 = startOfWeekMonday(today0);

const SEED_WORKLOG = [
  { date: toISO(addDays(monday0, 0)), start: "07:30", end: "16:00", breakMin: 30 },
  { date: toISO(addDays(monday0, 1)), start: "08:00", end: "16:00", breakMin: 30 },
  { date: toISO(addDays(monday0, 2)), start: "07:30", end: "16:30", breakMin: 30 },
];

async function seedWorklog(db) {
  const tx = db.transaction("worklog", "readwrite");
  await Promise.all([...SEED_WORKLOG.map((e) => tx.store.add(e)), tx.done]);
  return SEED_WORKLOG;
}

// In-flight lock, not a permanent cache — see tagsRepo.js for why.
let inFlight = null;

export function listWorklog() {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const db = await getDB();
        const existing = await db.getAll("worklog");
        if (existing.length > 0) return existing;
        return await seedWorklog(db);
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
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
