import React from "react";
import { extractHost, fillUrlTemplate } from "./utils";
import type { Bookmark } from "../types";

interface DailyBookmarksListProps {
  bookmarks: Bookmark[];
  bookmarkClickUrlTemplate: string;
}

export function DailyBookmarksList({
  bookmarks,
  bookmarkClickUrlTemplate,
}: DailyBookmarksListProps) {
  if (bookmarks.length === 0) {
    return (
      <>
        <div className="mag-daily-head">
          <span className="mag-ucase">today's routine</span>
          <span className="mag-meta">0/0 read</span>
        </div>
        <div className="mag-empty">No bookmarks marked as Daily.</div>
      </>
    );
  }

  const total = bookmarks.length;
  const viewed = bookmarks.filter(b => b.daily?.viewed === "true").length;

  return (
    <>
      <div className="mag-daily-head">
        <span className="mag-ucase">today's routine</span>
        <span className="mag-meta">
          {viewed}/{total} read
        </span>
      </div>
      <div className="mag-daily">
        {bookmarks.map(bookmark => {
          const isViewed = bookmark.daily?.viewed === "true";
          const rowClass = isViewed ? "mag-daily-row is-viewed" : "mag-daily-row";
          return (
            <div key={bookmark.uuid} className={rowClass}>
              {isViewed ? (
                <span className="mag-dot-full" aria-hidden="true" />
              ) : (
                <span className="mag-dot-empty" aria-hidden="true" />
              )}
              <span className="mag-daily-name">
                <a href={fillUrlTemplate(bookmarkClickUrlTemplate, bookmark.uuid)}>
                  {bookmark.name}
                </a>
              </span>
              <span className="mag-daily-url">{extractHost(bookmark.url)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
