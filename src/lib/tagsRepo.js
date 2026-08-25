import { getDB } from "./db.js";
import { TAG_PALETTE } from "../theme/colors.js";

// Seed data ported from prototypes/TagsView.jsx — the Tags view (CRUD, §5)
// isn't built yet, so this is the only source of tags for now.
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

export async function listTags() {
  const db = await getDB();
  const existing = await db.getAll("tags");
  if (existing.length > 0) return existing;
  return seedTags(db);
}
