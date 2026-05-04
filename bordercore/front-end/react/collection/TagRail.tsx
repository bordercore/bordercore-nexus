import React, { useMemo, useState } from "react";
import { tagSlug } from "./tagColors";
import type { TagCounts } from "./types";

interface TagRailProps {
  totalCount: number;
  tagCounts: TagCounts;
  activeTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

export function TagRail({ totalCount, tagCounts, activeTag, onTagSelect }: TagRailProps) {
  const [filter, setFilter] = useState("");

  const sortedTags = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return Object.entries(tagCounts)
      .filter(([name]) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [tagCounts, filter]);

  const handleTagClick = (tag: string) => {
    onTagSelect(activeTag === tag ? null : tag);
  };

  return (
    <aside className="cl-rail" aria-label="Tag filter">
      <h2 className="cl-rail-label">tags</h2>

      <label className="cl-rail-filter">
        <span className="cl-rail-filter-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="text"
          placeholder="filter tags"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </label>

      <nav className="cl-rail-nav">
        <button
          type="button"
          className={`cl-rail-row${activeTag === null ? " is-active" : ""}`}
          onClick={() => onTagSelect(null)}
        >
          <span className="cl-rail-swatch cl-tag-color-default" />
          <span>all collections</span>
          <span className="cl-rail-count">{totalCount}</span>
        </button>

        {sortedTags.map(([name, count]) => (
          <button
            key={name}
            type="button"
            className={`cl-rail-row${activeTag === name ? " is-active" : ""}`}
            onClick={() => handleTagClick(name)}
          >
            <span className={`cl-rail-swatch cl-tag-color-${tagSlug(name)}`} />
            <span>{name}</span>
            <span className="cl-rail-count">{count}</span>
          </button>
        ))}
      </nav>

      <div className="cl-rail-footer">
        <div>
          last sync <span className="cl-rail-footer-accent">just now</span>
        </div>
        <div>{totalCount} total · favorites only</div>
      </div>
    </aside>
  );
}

export default TagRail;
