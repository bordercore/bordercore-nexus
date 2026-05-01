import React from "react";
import type { DashboardData, DateBucket, DoctypeFilter, FilterState } from "./types";
import DoctypeFilters from "./filters/DoctypeFilters";
import DateBucketFilters from "./filters/DateBucketFilters";
import TagFilters from "./filters/TagFilters";
import ImportanceFilters from "./filters/ImportanceFilters";

interface FilterRailProps {
  data: DashboardData;
  filters: FilterState;
  onDoctype: (value: DoctypeFilter) => void;
  onTag: (tag: string) => void;
  onDateBucket: (bucket: DateBucket | null) => void;
  onToggleStarred: () => void;
  onTogglePinned: () => void;
}

export function FilterRail({
  data,
  filters,
  onDoctype,
  onTag,
  onDateBucket,
  onToggleStarred,
  onTogglePinned,
}: FilterRailProps) {
  return (
    <aside className="rb-rail" aria-label="Filters">
      <DoctypeFilters counts={data.doctype_counts} active={filters.doctype} onSelect={onDoctype} />
      <DateBucketFilters
        counts={data.date_bucket_counts}
        active={filters.dateBucket}
        onSelect={onDateBucket}
      />
      <TagFilters
        tags={data.tag_counts}
        total={data.tag_total}
        active={filters.tags}
        onToggle={onTag}
      />
      <ImportanceFilters
        starredCount={data.starred_count}
        pinnedCount={data.pinned_count}
        starredOnly={filters.starredOnly}
        pinnedOnly={filters.pinnedOnly}
        onToggleStarred={onToggleStarred}
        onTogglePinned={onTogglePinned}
      />
    </aside>
  );
}

export default FilterRail;
