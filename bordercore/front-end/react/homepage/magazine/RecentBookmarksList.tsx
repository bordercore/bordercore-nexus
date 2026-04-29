import React from "react";
import { faviconUrl, fillUrlTemplate } from "./utils";
import type { Bookmark } from "../types";

interface RecentBookmarksListProps {
  bookmarks: Bookmark[];
  bookmarkClickUrlTemplate: string;
  limit?: number;
}

export function RecentBookmarksList({
  bookmarks,
  bookmarkClickUrlTemplate,
  limit = 8,
}: RecentBookmarksListProps) {
  const visible = bookmarks.slice(0, limit);

  if (visible.length === 0) {
    return <div className="mag-empty">No recent bookmarks.</div>;
  }

  return (
    <>
      {visible.map(bookmark => {
        const favicon = faviconUrl(bookmark.url);
        return (
          <div key={bookmark.uuid} className="mag-bm-row">
            {favicon ? (
              <img className="mag-fav" src={favicon} alt="" loading="lazy" width={16} height={16} />
            ) : (
              <span className="mag-fav mag-fav-fallback" aria-hidden="true" />
            )}
            <a href={fillUrlTemplate(bookmarkClickUrlTemplate, bookmark.uuid)}>{bookmark.name}</a>
          </div>
        );
      })}
    </>
  );
}
