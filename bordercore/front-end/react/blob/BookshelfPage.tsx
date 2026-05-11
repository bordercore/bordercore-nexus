import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { TagIndex } from "./bookshelf/TagIndex";
import { SelectedDrawer } from "./bookshelf/SelectedDrawer";
import { RecentDrawer } from "./bookshelf/RecentDrawer";
import { relativeTime } from "./bookshelf/relativeTime";
import type { BookshelfPageProps } from "./types";

const DRAWER_LS_KEY = "bordercore:bookshelf:drawerOpen";

function readDrawerInitial(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(DRAWER_LS_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

/**
 * Bookshelf — Card Catalog. The page renders a title band, a two-column
 * grid (tag index + selected drawer), and an overlay "Recent Books"
 * pull-out drawer anchored to the right edge.
 *
 * Tag chip clicks and search submissions are plain GET reloads (matches
 * the existing /bookshelf/ behaviour and keeps URL state predictable).
 * The only client-side state we care about is whether the right drawer
 * is open — persisted to localStorage so the preference sticks.
 */
export function BookshelfPage({
  books,
  categories,
  recentBooks,
  selectedTagMeta,
  totalCount,
  searchTerm,
  selectedTag,
  clearUrl,
  bookshelfUrl,
}: BookshelfPageProps) {
  const [searchValue, setSearchValue] = useState(searchTerm || "");
  const [drawerOpen, setDrawerOpen] = useState<boolean>(readDrawerInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAWER_LS_KEY, drawerOpen ? "1" : "0");
    } catch {
      /* localStorage unavailable — silently ignore. */
    }
  }, [drawerOpen]);

  // Mirror the live search query back into ?search=… so the URL stays
  // shareable / refresh-friendly without forcing a server round-trip.
  // We use replaceState to avoid polluting the back-stack with every
  // keystroke.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (searchValue) {
      url.searchParams.set("search", searchValue);
    } else {
      url.searchParams.delete("search");
    }
    window.history.replaceState({}, "", url.toString());
  }, [searchValue]);

  const buildTagHref = useCallback(
    (tagName: string) => {
      const params = new URLSearchParams({ tag: tagName });
      return `${bookshelfUrl}?${params.toString()}`;
    },
    [bookshelfUrl]
  );

  const tagCount = useMemo(
    () => categories.reduce((sum, c) => sum + c.tags.length, 0),
    [categories]
  );

  const lastAddition = recentBooks[0];
  const lastAdditionISO = lastAddition?.created || "";
  const lastAdditionRelative = useMemo(
    () => relativeTime(lastAdditionISO ? `${lastAdditionISO}T00:00:00` : ""),
    [lastAdditionISO]
  );

  // Client-side filter: match on title, author, or any tag, case-insensitive
  // substring. Pure local — operates on whatever the server already returned
  // (which is up to 1000 rows when a tag or ?search= is in the URL). The
  // initial search term arrives as a server-side ES filter; subsequent
  // refinements narrow the loaded set without a reload.
  //
  // The filter only kicks in at 3+ characters so short queries (e.g. "py")
  // don't over-match every book whose author happens to contain those
  // letters. The URL still mirrors whatever the user types — the threshold
  // gates the filter, not the input.
  const MIN_QUERY_LEN = 3;
  const trimmed = searchValue.trim().toLowerCase();
  const effectiveQuery = trimmed.length >= MIN_QUERY_LEN ? trimmed : "";

  const matchesQuery = useCallback(
    (haystacks: Array<string | undefined>) => {
      if (!effectiveQuery) return true;
      return haystacks.some(h => h && h.toLowerCase().includes(effectiveQuery));
    },
    [effectiveQuery]
  );

  // When `?tag=foo` is in the URL, the server still ships every book so
  // tag counts and the rail stay consistent — the client narrows the
  // catalog list to that tag here.
  const tagFilterLower = (selectedTag || "").toLowerCase();
  const matchesTag = useCallback(
    (tags: string[] | undefined) => {
      if (!tagFilterLower) return true;
      return (tags || []).some(t => t.toLowerCase() === tagFilterLower);
    },
    [tagFilterLower]
  );

  const filteredBooks = useMemo(
    () =>
      books.filter(b => matchesTag(b.tags) && matchesQuery([b.name, b.author, ...(b.tags || [])])),
    [books, matchesQuery, matchesTag]
  );

  const filteredRecent = useMemo(
    () => recentBooks.filter(b => matchesQuery([b.name, b.author, ...(b.tags || [])])),
    [recentBooks, matchesQuery]
  );

  const hasFilter = Boolean(trimmed || selectedTag);
  const clearSearch = useCallback(() => setSearchValue(""), []);

  return (
    <div className="bcc-shell">
      <header className="bcc-pagehead">
        <div>
          <h1 className="bcc-pagehead-title">
            <span className="bc-page-title">Bookshelf</span>
          </h1>
          <div className="bcc-pagehead-meta">
            <span className="count">{totalCount}</span> books
            <span className="bcc-pagehead-sep">·</span>
            <span className="count">{tagCount}</span> tags
            {lastAddition ? (
              <>
                <span className="bcc-pagehead-sep">·</span>
                <span>
                  last addition <span className="bcc-pagehead-strong">{lastAddition.name}</span>
                </span>
                {lastAdditionRelative ? (
                  <>
                    <span className="bcc-pagehead-sep">·</span>
                    <span>{lastAdditionRelative}</span>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="bcc-actions">
          <div className="bcc-search" role="search">
            <FontAwesomeIcon icon={faSearch} aria-hidden="true" />
            <input
              type="search"
              name="search"
              placeholder="search titles, authors, tags"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              autoComplete="off"
              aria-label="Search bookshelf"
            />
            {hasFilter ? (
              // When a tag is part of the active filter, the clear pill is
              // a link back to the bare /bookshelf/ URL — the tag lives in
              // the URL so only a navigation can drop it. Otherwise it
              // just blanks the live search (no reload).
              selectedTag ? (
                <a
                  href={clearUrl}
                  className="bcc-search-clear"
                  aria-label="Clear search and tag filter"
                >
                  ×
                </a>
              ) : (
                <button
                  type="button"
                  className="bcc-search-clear"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )
            ) : null}
          </div>
        </div>
      </header>

      <div className="bcc-grid">
        <TagIndex
          categories={categories}
          selectedTag={selectedTag}
          searchQuery={effectiveQuery}
          buildTagHref={buildTagHref}
        />
        <SelectedDrawer
          books={filteredBooks}
          selectedTag={selectedTag}
          selectedTagMeta={selectedTagMeta}
          searchTerm={effectiveQuery || null}
        />

        <RecentDrawer
          books={filteredRecent}
          totalCount={recentBooks.length}
          searchQuery={effectiveQuery}
          open={drawerOpen}
          onToggle={() => setDrawerOpen(v => !v)}
          onClose={() => setDrawerOpen(false)}
        />
      </div>
    </div>
  );
}

export default BookshelfPage;
