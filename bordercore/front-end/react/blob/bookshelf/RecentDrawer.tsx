import React from "react";
import type { RecentBook } from "../types";

interface RecentDrawerProps {
  books: RecentBook[];
  /** Total count of recent books before client-side search filtering. */
  totalCount: number;
  /** Trimmed lowercase search query — drives the filtered subhead + empty copy. */
  searchQuery: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * Pull-out drawer overlaying the right edge of the main grid. The vertical
 * tab handle is always visible; clicking it (or the `×` close button)
 * toggles the panel via `onToggle` / `onClose`. The body lists the last
 * eight book additions.
 */
export function RecentDrawer({
  books,
  totalCount,
  searchQuery,
  open,
  onToggle,
  onClose,
}: RecentDrawerProps) {
  const filtering = searchQuery.length > 0;
  const subhead = filtering
    ? `${books.length} of ${totalCount} match${books.length === 1 ? "" : "es"}`
    : `last ${books.length} addition${books.length === 1 ? "" : "s"} · sorted by date`;
  const emptyCopy = filtering ? "No recent additions match." : "No new books in the last 30 days.";

  return (
    <div className={`bcc-recent${open ? " bcc-recent--open" : ""}`} aria-hidden={false}>
      <button
        type="button"
        className="bcc-recent__handle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="bcc-recent-panel"
      >
        <span className="bcc-recent__handle-glyph" aria-hidden="true">
          {open ? "▶" : "◀"}
        </span>
        <span className="bcc-recent__handle-label">recent · {books.length}</span>
      </button>

      <aside id="bcc-recent-panel" className="bcc-recent__panel" aria-label="Recent Books">
        <header className="bcc-recent__head">
          <span className="bcc-recent__label">// new arrivals</span>
          <button
            type="button"
            className="bcc-recent__close"
            onClick={onClose}
            aria-label="Close Recent Books"
          >
            ×
          </button>
        </header>
        <h2 className="bcc-recent__title">Recent Books</h2>
        <p className="bcc-recent__subhead">{subhead}</p>

        <div className="bcc-recent__cols">
          <span>#</span>
          <span>title · author · tags</span>
          <span className="bcc-recent__cols-right">added</span>
        </div>

        {books.length === 0 ? (
          <div className="bcc-recent__empty">{emptyCopy}</div>
        ) : (
          <ol className="bcc-recent__list">
            {books.map((book, idx) => (
              <li key={book.uuid}>
                <a href={book.url} className="bcc-recent__row">
                  <span className="bcc-recent__idx">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="bcc-recent__cell">
                    <span className="bcc-recent__title-line">
                      <span className="bcc-recent__row-title" title={book.name}>
                        {book.name || "No Title"}
                      </span>
                      {book.year ? <span className="bcc-recent__row-year">{book.year}</span> : null}
                    </span>
                    {book.author ? (
                      <span className="bcc-recent__row-author">{book.author}</span>
                    ) : null}
                    {book.tags.length > 0 ? (
                      <ul className="bcc-recent__row-tags">
                        {book.tags.slice(0, 3).map(t => (
                          <li key={t} className="bcc-recent__row-tag">
                            {t}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </span>
                  <span className="bcc-recent__added">added {book.created}</span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
