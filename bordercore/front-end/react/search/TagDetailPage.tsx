import React, { useState, useRef, useCallback } from "react";
import SearchBar, { SearchBarHandle } from "./SearchBar";
import SearchModeNav from "./SearchModeNav";
import type { SearchMode } from "./SearchModeNav";
import SearchResult from "./SearchResult";
import { doPost } from "../utils/reactUtils";
import type { TagDetailResults, TagDetailMatch, DoctypeCount, TagCount } from "./types";
import { DOCTYPE_MAPPING } from "./types";

interface TagDetailPageProps {
  results: TagDetailResults;
  doctypeCounts: DoctypeCount[];
  tagCounts: TagCount[];
  initialTags: string[];
  savedTab: string;
  doctypes: string[];
  tagSearchUrl: string;
  tagsChangedUrl: string;
  termSearchUrl: string;
  semanticSearchUrl: string;
  storeInSessionUrl: string;
}

// Map doctypes to icons (same mapping as SearchResult)
const ICON_MAP: Record<string, string> = {
  blob: "book",
  book: "book",
  bookmark: "bookmark",
  collection: "folder",
  document: "copy",
  drill: "graduation-cap",
  note: "sticky-note",
  song: "music",
  album: "music",
  todo: "tasks",
};

function getTitle(docType: string, match: TagDetailMatch): string {
  if (docType === "drill") return match.question || "";
  if (docType === "song") return match.title || "";
  if (docType === "album") return match.title || "";
  return match.name || "No Title";
}

export function TagDetailPage({
  results,
  doctypeCounts,
  tagCounts,
  initialTags,
  savedTab,
  doctypes,
  tagSearchUrl,
  tagsChangedUrl,
  termSearchUrl,
  semanticSearchUrl,
  storeInSessionUrl,
}: TagDetailPageProps) {
  const enrichedDoctypeCounts = doctypeCounts.map(doctype => ({
    key: doctype[0],
    count: doctype[1],
    displayName: DOCTYPE_MAPPING[doctype[0]] || doctype[0],
  }));

  const getInitialDoctype = () => {
    if (savedTab && doctypes.includes(savedTab)) return savedTab;
    return enrichedDoctypeCounts[0]?.key || "";
  };

  const [selectedDoctype, setSelectedDoctype] = useState(getInitialDoctype);
  const searchBarRef = useRef<SearchBarHandle>(null);

  const handleDoctypeSelect = useCallback(
    (doctype: string) => {
      setSelectedDoctype(doctype);
      doPost(storeInSessionUrl, { search_tag_detail_current_tab: doctype }, () => {});
    },
    [storeInSessionUrl]
  );

  const handleSearchModeChange = useCallback(
    (mode: SearchMode) => {
      if (mode === "term") {
        window.location.href = termSearchUrl;
      } else if (mode === "semantic") {
        window.location.href = semanticSearchUrl;
      }
      // "tag" is current page — no navigation needed
    },
    [termSearchUrl, semanticSearchUrl]
  );

  const totalCount = enrichedDoctypeCounts.reduce((sum, d) => sum + d.count, 0);
  const currentMatches: TagDetailMatch[] = results[selectedDoctype] || [];

  const tagUrl = tagsChangedUrl;

  return (
    <div className="search-page-layout">
      <aside className="search-sidebar">
        <SearchModeNav activeMode="tag" onModeChange={handleSearchModeChange} />

        <hr className="search-sidebar-divider" />

        <div className="search-sidebar-section">
          <h6 className="search-sidebar-label">CONTENT TYPE</h6>
          <div className="search-mode-list">
            {enrichedDoctypeCounts.map(doctype => (
              <button
                key={doctype.key}
                className={`search-mode-btn ${selectedDoctype === doctype.key ? "active" : ""}`}
                onClick={() => handleDoctypeSelect(doctype.key)}
              >
                <span>{doctype.displayName}</span>
                <span className="ms-auto badge rounded-pill bg-secondary">{doctype.count}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="search-main-content">
        <SearchBar
          ref={searchBarRef}
          tagCounts={tagCounts}
          tagSearchUrl={tagSearchUrl}
          tagsChangedUrl={tagsChangedUrl}
          termSearchUrl={termSearchUrl}
          initialTags={initialTags}
          searchMode="tag"
        />

        <div className="search-results-header">
          <div className="search-results-header-left">
            <h4 className="search-results-title">Tag Results</h4>
            <span className="search-results-count">
              Showing {currentMatches.length} of {totalCount} result
              {totalCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="search-results-list">
          {currentMatches.map(match => (
            <div key={match.uuid} className="search-result-card">
              <SearchResult
                icon={ICON_MAP[selectedDoctype] || "book"}
                importance={match.importance || 1}
                title={getTitle(selectedDoctype, match)}
                url={match.object_url}
                tags={match.tags.map(t => t.name)}
                tagUrl={tagUrl}
                metadata={match.date || undefined}
                metadataExtra={selectedDoctype === "bookmark" ? match.url_domain : undefined}
                imageSlot={
                  selectedDoctype === "album" && match.album_artwork_url ? (
                    <img
                      src={match.album_artwork_url}
                      className="search-result-thumbnail"
                      alt=""
                      loading="lazy"
                    />
                  ) : (selectedDoctype === "blob" || selectedDoctype === "book") &&
                    match.cover_url ? (
                    <img
                      src={match.cover_url}
                      className="search-result-thumbnail"
                      alt=""
                      loading="lazy"
                    />
                  ) : undefined
                }
                extraSlot={
                  <>
                    {selectedDoctype === "song" && match.artist && (
                      <div className="search-result-description">{match.artist}</div>
                    )}
                    {selectedDoctype === "album" && match.artist && (
                      <div className="search-result-description">{match.artist}</div>
                    )}
                    {(selectedDoctype === "note" || selectedDoctype === "document") &&
                      match.contents && (
                        <p className="search-result-description">{match.contents}</p>
                      )}
                    {(selectedDoctype === "blob" || selectedDoctype === "book") &&
                      match.creators && (
                        <div className="search-result-creators">{match.creators}</div>
                      )}
                  </>
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TagDetailPage;
