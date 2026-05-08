import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPlus } from "@fortawesome/free-solid-svg-icons";
import { PinnedColumn } from "./PinnedColumn";
import { FeaturedRecents } from "./FeaturedRecents";
import { MoreRecent } from "./MoreRecent";
import { TagCloud } from "./TagCloud";
import type { NotesLandingData, NotesLandingUrls } from "./types";

interface NotesLandingPageProps {
  data: NotesLandingData;
  urls: NotesLandingUrls;
}

export function NotesLandingPage({ data, urls }: NotesLandingPageProps) {
  const [query, setQuery] = useState("");

  const featured = useMemo(() => data.recents.slice(0, 3), [data.recents]);
  const more = useMemo(() => data.recents.slice(3, 14), [data.recents]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    const params = new URLSearchParams({ doctype: "note" });
    if (trimmed) params.set("term_search", trimmed);
    window.location.href = `${urls.search}?${params.toString()}`;
  };

  return (
    <div className="nl-app">
      <header className="nl-page-head">
        <div className="nl-page-head-text">
          <h1 className="nl-page-title">Notes</h1>
          <p className="nl-page-sub">
            <span className="count">{data.totals.recents}</span> notes ·{" "}
            <span className="count">{data.totals.pinned}</span> pinned ·{" "}
            <span className="count">{data.totals.tags}</span> tags
          </p>
        </div>
        <div className="nl-page-actions">
          <form className="nl-search" onSubmit={handleSubmit} role="search">
            <FontAwesomeIcon icon={faSearch} aria-hidden="true" />
            <input
              type="search"
              name="query"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="search notes…"
              aria-label="Search notes"
            />
          </form>
          <a href={urls.createNote} className="refined-btn primary">
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" aria-hidden="true" />
            <span>new</span>
          </a>
        </div>
      </header>

      <div className="nl-shell">
        <PinnedColumn initialPinned={data.pinned} sortPinnedUrl={urls.sortPinned} />

        <main className="nl-main">
          {featured.length > 0 ? (
            <FeaturedRecents notes={featured} totalRecents={data.totals.recents} />
          ) : (
            <div className="nl-empty">
              <p>// no notes yet</p>
              <a className="refined-btn primary" href={urls.createNote}>
                + create your first note
              </a>
            </div>
          )}
          <MoreRecent notes={more} />
          <TagCloud
            tags={data.tag_counts}
            totalDistinct={data.totals.tags}
            tagDetailUrl={urls.tagDetail}
          />
        </main>
      </div>
    </div>
  );
}

export default NotesLandingPage;
