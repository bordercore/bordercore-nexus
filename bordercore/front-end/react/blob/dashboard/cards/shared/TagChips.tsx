import React from "react";
import { tagColor } from "../../utils/tagColor";

interface TagChipsProps {
  tags: string[];
  max?: number;
  onTagClick?: (tag: string) => void;
}

export function TagChips({ tags, max = 3, onTagClick }: TagChipsProps) {
  const visible = tags.slice(0, max);
  const overflow = tags.length - visible.length;
  return (
    <div className="rb-card-tags">
      {visible.map(tag => (
        <span
          key={tag}
          className="rb-tag-chip"
          ref={node => {
            if (node) node.style.setProperty("--tag-color", tagColor(tag));
          }}
          onClick={
            onTagClick
              ? e => {
                  e.stopPropagation();
                  onTagClick(tag);
                }
              : undefined
          }
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && <span className="rb-tag-chip rb-tag-chip-overflow">+{overflow}</span>}
    </div>
  );
}

export default TagChips;
