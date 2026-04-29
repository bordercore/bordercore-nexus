import React from "react";
import { fillUrlTemplate } from "./utils";
import type { Bookmark } from "../types";

interface ReadingListPillsProps {
  bookmarks: Bookmark[];
  bookmarkClickUrlTemplate: string;
}

export function ReadingListPills({ bookmarks, bookmarkClickUrlTemplate }: ReadingListPillsProps) {
  if (bookmarks.length === 0) {
    return <div className="mag-empty">No bookmarks marked as Daily.</div>;
  }

  const total = bookmarks.length;
  const viewed = bookmarks.filter(b => b.daily?.viewed === "true").length;

  return (
    <div className="mag-reading">
      <div className="mag-reading-meta">
        {viewed}/{total} read
      </div>
      <div className="mag-reading-pills">
        {bookmarks.map(bookmark => {
          const isRead = bookmark.daily?.viewed === "true";
          const cls = isRead ? "mag-reading-pill is-read" : "mag-reading-pill";
          return (
            <a
              key={bookmark.uuid}
              className={cls}
              href={fillUrlTemplate(bookmarkClickUrlTemplate, bookmark.uuid)}
              title={bookmark.url}
            >
              {isRead ? (
                <span className="mag-dot-full" aria-hidden="true" />
              ) : (
                <span className="mag-dot-empty" aria-hidden="true" />
              )}
              {bookmark.name}
            </a>
          );
        })}
      </div>
    </div>
  );
}
