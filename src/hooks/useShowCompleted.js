import { usePersistentState } from "./usePersistentState.js";

// Shared across Tasks, Matrix, and Calendar views so the completed-task
// visibility choice made in one view carries over to the others.
const STORAGE_KEY = "manifest.tasks.showCompleted";

export function useShowCompleted() {
  return usePersistentState(STORAGE_KEY, false);
}
