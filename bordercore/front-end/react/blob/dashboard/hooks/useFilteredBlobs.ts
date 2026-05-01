import { useMemo } from "react";
import type { DashboardBlob, FilterState } from "../types";

export function useFilteredBlobs(blobs: DashboardBlob[], filters: FilterState): DashboardBlob[] {
  return useMemo(() => {
    return blobs.filter(blob => {
      if (filters.doctype !== "all" && blob.doctype !== filters.doctype) {
        return false;
      }
      if (filters.tags.size > 0) {
        const matchesTag = blob.tags.some(t => filters.tags.has(t));
        if (!matchesTag) return false;
      }
      if (filters.dateBucket && blob.bucket !== filters.dateBucket) {
        return false;
      }
      if (filters.starredOnly && !blob.is_starred) return false;
      if (filters.pinnedOnly && !blob.is_pinned) return false;
      return true;
    });
  }, [blobs, filters]);
}

export function isFilterActive(filters: FilterState): boolean {
  return (
    filters.doctype !== "all" ||
    filters.tags.size > 0 ||
    filters.dateBucket !== null ||
    filters.starredOnly ||
    filters.pinnedOnly
  );
}
