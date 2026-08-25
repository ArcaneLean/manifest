import { useEffect, useState } from "react";
import { listTemplates, putTemplate, deleteTemplate } from "../lib/templatesRepo.js";
import { toISO } from "../lib/dateUtils.js";

// Waits for tags to finish loading (possibly seeding) before loading
// templates, since template seeding needs real tag ids to reference —
// mirrors useTasks.js.
export function useTemplates(tags, tagsLoading) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tagsLoading) return;
    let cancelled = false;
    listTemplates(tags).then((loaded) => {
      if (!cancelled) {
        setTemplates(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tagsLoading]);

  const addTemplate = ({ text, urgent, important, recurring, tags: templateTags }) => {
    const template = {
      id: crypto.randomUUID(),
      text,
      urgent,
      important,
      recurring,
      lastRun: null,
      tags: templateTags,
    };
    setTemplates((prev) => [...prev, template]);
    putTemplate(template);
  };

  const removeTemplate = (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    deleteTemplate(id);
  };

  // Marks a recurring template as run today (one-off templates don't track lastRun).
  const markRunToday = (id) => {
    const today = toISO(new Date());
    setTemplates((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, lastRun: today } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) putTemplate(updated);
      return next;
    });
  };

  return { templates, loading, addTemplate, removeTemplate, markRunToday };
}
