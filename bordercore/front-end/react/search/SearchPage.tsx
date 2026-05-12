import React, { useEffect, useRef, useCallback, useState } from "react";
import SearchBar, { SearchBarHandle } from "./SearchBar";
import SearchResult from "./SearchResult";
import SearchNoResult from "./SearchNoResult";
import Pagination from "./Pagination";
import SearchSidebar from "./SearchSidebar";
import { doGet } from "../utils/reactUtils";
import type { SearchMatch, SearchSource, Aggregation, Paginator, SearchApiResponse } from "./types";

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
  searchApiUrl: string;
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
  results: initialResults,
  aggregations: initialAggregations,
  paginator: initialPaginator,
  count: initialCount,
  currentDoctype: initialDoctype,
  searchTerm: initialSearchTerm,
  searchSemantic: initialSearchSemantic,
  exactMatchInitial,
  sortByInitial,
  searchApiUrl,
  tagSearchUrl,
  tagsChangedUrl,
  termSearchUrl,
  semanticSearchUrl,
  tagUrl,
  imagesUrl,
  hasRequest: initialHasRequest,
  activeTags: initialActiveTags,
}: SearchPageProps) {
  const searchBarRef = useRef<SearchBarHandle>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Search state — initialized from server-rendered props
  const [results, setResults] = useState<SearchMatch[]>(initialResults);
  const [aggregations, setAggregations] = useState<Aggregation[]>(initialAggregations);
  const [paginator, setPaginator] = useState<Paginator>(initialPaginator);
  const [count, setCount] = useState(initialCount);
  const [searchTermState, setSearchTermState] = useState(initialSearchTerm);
  const [searchSemanticState, setSearchSemanticState] = useState(initialSearchSemantic);
  const [sortBy, setSortBy] = useState(sortByInitial);
  const [currentDoctype, setCurrentDoctype] = useState(initialDoctype);
  const [exactMatch, setExactMatch] = useState(exactMatchInitial);
  const [activeTagsState, setActiveTagsState] = useState<string[]>(initialActiveTags);
  const [currentPage, setCurrentPage] = useState(initialPaginator?.page_number || 1);
  const [hasRequest, setHasRequest] = useState(initialHasRequest);
  const [isLoading, setIsLoading] = useState(false);

  // Determine initial search mode from URL params
  const getInitialSearchMode = (): SearchMode => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("semantic_search")) return "semantic";
    if (params.has("tag_search")) return "tag";
    return "term";
  };
  const [searchMode, setSearchMode] = useState<SearchMode>(getInitialSearchMode);

  // Build URLSearchParams from current state
  const buildSearchParams = useCallback(
    (overrides: Record<string, string | string[] | undefined> = {}) => {
      const params = new URLSearchParams();

      const term =
        overrides.term_search !== undefined ? (overrides.term_search as string) : searchTermState;
      const semantic =
        overrides.semantic_search !== undefined
          ? (overrides.semantic_search as string)
          : searchSemanticState;
      const sort = overrides.sort !== undefined ? (overrides.sort as string) : sortBy;
      const doctype =
        overrides.doctype !== undefined ? (overrides.doctype as string) : currentDoctype;
      const exact =
        overrides.exact_match !== undefined ? (overrides.exact_match as string) : exactMatch;
      const tags = overrides.tags !== undefined ? (overrides.tags as string[]) : activeTagsState;
      const page = overrides.page !== undefined ? (overrides.page as string) : String(currentPage);

      if (term) params.set("term_search", term);
      if (semantic) params.set("semantic_search", semantic);
      if (sort && sort !== "_score") params.set("sort", sort);
      if (doctype) params.set("doctype", doctype);
      if (exact === "Yes") params.set("exact_match", "Yes");
      if (tags) {
        for (const tag of tags) {
          params.append("tags", tag);
        }
      }
      if (page && page !== "1") params.set("page", page);

      return params;
    },
    [
      searchTermState,
      searchSemanticState,
      sortBy,
      currentDoctype,
      exactMatch,
      activeTagsState,
      currentPage,
    ]
  );

  // Fetch results from API and update state
  const fetchResults = useCallback(
    (params: URLSearchParams, pushHistory = true) => {
      setIsLoading(true);

      const url = `${searchApiUrl}?${params.toString()}`;
      doGet(
        url,
        (response: { data: SearchApiResponse }) => {
          const data = response.data;
          setResults(data.results);
          setAggregations(data.aggregations);
          setPaginator(data.paginator);
          setCount(data.count);
          setHasRequest(true);
          setIsLoading(false);

          // Sync URL
          const newUrl = `${window.location.pathname}?${params.toString()}`;
          if (pushHistory) {
            history.pushState({ searchParams: params.toString() }, "", newUrl);
          }
        },
        "Search failed"
      );
    },
    [searchApiUrl]
  );

  // Capture initial state for popstate
  useEffect(() => {
    history.replaceState(
      { searchParams: new URLSearchParams(window.location.search).toString() },
      "",
      window.location.href
    );
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.searchParams !== undefined) {
        const params = new URLSearchParams(e.state.searchParams);

        // Update local state from params
        setSearchTermState(params.get("term_search") || "");
        setSearchSemanticState(params.get("semantic_search") || "");
        setSortBy(params.get("sort") || "_score");
        setCurrentDoctype(params.get("doctype") || "");
        setExactMatch(params.get("exact_match") || "No");
        setActiveTagsState(params.getAll("tags"));
        setCurrentPage(parseInt(params.get("page") || "1", 10));

        if (params.has("semantic_search")) {
          setSearchMode("semantic");
        } else {
          setSearchMode("term");
        }

        // Only fetch if there's actually a search to perform
        if (params.get("term_search") || params.get("semantic_search") || params.get("search")) {
          fetchResults(params, false);
        } else {
          // Reset to empty state
          setResults([]);
          setAggregations([]);
          setPaginator(initialPaginator);
          setCount(0);
          setHasRequest(false);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [fetchResults, initialPaginator]);

  useEffect(() => {
    searchBarRef.current?.focusTermSearch();
  }, []);

  // --- Callbacks for child components ---

  const handleSearch = useCallback(
    (term: string) => {
      setSearchTermState(term);
      setSearchSemanticState("");
      setCurrentPage(1);
      const params = buildSearchParams({ term_search: term, semantic_search: "", page: "1" });
      fetchResults(params);
    },
    [buildSearchParams, fetchResults]
  );

  const handleSemanticSearch = useCallback(
    (term: string) => {
      setSearchSemanticState(term);
      setSearchTermState("");
      setCurrentPage(1);
      const params = buildSearchParams({ semantic_search: term, term_search: "", page: "1" });
      fetchResults(params);
    },
    [buildSearchParams, fetchResults]
  );

  const handleDoctypeSelect = useCallback(
    (selectedDoctype: string) => {
      const newDoctype = selectedDoctype === currentDoctype ? "" : selectedDoctype;
      setCurrentDoctype(newDoctype);
      setCurrentPage(1);
      const params = buildSearchParams({ doctype: newDoctype, page: "1" });
      fetchResults(params);
    },
    [currentDoctype, buildSearchParams, fetchResults]
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      setSortBy(sort);
      setCurrentPage(1);
      const params = buildSearchParams({ sort, page: "1" });
      fetchResults(params);
    },
    [buildSearchParams, fetchResults]
  );

  const handleExactMatchChange = useCallback(
    (enabled: boolean) => {
      const value = enabled ? "Yes" : "No";
      setExactMatch(value);
      setCurrentPage(1);
      const params = buildSearchParams({ exact_match: value, page: "1" });
      fetchResults(params);
    },
    [buildSearchParams, fetchResults]
  );

  const handleTagToggle = useCallback(
    (tag: string, checked: boolean) => {
      const newTags = checked ? [...activeTagsState, tag] : activeTagsState.filter(t => t !== tag);
      setActiveTagsState(newTags);
      setCurrentPage(1);
      const params = buildSearchParams({ tags: newTags, page: "1" });
      fetchResults(params);
    },
    [activeTagsState, buildSearchParams, fetchResults]
  );

  const handleReset = useCallback(() => {
    setCurrentDoctype("");
    setExactMatch("No");
    setSortBy("_score");
    setActiveTagsState([]);
    setCurrentPage(1);
    const params = buildSearchParams({
      doctype: "",
      exact_match: "No",
      sort: "_score",
      tags: [],
      page: "1",
    });
    fetchResults(params);
  }, [buildSearchParams, fetchResults]);

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      const params = buildSearchParams({ page: String(page) });
      fetchResults(params);
      // Scroll to top of results
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [buildSearchParams, fetchResults]
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
          return (JSON.parse(match.tags_json || "[]") as string[] | null) ?? [];
        } catch {
          return [];
        }
      })
    )
  ).slice(0, 20);

  const getPdfViewerUrl = (source: SearchSource) => {
    if (source.filename?.toLowerCase().endsWith(".pdf") && source.uuid) {
      const term = searchTermState || searchSemanticState;
      return `/blob/${source.uuid}/pdf-viewer/?search=${encodeURIComponent(term)}`;
    }
    return source.url;
  };

  return (
    <div className="search-page-layout">
      <SearchSidebar
        searchMode={searchMode}
        onSearchModeChange={handleSearchModeChange}
        aggregations={aggregations}
        currentDoctype={currentDoctype}
        onDoctypeSelect={handleDoctypeSelect}
        exactMatchInitial={exactMatch}
        sortByInitial={sortBy}
        allTags={allTags}
        activeTags={activeTagsState}
        hasResults={hasResults}
        filtersDisabled={!hasRequest}
        onSortChange={handleSortChange}
        onExactMatchChange={handleExactMatchChange}
        onTagToggle={handleTagToggle}
        onReset={handleReset}
      />
      <div className="search-main-content">
        <h1>
          <span className="bc-page-title">Search</span>{" "}
          <span className="dim">— across your knowledge base</span>
        </h1>
        <SearchBar
          ref={searchBarRef}
          exactMatchInitial={exactMatch}
          searchTermInitial={searchTermState}
          searchSemanticInitial={searchSemanticState}
          sortByInitial={sortBy}
          tagSearchUrl={tagSearchUrl}
          tagsChangedUrl={tagsChangedUrl}
          termSearchUrl={termSearchUrl}
          semanticSearchUrl={semanticSearchUrl}
          searchMode={searchMode}
          onSearch={handleSearch}
          onSemanticSearch={handleSemanticSearch}
        />
        <div className={`search-results-area ${isLoading ? "search-loading" : ""}`}>
          {isLoading && (
            <div className="search-loading-overlay">
              <div className="search-loading-spinner" />
            </div>
          )}
          {hasRequest && (
            <>
              {!hasResults && !isLoading ? (
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
                      const tags: string[] = JSON.parse(match.tags_json || "[]") ?? [];
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
                                <div className="flex items-center text-accent">
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
                              url={getPdfViewerUrl(source)}
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
                              url={getPdfViewerUrl(source)}
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

                  <div className="flex justify-center">
                    <Pagination paginator={paginator} onPageChange={handlePageChange} />
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
