import { useEffect, useState } from "react";
import { listWorkTags, putWorkTag, deleteWorkTag } from "../lib/workTagsRepo.js";

// Work tags — same shape as personal tags, separate store. See
// ARCHITECTURE.md §7 ("Work tasks").
export function useWorkTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listWorkTags().then((loaded) => {
      if (cancelled) return;
      setTags(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addTag = ({ name, color }) => {
    const tag = { id: crypto.randomUUID(), name, color };
    setTags((prev) => [...prev, tag]);
    putWorkTag(tag);
    return tag;
  };

  const updateTag = (id, { name, color }) => {
    const updated = { id, name, color };
    setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
    putWorkTag(updated);
  };

  const removeTag = (id) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    deleteWorkTag(id);
  };

  return { tags, loading, addTag, updateTag, removeTag };
}
