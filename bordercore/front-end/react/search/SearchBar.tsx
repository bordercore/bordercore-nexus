import React, { useState, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import TagsInput, { TagsInputHandle } from "../common/TagsInput";
import type { TagCount } from "./types";

interface SearchBarProps {
  exactMatchInitial?: string;
  searchTermInitial?: string;
  searchSemanticInitial?: string;
  sortByInitial?: string;
  tagCounts?: TagCount[];
  tagsChangedUrl: string;
  tagSearchUrl: string;
  termSearchUrl: string;
  semanticSearchUrl?: string;
  initialTags?: string[];
}

export interface SearchBarHandle {
  focusTagSearch: () => void;
  focusTermSearch: () => void;
}

export const SearchBar = forwardRef<SearchBarHandle, SearchBarProps>(function SearchBar(
  {
    exactMatchInitial = "No",
    searchTermInitial = "",
    searchSemanticInitial = "",
    sortByInitial = "_score",
    tagCounts = [],
    tagsChangedUrl,
    tagSearchUrl,
    termSearchUrl,
    semanticSearchUrl = "",
    initialTags = [],
  },
  ref
) {
  const [searchTerm, setSearchTerm] = useState(searchTermInitial);
  const [searchSemantic, setSearchSemantic] = useState(searchSemanticInitial);
  const [exactMatch, setExactMatch] = useState(exactMatchInitial);
  const [sortBy, setSortBy] = useState(sortByInitial);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const tagsInputRef = useRef<TagsInputHandle>(null);

  const focusTagSearch = useCallback(() => {
    tagsInputRef.current?.focus();
  }, []);

  const focusTermSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focusTagSearch,
      focusTermSearch,
    }),
    [focusTagSearch, focusTermSearch]
  );

  const handleTagSearch = useCallback(
    (tagList: string[]) => {
      // Navigate to tag detail page with the selected tags
      window.location.href = tagsChangedUrl.replace("666", tagList.join(",")).replace("//", "/");
    },
    [tagsChangedUrl]
  );

  const handleRelatedTagsChange = useCallback(
    (evt: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedTag = evt.target.value;
      if (selectedTag === "-1") return;

      // Get current tags and add the new one
      const currentTags = tagsInputRef.current?.getTags() || initialTags;
      const newTagList = [...currentTags, selectedTag];
      handleTagSearch(newTagList);
    },
    [handleTagSearch, initialTags]
  );

  const termSearchDisabled = searchTerm === "";
  const semanticSearchDisabled = searchSemantic === "";

  return (
    <div className="card-body mb-3 pb-4">
      {/* Term Search Form */}
      <form action={termSearchUrl} method="get" autoComplete="off">
        <div className="d-flex">
          <div className="d-flex flex-column">
            <div className="mb-1 text-nowrap">Term Search</div>
            <div className="col-auto has-search position-relative px-0">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
              <input
                id="search-bar"
                ref={searchInputRef}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                name="term_search"
                placeholder="Search"
                className="default-input form-control"
              />
            </div>
          </div>
          <div className="d-flex w-100">
            <div className="d-flex flex-column w-20 ms-3 me-3">
              <div className="mb-1">Type</div>
              <select name="boolean_search_type" className="form-control" defaultValue="AND">
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            </div>
            <div className="d-flex flex-column w-20 me-3">
              <div className="mb-1">Exact Match</div>
              <select
                value={exactMatch}
                onChange={e => setExactMatch(e.target.value)}
                name="exact_match"
                className="form-control"
              >
                <option>No</option>
                <option>Yes</option>
              </select>
            </div>
            <div className="d-flex flex-column w-20 me-3">
              <div className="mb-1">Sort By</div>
              <select
                id="search-sort-by"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                name="sort"
                className="form-control"
              >
                <option value="_score">Rank</option>
                <option value="date_unixtime">Date</option>
              </select>
            </div>
            <div className="d-flex flex-column w-20 me-1">
              <div className="mb-1">&nbsp;</div>
              <input
                className="search-input btn btn-primary"
                type="submit"
                value="Search"
                disabled={termSearchDisabled}
              />
            </div>
          </div>
        </div>
      </form>

      <hr />

      {/* Tag Search Form */}
      <form>
        <div className="d-flex">
          <div className="tag-search me-3">
            <div className="mb-1">Tag Search</div>
            <TagsInput
              ref={tagsInputRef}
              name="tag-search"
              searchUrl={tagSearchUrl}
              placeholder="Tag"
              initialTags={initialTags}
              onTagsChanged={handleTagSearch}
            />
          </div>
          {tagCounts.length > 0 && (
            <div className="me-3">
              <div className="mb-1">Related Tags</div>
              <select className="form-control form-select" onChange={handleRelatedTagsChange}>
                <option value="-1">Choose</option>
                {tagCounts.map(tag => (
                  <option key={tag[0]} value={tag[0]}>
                    {tag[0]} ({tag[1]})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="d-flex flex-column w-20 me-1">
            <div className="mb-1">&nbsp;</div>
            <input
              className="search-input btn btn-primary"
              type="submit"
              name="Go"
              value="Search"
              disabled={
                !tagsInputRef.current ||
                (tagsInputRef.current?.getTags()?.length === 0 && initialTags.length === 0)
              }
            />
          </div>
        </div>
      </form>

      {/* Semantic Search Form - only show if URL is provided */}
      {semanticSearchUrl && (
        <>
          <hr />
          <form action={semanticSearchUrl} method="get" autoComplete="off">
            <div className="d-flex">
              <div className="tag-search me-3">
                <div className="mb-1">Semantic Search</div>
                <div className="semantic-search col-auto has-search position-relative px-0">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
                  <input
                    value={searchSemantic}
                    onChange={e => setSearchSemantic(e.target.value)}
                    name="semantic_search"
                    placeholder="Search"
                    className="default-input form-control"
                  />
                </div>
              </div>
              <div className="d-flex flex-column w-20 me-3">
                <div className="mb-1">&nbsp;</div>
                <input
                  className="search-input btn btn-primary"
                  type="submit"
                  value="Search"
                  disabled={semanticSearchDisabled}
                />
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
});

export default SearchBar;
