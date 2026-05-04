import React from "react";
import CoverMosaic from "./CoverMosaic";
import TagChip from "./TagChip";
import type { Collection } from "./types";

interface GridCardProps {
  collection: Collection;
  mosaic?: boolean;
}

export function GridCard({ collection, mosaic = false }: GridCardProps) {
  return (
    <a href={collection.url} className={`cl-card-grid${mosaic ? " is-mosaic" : ""}`}>
      <div className="cl-card-cover">
        <CoverMosaic tiles={collection.cover_tiles} alt={collection.name} />
      </div>
      <div className="cl-card-body">
        <div className="cl-card-title-row">
          <span className="cl-card-title">{collection.name}</span>
          {collection.is_favorite && (
            <span className="cl-card-fav" aria-hidden="true">
              ★
            </span>
          )}
        </div>
        <div className="cl-card-meta">
          <span>{collection.num_objects} objects</span>
          <span className="cl-meta-sep">·</span>
          <span>{collection.modified}</span>
        </div>
        {mosaic && collection.description && (
          <p className="cl-card-desc">{collection.description}</p>
        )}
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
