import React from "react";
import CoverMosaic from "./CoverMosaic";
import TagChip from "./TagChip";
import type { Collection } from "./types";

interface GridCardProps {
  collection: Collection;
}

export function GridCard({ collection }: GridCardProps) {
  return (
    <a href={collection.url} className="cl-card-grid">
      <div className="cl-card-cover">
        <CoverMosaic tiles={collection.cover_tiles} alt={collection.name} />
      </div>
      <div className="cl-card-body">
        <div className="cl-card-title-row">
          <span className="cl-card-title">{collection.name}</span>
        </div>
        <div className="cl-card-meta">
          <span>{collection.num_objects} objects</span>
          <span className="cl-meta-sep">·</span>
          <span>{collection.modified}</span>
        </div>
        <div className="cl-card-tags">
          {collection.tags.slice(0, 3).map(t => (
            <TagChip key={t} name={t} />
          ))}
        </div>
      </div>
    </a>
  );
}

export default GridCard;
