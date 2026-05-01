import React from "react";
import type { DashboardBlob } from "../types";
import DoctypeBadge from "./shared/DoctypeBadge";
import TagChips from "./shared/TagChips";
import CardMeta from "./shared/CardMeta";

interface BookCardProps {
  blob: DashboardBlob;
  onTagClick: (tag: string) => void;
}

function stripEdition(name: string): string {
  return name.replace(/\s+\d+E$/, "");
}

export function BookCard({ blob, onTagClick }: BookCardProps) {
  return (
    <a className="rb-card rb-card-book" href={blob.url}>
      <div className="rb-card-thumb rb-card-thumb-book">
        {blob.cover_url ? (
          <img src={blob.cover_url} alt="" loading="lazy" />
        ) : (
          <div className="rb-card-placeholder rb-card-placeholder-stripes" />
        )}
      </div>
      <div className="rb-card-body">
        <DoctypeBadge doctype="book" label="BOOK" />
        <div className="rb-card-title">{stripEdition(blob.name)}</div>
        {blob.tags.length > 0 && <TagChips tags={blob.tags} onTagClick={onTagClick} max={2} />}
        <CardMeta
          parts={[
            blob.num_pages ? `${blob.num_pages}p` : null,
            blob.size || null,
            blob.back_refs > 0 ? `${blob.back_refs}↩` : null,
          ]}
        />
      </div>
    </a>
  );
}

export default BookCard;
