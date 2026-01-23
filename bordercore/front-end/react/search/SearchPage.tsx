import React, { useEffect, useRef, useCallback } from "react";
import SearchBar, { SearchBarHandle } from "./SearchBar";
import SearchResult from "./SearchResult";
import SearchNoResult from "./SearchNoResult";
import Pagination from "./Pagination";
import DoctypeSidebar from "./DoctypeSidebar";
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
}

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
}: SearchPageProps) {
  const searchBarRef = useRef<SearchBarHandle>(null);

  useEffect(() => {
    searchBarRef.current?.focusTermSearch();
  }, []);

  const handleDoctypeSelect = useCallback((selectedDoctype: string) => {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("doctype", selectedDoctype === currentDoctype ? "" : selectedDoctype);
    window.location.search = searchParams.toString();
  }, [currentDoctype]);

  const truncateDescription = useCallback((text: string, maxLength = 150) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  }, []);

  const hasResults = results.length > 0;

  // Note: dangerouslySetInnerHTML is used throughout this component for highlighted
  // search terms and other backend-generated HTML. This matches the Vue version's
  // use of v-html. All content is from the trusted backend.

  return (
    <div className="row g-0 h-100 mx-2">
      <DoctypeSidebar
        aggregations={aggregations}
        currentDoctype={currentDoctype}
        onDoctypeSelect={handleDoctypeSelect}
        hasResults={hasResults}
      />
      <div className="col-lg-9 ps-4">
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
        />
        <div>
          {hasRequest && (
            <>
              {!hasResults ? (
                <SearchNoResult />
              ) : (
                <>
                  <h4 className="search-result-header ms-4">
                    Total matches: <strong>{count}</strong>
                  </h4>

                  <ul className="list-unstyled">
                    {results.map((match, index) => {
                      const tags = JSON.parse(match.tags_json || "[]");
                      const source = match.source;
                      const isImportant = source.importance === 10;

                      return (
                        <li
                          key={`${source.url}-${index}`}
                          className={`search-result mx-2 ${isImportant ? "important" : ""}`}
                        >
                          <div className="d-flex my-1">
                            {source.doctype === "drill" && (
                              <SearchResult
                                icon="graduation-cap"
                                importance={source.importance || 1}
                                title={source.question || ""}
                                url={source.url}
                                tags={tags}
                                tagUrl={tagUrl}
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
                                extraSlot={
                                  <div className="d-flex ms-2 align-items-center text-primary">
                                    <img
                                      src={`https://www.bordercore.com/favicons/${source.domain}.ico`}
                                      width="32"
                                      height="32"
                                      alt=""
                                    />
                                    <div
                                      className="ms-2"
                                      dangerouslySetInnerHTML={{ __html: source.domain || "" }}
                                    />
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
                                extraSlot={
                                  match.highlight?.contents?.[0] && (
                                    <h5
                                      className="ms-2"
                                      dangerouslySetInnerHTML={{
                                        __html: match.highlight.contents[0],
                                      }}
                                    />
                                  )
                                }
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
                                extraSlot={
                                  <>
                                    {match.highlight?.contents?.[0] && (
                                      <h5
                                        className="ms-2"
                                        dangerouslySetInnerHTML={{
                                          __html: match.highlight.contents[0],
                                        }}
                                      />
                                    )}
                                    {source.creators && (
                                      <div
                                        className="ms-2 text-secondary"
                                        dangerouslySetInnerHTML={{
                                          __html: `<small>${source.creators}</small>`,
                                        }}
                                      />
                                    )}
                                  </>
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
                                imageSlot={
                                  <div className="mx-2">
                                    <img
                                      src={`${imagesUrl}artist_images/${source.artist_uuid}`}
                                      className="search-result-music"
                                      alt=""
                                    />
                                  </div>
                                }
                                extraSlot={
                                  <h5
                                    className="ms-2"
                                    dangerouslySetInnerHTML={{ __html: source.artist || "" }}
                                  />
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
                                imageSlot={
                                  <div className="mx-2">
                                    <img
                                      src={`${imagesUrl}album_artwork/${source.uuid}`}
                                      height="150"
                                      width="150"
                                      alt=""
                                    />
                                  </div>
                                }
                                extraSlot={
                                  <h5
                                    className="ms-2"
                                    dangerouslySetInnerHTML={{ __html: source.artist || "" }}
                                  />
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
                                imageSlot={
                                  source.cover_url && (
                                    <div className="mx-2">
                                      <img
                                        src={source.cover_url}
                                        height="75"
                                        width="75"
                                        alt=""
                                      />
                                    </div>
                                  )
                                }
                                extraSlot={
                                  source.description && (
                                    <h5 className="ms-2">
                                      {truncateDescription(source.description)}
                                    </h5>
                                  )
                                }
                              />
                            )}

                            {/* Default: book, blob, or unknown doctype */}
                            {!["drill", "todo", "bookmark", "note", "document", "song", "album", "collection"].includes(
                              source.doctype
                            ) && (
                              <SearchResult
                                icon="book"
                                importance={source.importance || 1}
                                title={source.name || ""}
                                url={source.url}
                                tags={tags}
                                tagUrl={tagUrl}
                                imageSlot={
                                  source.cover_url && (
                                    <div className="mx-2">
                                      <img src={source.cover_url} alt="" />
                                    </div>
                                  )
                                }
                                extraSlot={
                                  <>
                                    {match.highlight?.attachment_content?.[0] && (
                                      <h5
                                        className="ms-2"
                                        dangerouslySetInnerHTML={{
                                          __html: match.highlight.attachment_content[0],
                                        }}
                                      />
                                    )}
                                    {source.creators && (
                                      <div
                                        className="ms-2 text-secondary"
                                        dangerouslySetInnerHTML={{
                                          __html: `<small>${source.creators}</small>`,
                                        }}
                                      />
                                    )}
                                  </>
                                }
                              />
                            )}

                            <div
                              className="search-result-date text-nowrap ms-auto pe-4"
                              dangerouslySetInnerHTML={{ __html: source.date || "" }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>

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
