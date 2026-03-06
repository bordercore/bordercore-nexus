import React, { useState, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import TagsInput, { TagsInputHandle } from "../common/TagsInput";
import type { TagCount } from "./types";

type SearchMode = "term" | "tag" | "semantic";

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
  searchMode?: SearchMode;
}

export interface SearchBarHandle {
  focusTagSearch: () => void;
  focusTermSearch: () => void;
}

export const SearchBar = forwardRef<SearchBarHandle, SearchBarProps>(function SearchBar(
  {
    searchTermInitial = "",
    searchSemanticInitial = "",
    tagCounts = [],
    tagsChangedUrl,
    tagSearchUrl,
    termSearchUrl,
    semanticSearchUrl = "",
    initialTags = [],
    searchMode = "term",
  },
  ref
) {
  const [searchTerm, setSearchTerm] = useState(searchTermInitial);
  const [searchSemantic, setSearchSemantic] = useState(searchSemanticInitial);

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
      window.location.href = tagsChangedUrl.replace("666", tagList.join(",")).replace("//", "/");
    },
    [tagsChangedUrl]
  );

  const handleRelatedTagsChange = useCallback(
    (evt: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedTag = evt.target.value;
      if (selectedTag === "-1") return;
      const currentTags = tagsInputRef.current?.getTags() || initialTags;
      const newTagList = [...currentTags, selectedTag];
      handleTagSearch(newTagList);
    },
    [handleTagSearch, initialTags]
  );

  const termSearchDisabled = searchTerm === "";
  const semanticSearchDisabled = searchSemantic === "";

  return (
    <div className="search-bar-container">
      {/* Term Search Form */}
      {searchMode === "term" && (
        <form action={termSearchUrl} method="get" autoComplete="off" className="search-bar-form">
          <div className="search-bar-input-group">
            <div className="search-bar-input-wrap has-search">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
              <input
                id="search-bar"
                ref={searchInputRef}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                name="term_search"
                placeholder="Search by terms..."
                className="search-bar-input form-control"
              />
            </div>
            <button className="search-bar-submit" type="submit" disabled={termSearchDisabled}>
              Search
            </button>
          </div>
        </form>
      )}

      {/* Tag Search Form */}
      {searchMode === "tag" && (
        <form className="search-bar-form">
          <div className="search-bar-input-group">
            <div className="search-bar-tag-input-wrap">
              <TagsInput
                ref={tagsInputRef}
                name="tag-search"
                searchUrl={tagSearchUrl}
                placeholder="Search by tags..."
                initialTags={initialTags}
                onTagsChanged={handleTagSearch}
              />
            </div>
            {tagCounts.length > 0 && (
              <select className="search-filter-select" onChange={handleRelatedTagsChange}>
                <option value="-1">Related Tags</option>
                {tagCounts.map(tag => (
                  <option key={tag[0]} value={tag[0]}>
                    {tag[0]} ({tag[1]})
                  </option>
                ))}
              </select>
            )}
            <button
              className="search-bar-submit"
              type="submit"
              name="Go"
              disabled={
                !tagsInputRef.current ||
                (tagsInputRef.current?.getTags()?.length === 0 && initialTags.length === 0)
              }
            >
              Search
            </button>
          </div>
        </form>
      )}

      {/* Semantic Search Form */}
      {searchMode === "semantic" && semanticSearchUrl && (
        <form
          action={semanticSearchUrl}
          method="get"
          autoComplete="off"
          className="search-bar-form"
        >
          <div className="search-bar-input-group">
            <div className="search-bar-input-wrap has-search">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
              <input
                value={searchSemantic}
                onChange={e => setSearchSemantic(e.target.value)}
                name="semantic_search"
                placeholder="Search semantically..."
                className="search-bar-input form-control"
              />
            </div>
            <button className="search-bar-submit" type="submit" disabled={semanticSearchDisabled}>
              Search
            </button>
          </div>
        </form>
      )}
    </div>
  );
});

export default SearchBar;
