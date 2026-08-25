import { useEffect, useState } from "react";
import { listTags } from "../lib/tagsRepo.js";

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

  return { tags, loading };
}
