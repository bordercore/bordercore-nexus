import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faSearch } from "@fortawesome/free-solid-svg-icons";
import type { ObjectTag } from "./types";

interface CurateRailProps {
  objectTags: ObjectTag[];
  totalCount: number;
  activeTag: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectTag: (tag: string | null) => void;
}

export function CurateRail({
  objectTags,
  totalCount,
  activeTag,
  collapsed,
  onToggleCollapsed,
  onSelectTag,
}: CurateRailProps) {
  const [tagSearch, setTagSearch] = useState("");

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return objectTags;
    return objectTags.filter(t => t.tag.toLowerCase().includes(q));
  }, [objectTags, tagSearch]);

  return (
    <aside className="cd-rail">
      <div className="cd-rail-head">
        <div className="cd-rail-label">tags</div>
        <button
          type="button"
          className="cd-rail-toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand tag rail" : "Collapse tag rail"}
        >
          <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
        </button>
      </div>

      <label className="cd-rail-search">
        <FontAwesomeIcon icon={faSearch} aria-hidden="true" />
        <input
          type="text"
          className="cd-rail-search-input"
          placeholder="filter tags"
          value={tagSearch}
          onChange={e => setTagSearch(e.target.value)}
          aria-label="Filter tags"
        />
      </label>

      <div className="cd-rail-tags">
        <button
          type="button"
          className={activeTag === null ? "cd-tag active" : "cd-tag"}
          onClick={() => onSelectTag(null)}
        >
          <span className="cd-tag-dot all" />
          <span className="cd-tag-name">all objects</span>
          <span className="cd-tag-count">{totalCount}</span>
        </button>

        {filteredTags.map(tag => (
          <button
            key={tag.id}
            type="button"
            className={activeTag === tag.tag ? "cd-tag active" : "cd-tag"}
            onClick={() => onSelectTag(activeTag === tag.tag ? null : tag.tag)}
          >
            <span className="cd-tag-dot" />
            <span className="cd-tag-name">{tag.tag}</span>
            <span className="cd-tag-count">{tag.blob_count}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default CurateRail;
