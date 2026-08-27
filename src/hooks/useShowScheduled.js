import { usePersistentState } from "./usePersistentState.js";

// Shared across Tasks and Matrix so the not-yet-active (future startDate)
// visibility choice made in one view carries over to the other — mirrors
// useShowCompleted.js. Calendar doesn't use this: it shows tasks on their
// scheduled day regardless, that's the point of a calendar.
const STORAGE_KEY = "manifest.tasks.showScheduled";

export function useShowScheduled() {
  return usePersistentState(STORAGE_KEY, false);
}
