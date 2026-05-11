import React from "react";
import { CatalogCard } from "./CatalogCard";
import type { Book, SelectedTagMeta } from "../types";

interface SelectedDrawerProps {
  books: Book[];
  selectedTag: string | null;
  selectedTagMeta: SelectedTagMeta | null;
  searchTerm: string | null;
}

/**
 * Right column of the main grid. Shows the catalog "drawer" pulled out for
 * the currently-selected tag (or the matching books for a search), or an
 * empty-state pointer when neither is set.
 */
export function SelectedDrawer({
  books,
  selectedTag,
  selectedTagMeta,
  searchTerm,
}: SelectedDrawerProps) {
  const heading = (() => {
    if (searchTerm) {
      return (
        <h2 className="bcc-selected__heading">
          <span className="bcc-selected__heading-prefix">search:</span> {searchTerm}
        </h2>
      );
    }
    if (selectedTag) {
      return (
        <h2 className="bcc-selected__heading">
          <span className="bcc-selected__heading-prefix">#</span>
          {selectedTag}
        </h2>
      );
    }
    return <h2 className="bcc-selected__heading">All books</h2>;
  })();

  const subline = (() => {
    if (searchTerm) {
      return `${books.length} match${books.length === 1 ? "" : "es"}`;
    }
    if (selectedTagMeta) {
      const cat = selectedTagMeta.category ? ` · ${selectedTagMeta.category}` : "";
      return `${selectedTagMeta.count} books${cat}`;
    }
    return `${books.length} books · all tags`;
  })();

  return (
    <section className="bcc-selected">
      <div className="bcc-selected__title-row">
        {heading}
        <span className="bcc-selected__subline">{subline}</span>
      </div>

      {books.length === 0 ? (
        <div className="bcc-selected__empty">
          {selectedTag || searchTerm
            ? "No matching books."
            : "No tag selected. Pick one from the index."}
        </div>
      ) : (
        <ul className="bcc-selected__list">
          {books.map(book => (
            <li key={book.uuid}>
              <CatalogCard book={book} highlightedTag={selectedTag} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
