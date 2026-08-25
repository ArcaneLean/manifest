import { getDB } from "./db.js";
import { startOfToday, addDays } from "./dateUtils.js";

// Seed data ported from prototypes/TemplatesView.jsx, with tag references
// resolved against the seeded tags (same pattern as tasksRepo.js).
const today0 = startOfToday();

const SEED_TEMPLATES = [
  { text: "Buy groceries for the week", urgent: false, important: false, recurring: null, lastRun: null, tagNames: ["personal"] },
  {
    text: "Log hours in Blenddata timesheet",
    urgent: true,
    important: true,
    recurring: { type: "weekly", days: [4] },
    lastRun: addDays(today0, -7).toISOString().slice(0, 10),
    tagNames: ["work", "admin"],
  },
  {
    text: "Review priorities in the matrix",
    urgent: false,
    important: true,
    recurring: { type: "monthly", day: 1 },
    lastRun: null,
    tagNames: ["work"],
  },
  {
    text: "Check calendar for the day",
    urgent: true,
    important: true,
    recurring: { type: "daily" },
    lastRun: addDays(today0, -1).toISOString().slice(0, 10),
    tagNames: [],
  },
];

async function seedTemplates(db, tags) {
  const tagIdByName = new Map(tags.map((t) => [t.name, t.id]));
  const templates = SEED_TEMPLATES.map((seed) => ({
    id: crypto.randomUUID(),
    text: seed.text,
    urgent: seed.urgent,
    important: seed.important,
    recurring: seed.recurring,
    lastRun: seed.lastRun,
    tags: seed.tagNames.map((n) => tagIdByName.get(n)).filter(Boolean),
  }));
  const tx = db.transaction("templates", "readwrite");
  await Promise.all([...templates.map((t) => tx.store.add(t)), tx.done]);
  return templates;
}

// In-flight lock, not a permanent cache — see tagsRepo.js for why.
let inFlight = null;

export function listTemplates(tags) {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const db = await getDB();
        const existing = await db.getAll("templates");
        if (existing.length > 0) return existing;
        return await seedTemplates(db, tags);
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
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
