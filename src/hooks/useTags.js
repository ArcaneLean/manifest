import { useEffect, useState } from "react";
import { listTags, putTag, deleteTag } from "../lib/tagsRepo.js";

export function useTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listTags().then((loaded) => {
      if (!cancelled) {
        setTags(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addTag = ({ name, color }) => {
    const tag = { id: crypto.randomUUID(), name, color };
    setTags((prev) => [...prev, tag]);
    putTag(tag);
    return tag;
  };

  const updateTag = (id, { name, color }) => {
    setTags((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, name, color } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) putTag(updated);
      return next;
    });
  };

  const removeTag = (id) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    deleteTag(id);
  };

  return { tags, loading, addTag, updateTag, removeTag };
}
