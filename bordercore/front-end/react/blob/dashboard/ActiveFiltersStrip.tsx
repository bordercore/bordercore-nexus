import React from "react";
import type { FilterState } from "./types";
import { DATE_BUCKET_LABELS, DOCTYPE_LABELS } from "./types";
import { tagColor } from "./utils/tagColor";

interface ActiveFiltersStripProps {
  filters: FilterState;
  onClearDoctype: () => void;
  onRemoveTag: (tag: string) => void;
  onClearDateBucket: () => void;
  onClearStarred: () => void;
  onClearPinned: () => void;
  onClearAll: () => void;
}

export function ActiveFiltersStrip({
  filters,
  onClearDoctype,
  onRemoveTag,
  onClearDateBucket,
  onClearStarred,
  onClearPinned,
  onClearAll,
}: ActiveFiltersStripProps) {
  return (
    <div className="rb-active-filters" role="status">
      <span className="rb-active-filters-label">// active filters</span>

      {filters.doctype !== "all" && (
        <span className="rb-chip rb-chip-doctype">
          {DOCTYPE_LABELS[filters.doctype]}
          <button
            type="button"
            className="rb-chip-remove"
            aria-label={`Remove filter: ${DOCTYPE_LABELS[filters.doctype]}`}
            onClick={onClearDoctype}
          >
            ×
          </button>
        </span>
      )}

      {Array.from(filters.tags).map(tag => (
        <span
          key={tag}
          className="rb-chip rb-chip-tag"
          ref={node => {
            if (node) node.style.setProperty("--tag-color", tagColor(tag));
          }}
        >
          #{tag}
          <button
            type="button"
            className="rb-chip-remove"
            aria-label={`Remove filter: ${tag}`}
            onClick={() => onRemoveTag(tag)}
          >
            ×
          </button>
        </span>
      ))}

      {filters.dateBucket && (
        <span className="rb-chip rb-chip-date">
          {DATE_BUCKET_LABELS[filters.dateBucket]}
          <button
            type="button"
            className="rb-chip-remove"
            aria-label={`Remove filter: ${DATE_BUCKET_LABELS[filters.dateBucket]}`}
            onClick={onClearDateBucket}
          >
            ×
          </button>
        </span>
      )}

      {filters.starredOnly && (
        <span className="rb-chip rb-chip-imp">
          ★ starred
          <button
            type="button"
            className="rb-chip-remove"
            aria-label="Remove filter: starred only"
            onClick={onClearStarred}
          >
            ×
          </button>
        </span>
      )}

      {filters.pinnedOnly && (
        <span className="rb-chip rb-chip-imp">
          ● pinned
          <button
            type="button"
            className="rb-chip-remove"
            aria-label="Remove filter: pinned only"
            onClick={onClearPinned}
          >
            ×
          </button>
        </span>
      )}

      <button type="button" className="rb-clear-all" onClick={onClearAll}>
        clear all
      </button>
    </div>
  );
}

export default ActiveFiltersStrip;
