import React from "react";
import type { DashboardBlob } from "../types";
import TagChips from "./shared/TagChips";
import CardMeta from "./shared/CardMeta";

interface VideoCardProps {
  blob: DashboardBlob;
  onTagClick: (tag: string) => void;
}

export function VideoCard({ blob, onTagClick }: VideoCardProps) {
  return (
    <a className="rb-card rb-card-video" href={blob.url}>
      <div className="rb-card-thumb rb-card-thumb-video">
        {blob.cover_url ? (
          <img src={blob.cover_url} alt="" loading="lazy" />
        ) : (
          <div className="rb-card-placeholder" />
        )}
        <span className="rb-filetype-pill">▶ VIDEO</span>
        {blob.duration && <span className="rb-duration-pill">{blob.duration}</span>}
      </div>
      <div className="rb-card-body">
        <div className="rb-card-title rb-card-title-1l">{blob.name}</div>
        {blob.tags.length > 0 && <TagChips tags={blob.tags} onTagClick={onTagClick} max={2} />}
        <CardMeta parts={[blob.created_rel, blob.size || null]} />
      </div>
    </a>
  );
}

export default VideoCard;
