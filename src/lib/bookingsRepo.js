import { getDB } from "./db.js";

// Weekly bookings, keyed by the week's Monday — see ARCHITECTURE.md §7
// ("Hours 2.0").
export async function listBookings() {
  const db = await getDB();
  return db.getAll("bookings");
}

export async function putBooking(booking) {
  const db = await getDB();
  await db.put("bookings", booking);
  return booking;
}

export async function deleteBooking(weekStart) {
  const db = await getDB();
  await db.delete("bookings", weekStart);
}
