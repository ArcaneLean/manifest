import { getDB } from "./db.js";

// Booking codes — see ARCHITECTURE.md §7 ("Hours 2.0"). Codes are archived
// rather than deleted once logged or booked, so history keeps its labels.
export async function listBookingCodes() {
  const db = await getDB();
  return db.getAll("bookingcodes");
}

export async function putBookingCode(code) {
  const db = await getDB();
  await db.put("bookingcodes", code);
  return code;
}

export async function deleteBookingCode(id) {
  const db = await getDB();
  await db.delete("bookingcodes", id);
}
