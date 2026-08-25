import { getDB } from "./db.js";

// Seed data ported from prototypes/CountdownView.jsx.
const SEED_COUNTDOWNS = [
  { label: "sanne's birthday", date: "1998-07-04" },
  { label: "registered partnership", date: "2021-09-18" },
  { label: "solar eclipse trip", date: "2027-08-02" },
];

async function seedCountdowns(db) {
  const countdowns = SEED_COUNTDOWNS.map((seed) => ({ id: crypto.randomUUID(), ...seed }));
  const tx = db.transaction("countdowns", "readwrite");
  await Promise.all([...countdowns.map((c) => tx.store.add(c)), tx.done]);
  return countdowns;
}

// In-flight lock, not a permanent cache — see tagsRepo.js for why.
let inFlight = null;

export function listCountdowns() {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const db = await getDB();
        const existing = await db.getAll("countdowns");
        if (existing.length > 0) return existing;
        return await seedCountdowns(db);
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
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
