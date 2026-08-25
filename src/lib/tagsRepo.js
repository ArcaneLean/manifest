import { getDB } from "./db.js";
import { TAG_PALETTE } from "../theme/colors.js";

// Seed data ported from prototypes/TagsView.jsx.
const SEED_NAMES = ["work", "personal", "health", "admin", "family"];

async function seedTags(db) {
  const tags = SEED_NAMES.map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    color: TAG_PALETTE[i % TAG_PALETTE.length],
  }));
  const tx = db.transaction("tags", "readwrite");
  await Promise.all([...tags.map((t) => tx.store.add(t)), tx.done]);
  return tags;
}

// In-flight calls share one load-or-seed so concurrent callers (e.g. React
// StrictMode's double-invoked mount effects) don't race two overlapping
// db.getAll() calls that both see an empty store and both seed it. The lock
// clears once resolved, so a later call (a real remount) still re-queries
// the DB instead of returning a stale cached list.
let inFlight = null;

export function listTags() {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const db = await getDB();
        const existing = await db.getAll("tags");
        if (existing.length > 0) return existing;
        return await seedTags(db);
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
}

export async function putTag(tag) {
  const db = await getDB();
  await db.put("tags", tag);
  return tag;
}

// Tag deletion doesn't cascade — see ARCHITECTURE.md §7 ("Tag deletion
// cascade", still undecided). Stale tag ids left on tasks/templates are
// filtered out at render time (tagById lookup returns undefined).
export async function deleteTag(id) {
  const db = await getDB();
  await db.delete("tags", id);
}
