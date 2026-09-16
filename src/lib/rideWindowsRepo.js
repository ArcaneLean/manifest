import { getDB } from "./db.js";

export async function listRideWindows() {
  const db = await getDB();
  return db.getAll("rideWindows");
}

export async function putRideWindow(rideWindow) {
  const db = await getDB();
  await db.put("rideWindows", rideWindow);
  return rideWindow;
}

export async function deleteRideWindow(id) {
  const db = await getDB();
  await db.delete("rideWindows", id);
}
