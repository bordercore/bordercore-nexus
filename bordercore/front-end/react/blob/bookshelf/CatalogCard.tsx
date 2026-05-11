import React from "react";
import { BookCover } from "./BookCover";
import type { Book } from "../types";

interface CatalogCardProps {
  book: Book;
  /** Tag whose chip should be highlighted in the row's chip cluster. */
  highlightedTag: string | null;
}

/**
 * One row in the "selected drawer" list: cover, title + author + tag chips,
 * year + added date. The whole row is a clickable link to the blob detail
 * page.
 */
export function CatalogCard({ book, highlightedTag }: CatalogCardProps) {
  const selected = (highlightedTag || "").toLowerCase();
  const tags = (book.tags || []).slice(0, 4);

  return (
    <a href={book.url} className="bcc-card">
      <BookCover src={book.cover_url} title={book.name} />

      <div className="bcc-card__body">
        <div className="bcc-card__title" title={book.name}>
          {book.name || "No Title"}
        </div>
        {book.author ? <div className="bcc-card__author">{book.author}</div> : null}
        {tags.length > 0 ? (
          <ul className="bcc-card__tags">
            {tags.map(t => {
              const isActive = t.toLowerCase() === selected;
              return (
                <li key={t} className={`bcc-tagchip${isActive ? " bcc-tagchip--active" : ""}`}>
                  {t}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="bcc-card__meta">
        {book.year ? <span className="bcc-card__year">{book.year}</span> : null}
        {book.created ? <span className="bcc-card__added">added {book.created}</span> : null}
      </div>
    </a>
  );
}
