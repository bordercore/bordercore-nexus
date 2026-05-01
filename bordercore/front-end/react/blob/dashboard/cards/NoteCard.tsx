import React from "react";
import type { DashboardBlob } from "../types";
import TagChips from "./shared/TagChips";
import CardMeta from "./shared/CardMeta";

interface NoteCardProps {
  blob: DashboardBlob;
  onTagClick: (tag: string) => void;
}

export function NoteCard({ blob, onTagClick }: NoteCardProps) {
  return (
    <a className="rb-card rb-card-note" href={blob.url}>
      {blob.is_pinned && (
        <span className="rb-pin-flag" title="pinned">
          ★
        </span>
      )}
      <div className="rb-note-body">
        <div className="rb-card-top">
          <span className="rb-dt-dot rb-dt-note" aria-hidden="true" />
          <span className="rb-note-prefix">// note</span>
          {blob.is_starred && <span className="rb-imp-flag">★</span>}
        </div>
        <div className="rb-card-title">{blob.name}</div>
        {blob.content && <div className="rb-note-text">{blob.content}</div>}
        {blob.tags.length > 0 && <TagChips tags={blob.tags} onTagClick={onTagClick} />}
        <CardMeta parts={[blob.created_rel, blob.back_refs > 0 ? `${blob.back_refs}↩` : null]} />
      </div>
    </a>
  );
}

export default NoteCard;
