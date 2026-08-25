import { getDB } from "./db.js";

// Seed data ported from prototypes/TaskView.jsx, with numeric ids swapped
// for real ids and tag references resolved against the seeded tags.
const SEED_TASKS = [
  { text: "Set up Cloudflare Worker proxy for GitHub sync", done: false, urgent: false, important: true, tagNames: ["work"] },
  { text: "Design IndexedDB schema for tasks", done: false, urgent: true, important: true, tagNames: ["work"] },
  { text: "Register service worker", done: true, urgent: false, important: true, tagNames: ["work"] },
  { text: "Write manifest.json", done: true, urgent: false, important: false, tagNames: ["work"] },
  { text: "Sketch conflict resolution for offline edits", done: false, urgent: true, important: false, tagNames: ["work"] },
  { text: "Dentist checkup", done: false, urgent: false, important: false, tagNames: ["health"] },
  { text: "Renew ID card", done: false, urgent: true, important: true, tagNames: ["admin"] },
  { text: "Plan birthday gift", done: false, urgent: false, important: true, tagNames: ["family", "personal"] },
];

async function seedTasks(db, tags) {
  const tagIdByName = new Map(tags.map((t) => [t.name, t.id]));
  const now = Date.now();
  const tasks = SEED_TASKS.map((seed, i) => ({
    id: crypto.randomUUID(),
    text: seed.text,
    done: seed.done,
    urgent: seed.urgent,
    important: seed.important,
    tags: seed.tagNames.map((n) => tagIdByName.get(n)).filter(Boolean),
    createdAt: now + i,
  }));
  const tx = db.transaction("tasks", "readwrite");
  await Promise.all([...tasks.map((t) => tx.store.add(t)), tx.done]);
  return tasks;
}

// In-flight lock, not a permanent cache — see tagsRepo.js for why.
let inFlight = null;

export function listTasks(tags) {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const db = await getDB();
        const existing = await db.getAll("tasks");
        if (existing.length > 0) return existing;
        return await seedTasks(db, tags);
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
}

export async function putTask(task) {
  const db = await getDB();
  await db.put("tasks", task);
  return task;
}

export async function deleteTask(id) {
  const db = await getDB();
  await db.delete("tasks", id);
}
