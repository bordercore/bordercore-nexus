import React from "react";
import type { TagCount } from "../types";
import { tagColor } from "../utils/tagColor";

interface TagFiltersProps {
  tags: TagCount[];
  total: number;
  active: Set<string>;
  onToggle: (tag: string) => void;
}

export function TagFilters({ tags, total, active, onToggle }: TagFiltersProps) {
  if (tags.length === 0) return null;
  return (
    <section className="rb-rail-section">
      <h3 className="rb-rail-heading">
        tags <span className="rb-rail-heading-count">{total}</span>
      </h3>
      <div className="rb-rail-tags">
        {tags.map(tag => {
          const isActive = active.has(tag.name);
          return (
            <button
              key={tag.name}
              type="button"
              className={`rb-tag-chip rb-tag-chip-rail${isActive ? " is-active" : ""}`}
              aria-pressed={isActive}
              ref={node => {
                if (node) node.style.setProperty("--tag-color", tagColor(tag.name));
              }}
              onClick={() => onToggle(tag.name)}
            >
              {tag.name}
              <span className="rb-tag-chip-count">{tag.count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default TagFilters;
