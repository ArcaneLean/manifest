import { useEffect, useState } from "react";
import { listBookings, putBooking, deleteBooking } from "../lib/bookingsRepo.js";

export function useBookings() {
  const [bookings, setBookings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listBookings().then((rows) => {
      if (cancelled) return;
      setBookings(Object.fromEntries(rows.map((b) => [b.weekStart, b])));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveBooking = (booking) => {
    setBookings((prev) => ({ ...prev, [booking.weekStart]: booking }));
    putBooking(booking);
  };

  const removeBooking = (weekStart) => {
    setBookings((prev) => {
      const next = { ...prev };
      delete next[weekStart];
      return next;
    });
    deleteBooking(weekStart);
  };

  return { bookings, loading, saveBooking, removeBooking };
}
