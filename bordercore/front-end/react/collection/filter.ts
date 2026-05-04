import type { Collection } from "./types";

/**
 * Filter collections by case-insensitive search query (matches name OR
 * description) AND optional active tag.
 */
export function filterCollections(
  collections: Collection[],
  query: string,
  activeTag: string | null
): Collection[] {
  const q = query.trim().toLowerCase();
  return collections.filter(c => {
    if (activeTag && !c.tags.includes(activeTag)) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });
}
