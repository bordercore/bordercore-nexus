import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe, faTimes } from "@fortawesome/free-solid-svg-icons";
import type { PinnedBookmark } from "./types";

interface BookmarkPinnedBookmarksProps {
  bookmarks: PinnedBookmark[];
  onUnpin: (uuid: string) => void;
}

export function BookmarkPinnedBookmarks({ bookmarks, onUnpin }: BookmarkPinnedBookmarksProps) {
  if (bookmarks.length === 0) {
    return null;
  }

  return (
    <section className="bookmark-rail-section bookmark-pinned-bookmarks">
      <div className="bookmark-rail-section-head">bookmarks</div>
      <ul className="bookmark-rail-list">
        {bookmarks.map(bookmark => (
          <li
            key={bookmark.uuid}
            className="refined-side-item bookmark-pinned-bookmark-item hover-reveal-target"
          >
            <a
              className="bookmark-pinned-bookmark-link"
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              title={bookmark.name}
            >
              {bookmark.favicon_url ? (
                <img
                  className="bookmark-pinned-bookmark-favicon"
                  src={bookmark.favicon_url}
                  width={24}
                  height={24}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="bookmark-pinned-bookmark-favicon fallback">
                  <FontAwesomeIcon icon={faGlobe} />
                </span>
              )}
              <span className="bookmark-pinned-bookmark-name">{bookmark.name}</span>
            </a>
            <button
              type="button"
              className="bookmark-pinned-bookmark-unpin hover-reveal-object"
              aria-label={`Unpin ${bookmark.name}`}
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onUnpin(bookmark.uuid);
              }}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default BookmarkPinnedBookmarks;
