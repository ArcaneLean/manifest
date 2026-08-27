import { useEffect, useState } from "react";

// Shared across Tasks, Matrix, and Calendar views so the completed-task
// visibility choice made in one view carries over to the others.
const STORAGE_KEY = "manifest.tasks.showCompleted";

export function useShowCompleted() {
  const [showCompleted, setShowCompleted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(showCompleted));
    } catch {
      // localStorage unavailable (private mode, etc.) — toggle just won't persist
    }
  }, [showCompleted]);

  return [showCompleted, setShowCompleted];
}
