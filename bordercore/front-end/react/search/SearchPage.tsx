import React, { useEffect, useRef, useCallback, useState } from "react";
import SearchBar, { SearchBarHandle } from "./SearchBar";
import SearchResult from "./SearchResult";
import SearchNoResult from "./SearchNoResult";
import Pagination from "./Pagination";
import SearchSidebar from "./SearchSidebar";
import type { SearchMatch, Aggregation, Paginator } from "./types";

interface SearchPageProps {
  results: SearchMatch[];
  aggregations: Aggregation[];
  paginator: Paginator;
  count: number;
  currentDoctype: string;
  searchTerm: string;
  searchSemantic: string;
  exactMatchInitial: string;
  sortByInitial: string;
  tagSearchUrl: string;
  tagsChangedUrl: string;
  termSearchUrl: string;
  semanticSearchUrl: string;
  tagUrl: string;
  imagesUrl: string;
  hasRequest: boolean;
  activeTags: string[];
}

type ViewMode = "list" | "grid";
type SearchMode = "term" | "tag" | "semantic";

export function SearchPage({
  results,
  aggregations,
  paginator,
  count,
  currentDoctype,
  searchTerm,
  searchSemantic,
  exactMatchInitial,
  sortByInitial,
  tagSearchUrl,
  tagsChangedUrl,
  termSearchUrl,
  semanticSearchUrl,
  tagUrl,
  imagesUrl,
  hasRequest,
  activeTags,
}: SearchPageProps) {
  const searchBarRef = useRef<SearchBarHandle>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Determine initial search mode from URL params
  const getInitialSearchMode = (): SearchMode => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("semantic_search")) return "semantic";
    if (params.has("tag_search")) return "tag";
    return "term";
  };
  const [searchMode, setSearchMode] = useState<SearchMode>(getInitialSearchMode);

  useEffect(() => {
    searchBarRef.current?.focusTermSearch();
  }, []);

  const handleDoctypeSelect = useCallback(
    (selectedDoctype: string) => {
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set("doctype", selectedDoctype === currentDoctype ? "" : selectedDoctype);
      window.location.search = searchParams.toString();
    },
    [currentDoctype]
  );

  const handleSearchModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    if (mode === "term") {
      searchBarRef.current?.focusTermSearch();
    }
  }, []);

  const truncateDescription = useCallback((text: string, maxLength = 150) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  }, []);

  const resultsList = Array.isArray(results) ? results : [];
  const hasResults = resultsList.length > 0;

  // Collect all unique tags from results for sidebar filter
  const allTags = Array.from(
    new Set(
      resultsList.flatMap(match => {
        try {
          return JSON.parse(match.tags_json || "[]") as string[];
        } catch {
          return [];
        }
      })
    )
  ).slice(0, 20);

  // Note: dangerouslySetInnerHTML is used for highlighted search terms from the
  // trusted backend (Elasticsearch). This is the established pattern in this codebase.

  return (
    <div className="search-page-layout">
      <SearchSidebar
        searchMode={searchMode}
        onSearchModeChange={handleSearchModeChange}
        aggregations={aggregations}
        currentDoctype={currentDoctype}
        onDoctypeSelect={handleDoctypeSelect}
        exactMatchInitial={exactMatchInitial}
        sortByInitial={sortByInitial}
        allTags={allTags}
        activeTags={activeTags}
        hasResults={hasResults}
        filtersDisabled={!hasRequest}
      />
      <div className="search-main-content">
        <SearchBar
          ref={searchBarRef}
          exactMatchInitial={exactMatchInitial}
          searchTermInitial={searchTerm}
          searchSemanticInitial={searchSemantic}
          sortByInitial={sortByInitial}
          tagSearchUrl={tagSearchUrl}
          tagsChangedUrl={tagsChangedUrl}
          termSearchUrl={termSearchUrl}
          semanticSearchUrl={semanticSearchUrl}
          searchMode={searchMode}
        />
        <div>
          {hasRequest && (
            <>
              {!hasResults ? (
                <SearchNoResult />
              ) : (
                <>
                  <div className="search-results-header">
                    <div className="search-results-header-left">
                      <h4 className="search-results-title">Search Results</h4>
                      <span className="search-results-count">
                        Showing {count} result{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="search-view-toggles">
                      <button
                        className={`search-view-toggle ${viewMode === "list" ? "active" : ""}`}
                        onClick={() => setViewMode("list")}
                        title="List view"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                          <rect x="0" y="1" width="18" height="2" rx="1" />
                          <rect x="0" y="5" width="18" height="2" rx="1" />
                          <rect x="0" y="9" width="18" height="2" rx="1" />
                          <rect x="0" y="13" width="18" height="2" rx="1" />
                        </svg>
                      </button>
                      <button
                        className={`search-view-toggle ${viewMode === "grid" ? "active" : ""}`}
                        onClick={() => setViewMode("grid")}
                        title="Grid view"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                          <rect x="0" y="0" width="7" height="7" rx="1.5" />
                          <rect x="10" y="0" width="7" height="7" rx="1.5" />
                          <rect x="0" y="10" width="7" height="7" rx="1.5" />
                          <rect x="10" y="10" width="7" height="7" rx="1.5" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className={`search-results-${viewMode}`}>
                    {resultsList.map((match, index) => {
                      const tags = JSON.parse(match.tags_json || "[]");
                      const source = match.source;
                      const isImportant = source.importance === 10;

                      return (
                        <div
                          key={`${source.url}-${index}`}
                          className={`search-result-card ${isImportant ? "important" : ""}`}
                        >
                          {source.doctype === "drill" && (
                            <SearchResult
                              icon="graduation-cap"
                              importance={source.importance || 1}
                              title={source.question || ""}
                              url={source.url}
                              tags={tags}
                              tagUrl={tagUrl}
                              metadata={source.last_modified}
                            />
                          )}

                          {source.doctype === "todo" && (
                            <SearchResult
                              icon="tasks"
                              importance={source.importance || 1}
                              title={source.name || ""}
                              url={source.url}
                              tags={tags}
                              tagUrl={tagUrl}
                              metadata={source.last_modified}
                            />
                          )}

                          {source.doctype === "bookmark" && (
                            <SearchResult
                              icon="bookmark"
                              importance={source.importance || 1}
                              title={source.name || ""}
                              url={source.url}
                              tags={tags}
                              tagUrl={tagUrl}
                              metadata={source.last_modified}
                              metadataExtra={source.domain}
                              extraSlot={
                                <div className="d-flex align-items-center text-primary">
                                  <img
                                    src={`https://www.bordercore.com/favicons/${source.domain}.ico`}
                                    width="20"
                                    height="20"
                                    alt=""
                                  />
                                  <div className="ms-2 search-result-domain">
                                    {source.domain || ""}
                                  </div>
                                </div>
                              }
                            />
                          )}

                          {source.doctype === "note" && (
                            <SearchResult
                              icon="sticky-note"
                              importance={source.importance || 1}
                              title={source.name || ""}
                              url={source.url}
                              tags={tags}
                              tagUrl={tagUrl}
                              metadata={source.last_modified}
                              highlightHtml={match.highlight?.contents?.[0]}
                            />
                          )}

                          {source.doctype === "document" && (
                            <SearchResult
                              icon="copy"
                              importance={source.importance || 1}
                              title={source.name || ""}
                              url={source.url}
                              tags={tags}
                              tagUrl={tagUrl}
                              metadata={source.last_modified}
                              metadataExtra={source.filename}
                              highlightHtml={match.highlight?.contents?.[0]}
                              extraSlot={
                                source.creators ? (
                                  <div className="search-result-creators">{source.creators}</div>
                                ) : undefined
                              }
                            />
                          )}

                          {source.doctype === "song" && (
                            <SearchResult
                              icon="music"
                              importance={source.importance || 1}
                              title={source.title || ""}
                              url={source.url}
                              tags={tags}
                              tagUrl={tagUrl}
                              metadata={source.last_modified}
                              imageSlot={
                                <img
                                  src={`${imagesUrl}artist_images/${source.artist_uuid}`}
                                  className="search-result-thumbnail"
                                  alt=""
                                />
                              }
                              extraSlot={
                                <div className="search-result-description">
                                  {source.artist || ""}
                                </div>
                              }
                            />
                          )}

                          {source.doctype === "album" && (
                            <SearchResult
                              icon="music"
                              importance={source.importance || 1}
                              title={source.title || ""}
                              url={source.url}
                              tags={tags}
                              tagUrl={tagUrl}
                              metadata={source.last_modified}
                              imageSlot={
                                <img
                                  src={`${imagesUrl}album_artwork/${source.uuid}`}
                                  className="search-result-thumbnail"
                                  alt=""
                                />
                              }
                              extraSlot={
                                <div className="search-result-description">
                                  {source.artist || ""}
                                </div>
                              }
                            />
                          )}

                          {source.doctype === "collection" && (
                            <SearchResult
                              icon="folder"
                              importance={source.importance || 1}
                              title={source.name || ""}
                              url={source.url}
                              tags={tags}
                              tagUrl={tagUrl}
                              metadata={source.last_modified}
                              imageSlot={
                                source.cover_url ? (
                                  <img
                                    src={source.cover_url}
                                    className="search-result-thumbnail"
                                    alt=""
                                  />
                                ) : undefined
                              }
                              extraSlot={
                                source.description ? (
                                  <p className="search-result-description">
                                    {truncateDescription(source.description)}
                                  </p>
                                ) : undefined
                              }
                            />
                          )}

                          {/* Default: book, blob, or unknown doctype */}
                          {![
                            "drill",
                            "todo",
                            "bookmark",
                            "note",
                            "document",
                            "song",
                            "album",
                            "collection",
                          ].includes(source.doctype) && (
                            <SearchResult
                              icon="book"
                              importance={source.importance || 1}
                              title={source.name || ""}
                              url={source.url}
                              tags={tags}
                              tagUrl={tagUrl}
                              metadata={source.last_modified}
                              metadataExtra={source.filename}
                              highlightHtml={match.highlight?.attachment_content?.[0]}
                              imageSlot={
                                source.cover_url ? (
                                  <img
                                    src={source.cover_url}
                                    className="search-result-thumbnail"
                                    alt=""
                                  />
                                ) : undefined
                              }
                              extraSlot={
                                source.creators ? (
                                  <div className="search-result-creators">{source.creators}</div>
                                ) : undefined
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="d-flex justify-content-center">
                    <Pagination paginator={paginator} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPage;
