import React from "react";
import type { DashboardBlob } from "../types";
import TagChips from "./shared/TagChips";
import CardMeta from "./shared/CardMeta";

interface ImageCardProps {
  blob: DashboardBlob;
  onTagClick: (tag: string) => void;
}

export function ImageCard({ blob, onTagClick }: ImageCardProps) {
  return (
    <a className="rb-card rb-card-image" href={blob.url}>
      <div className="rb-card-thumb rb-card-thumb-image">
        {blob.cover_url ? (
          <img src={blob.cover_url} alt="" loading="lazy" />
        ) : (
          <div className="rb-card-placeholder" />
        )}
        <span className="rb-filetype-pill">IMG</span>
      </div>
      <div className="rb-card-body">
        <div className="rb-card-title rb-card-title-1l">{blob.name}</div>
        {blob.tags.length > 0 && <TagChips tags={blob.tags} onTagClick={onTagClick} max={2} />}
        <CardMeta parts={[blob.created_rel, blob.size || null]} />
      </div>
    </a>
  );
}

export default ImageCard;
