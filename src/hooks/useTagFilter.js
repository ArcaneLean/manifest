import { useEffect } from "react";
import { usePersistentState } from "./usePersistentState.js";

// Persisted tag-filter selection for a list view. Selected ids whose tag has
// since been deleted are pruned once tags have loaded — otherwise a stale id
// has no chip to deselect it and silently filters the list down to nothing.
export function useTagFilter(key, tags, tagsLoading) {
  const [filterTags, setFilterTags] = usePersistentState(key, []);

  useEffect(() => {
    if (tagsLoading) return;
    setFilterTags((prev) => {
      const next = prev.filter((id) => tags.some((t) => t.id === id));
      return next.length === prev.length ? prev : next;
    });
  }, [tags, tagsLoading, setFilterTags]);

  const toggleFilterTag = (id) => {
    setFilterTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return [filterTags, toggleFilterTag];
}
