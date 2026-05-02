import React from "react";
import { tagSwatchColor } from "../../utils/tagColors";
import type { TagCount } from "./types";

interface TagCloudProps {
  tags: TagCount[];
  totalDistinct: number;
  tagDetailUrl: string;
}

export function TagCloud({ tags, totalDistinct, tagDetailUrl }: TagCloudProps) {
  if (tags.length === 0) return null;

  const maxCount = Math.max(...tags.map(t => t.count), 1);

  return (
    <section className="nl-tags">
      <header className="nl-strip-head">
        <span className="nl-strip-label">tags</span>
        <span className="nl-strip-meta">{totalDistinct} in use</span>
      </header>
      <div className="nl-tag-cloud">
        {tags.map(tag => {
          const ratio = tag.count / maxCount;
          const scale = 0.5 + ratio * 0.7;
          const color = tagSwatchColor(tag.name);
          const intensity = tag.count >= 3 ? "strong" : tag.count >= 2 ? "med" : "soft";
          const href = tagDetailUrl.replace("__TAG__", encodeURIComponent(tag.name));
          return (
            <a
              key={tag.name}
              href={href}
              className={`nl-tag-pill is-${intensity}`}
              // must remain inline (per-tag color and frequency-scale from runtime hash)
              style={
                {
                  "--nl-tag-color": color,
                  "--nl-tag-scale": String(scale),
                } as React.CSSProperties
              }
            >
              {/* must remain inline (per-tag color from runtime hash) */}
              <span className="nl-tag-dot" style={{ background: color }} aria-hidden="true" />
              <span className="nl-tag-name">{tag.name}</span>
              <span className="nl-tag-count">{tag.count}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export default TagCloud;
