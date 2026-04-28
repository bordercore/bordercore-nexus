import React from "react";
import type { CollectionBlob } from "../types";

interface BookshelfProps {
  blobs: CollectionBlob[];
  limit?: number;
}

export function Bookshelf({ blobs, limit = 3 }: BookshelfProps) {
  const visible = blobs.slice(0, limit);

  if (visible.length === 0) {
    return (
      <div className="mag-bookshelf">
        <div className="mag-book is-empty">empty shelf</div>
      </div>
    );
  }

  return (
    <div className="mag-bookshelf">
      {visible.map(blob => (
        <a
          key={blob.uuid}
          href={blob.url}
          className={blob.cover_url ? "mag-book" : "mag-book is-empty"}
        >
          {blob.cover_url ? (
            <img src={blob.cover_url} alt="" loading="lazy" />
          ) : (
            <span>no cover</span>
          )}
        </a>
      ))}
    </div>
  );
}
