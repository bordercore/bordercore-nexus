import React from "react";
import CoverMosaic from "./CoverMosaic";
import TagChip from "./TagChip";
import type { Collection } from "./types";

interface CinemaCardProps {
  collection: Collection;
}

export function CinemaCard({ collection }: CinemaCardProps) {
  return (
    <a href={collection.url} className="cl-card-cinema">
      <div className="cl-cinema-cover">
        <CoverMosaic tiles={collection.cover_tiles} alt={collection.name} />
      </div>
      <div className="cl-cinema-overlay">
        <h3 className="cl-cinema-title">{collection.name}</h3>
        {collection.description && <p className="cl-cinema-desc">{collection.description}</p>}
      </div>
      <div className="cl-cinema-foot">
        <div className="cl-cinema-meta">
          {collection.num_objects} objects · {collection.modified}
        </div>
        <div className="cl-cinema-tags">
          {collection.tags.slice(0, 3).map(t => (
            <TagChip key={t} name={t} />
          ))}
        </div>
      </div>
    </a>
  );
}

export default CinemaCard;
