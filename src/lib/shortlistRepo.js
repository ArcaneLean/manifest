import { getDB } from "./db.js";

const DOC_ID = "shortlist";

function emptyOrder() {
  return { id: DOC_ID, wont: [], could: [], want: [] };
}

export async function getShortlistOrder() {
  const db = await getDB();
  const row = await db.get("shortlist", DOC_ID);
  return row || emptyOrder();
}

export async function putShortlistOrder(order) {
  const db = await getDB();
  const row = { ...order, id: DOC_ID };
  await db.put("shortlist", row);
  return row;
}
