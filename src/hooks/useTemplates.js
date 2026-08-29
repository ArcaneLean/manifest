import { useEffect, useState } from "react";
import { listTemplates, putTemplate, deleteTemplate } from "../lib/templatesRepo.js";
import { listTasks, putTask } from "../lib/tasksRepo.js";
import { startOfToday } from "../lib/dateUtils.js";
import { firstOccurrenceOnOrAfter, occurrenceDates } from "../lib/recurrence.js";

// Ensures a recurring template has exactly one open "anchor" task (the one
// real, completable Task linked via templateId — see ARCHITECTURE.md §7).
// Called on template creation, whenever recurring is switched on, and as a
// self-healing check on load (covers legacy templates and an anchor the
// user deleted directly). No-op for one-off templates or templates that
// already have an open anchor. Seeded on the schedule's actual first
// occurrence on/after today (not always today itself), dated per the
// template's recurring.dateField.
async function ensureAnchor(template) {
  if (!template.recurring) return;
  const existing = await listTasks();
  const hasOpenAnchor = existing.some((t) => t.templateId === template.id && !t.done);
  if (hasOpenAnchor) return;
  const occDate = firstOccurrenceOnOrAfter(template.recurring, startOfToday());
  const anchor = {
    id: crypto.randomUUID(),
    text: template.text,
    done: false,
    urgent: template.urgent,
    important: template.important,
    tags: template.tags,
    ...occurrenceDates(template, occDate),
    templateId: template.id,
    createdAt: Date.now(),
    completedAt: null,
  };
  await putTask(anchor);
}

export function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listTemplates().then((loaded) => {
      if (cancelled) return;
      setTemplates(loaded);
      setLoading(false);
      loaded.filter((t) => t.recurring).forEach(ensureAnchor);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addTemplate = ({ text, urgent, important, recurring, tags: templateTags }) => {
    const template = {
      id: crypto.randomUUID(),
      text,
      urgent,
      important,
      recurring,
      tags: templateTags,
    };
    setTemplates((prev) => [...prev, template]);
    putTemplate(template);
    if (recurring) ensureAnchor(template);
  };

  const removeTemplate = (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    deleteTemplate(id);
  };

  // Reads `templates` (this hook's own state), not the setTemplates
  // updater's `prev`, so the side effects below run exactly once — see the
  // same note on useTasks.toggleTask.
  const updateTemplate = (id, updates) => {
    const current = templates.find((t) => t.id === id);
    if (!current) return;
    const updated = { ...current, ...updates };
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
    putTemplate(updated);
    if (updated.recurring) ensureAnchor(updated);
  };

  return { templates, loading, addTemplate, removeTemplate, updateTemplate };
}
