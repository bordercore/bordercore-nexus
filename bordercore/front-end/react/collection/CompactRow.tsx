import React from "react";
import CoverMosaic from "./CoverMosaic";
import { TagDot } from "./TagChip";
import type { Collection } from "./types";

interface CompactRowProps {
  collection: Collection;
}

export function CompactRow({ collection }: CompactRowProps) {
  return (
    <a href={collection.url} className="cl-row-compact">
      <CoverMosaic tiles={collection.cover_tiles} alt={collection.name} small />
      <span className="cl-row-name">
        {collection.is_favorite && (
          <span className="cl-fav-star" aria-hidden="true">
            ★
          </span>
        )}
        {collection.name}
      </span>
      <span className="cl-row-count">{collection.num_objects} obj</span>
      <span className="cl-row-modified">{collection.modified}</span>
      <span className="cl-row-tags">
        {collection.tags.slice(0, 3).map(t => (
          <TagDot key={t} name={t} />
        ))}
      </span>
      <span className="cl-row-chevron" aria-hidden="true">
        ▸
      </span>
    </a>
  );
}

export default CompactRow;
