import React, { useState, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faImage } from "@fortawesome/free-solid-svg-icons";
import TagsInput, { TagsInputHandle } from "../common/TagsInput";
import { useFocusOnCtrlK } from "../common/hooks/useFocusOnCtrlK";
import type { SearchMode } from "./SearchModeNav";
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
  searchMode?: SearchMode;
  onSearch?: (term: string) => void;
  onSemanticSearch?: (term: string) => void;
  onImageSearch?: (payload: { text?: string; file?: File }) => void;
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
    onSearch,
    onSemanticSearch,
    onImageSearch,
  },
  ref
) {
  const [searchTerm, setSearchTerm] = useState(searchTermInitial);
  const [searchSemantic, setSearchSemantic] = useState(searchSemanticInitial);
  const [searchImageText, setSearchImageText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagsInputRef = useRef<TagsInputHandle>(null);
  const semanticInputRef = useRef<HTMLInputElement>(null);

  // Each mode renders at most one input, so only one of these refs is
  // non-null at a time — the hook's null-guard ensures only the mounted
  // input is focused on Ctrl-K.
  useFocusOnCtrlK(searchInputRef);
  useFocusOnCtrlK(tagsInputRef);
  useFocusOnCtrlK(semanticInputRef);

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

  const handleTermSubmit = useCallback(
    (e: React.FormEvent) => {
      if (onSearch) {
        e.preventDefault();
        onSearch(searchTerm);
      }
      // If no onSearch callback, let the form submit normally (progressive enhancement)
    },
    [onSearch, searchTerm]
  );

  const handleSemanticSubmit = useCallback(
    (e: React.FormEvent) => {
      if (onSemanticSearch) {
        e.preventDefault();
        onSemanticSearch(searchSemantic);
      }
    },
    [onSemanticSearch, searchSemantic]
  );

  const handleImageDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleImageDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleImageDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  }, []);

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!onImageSearch) return;
      if (imageFile) {
        onImageSearch({ file: imageFile });
      } else if (searchImageText.trim()) {
        onImageSearch({ text: searchImageText.trim() });
      }
    },
    [onImageSearch, imageFile, searchImageText]
  );

  const termSearchDisabled = searchTerm === "";
  const semanticSearchDisabled = searchSemantic === "";
  const imageSearchDisabled = !imageFile && searchImageText.trim() === "";

  return (
    <div className="search-bar-container">
      {/* Term Search Form */}
      {searchMode === "term" && (
        <form
          action={termSearchUrl}
          method="get"
          autoComplete="off"
          className="search-bar-form"
          onSubmit={handleTermSubmit}
        >
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
            <div className="search-bar-tag-input-wrap has-search">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
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
          onSubmit={handleSemanticSubmit}
        >
          <div className="search-bar-input-group">
            <div className="search-bar-input-wrap has-search">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
              <input
                ref={semanticInputRef}
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

      {/* Image Search Form */}
      {searchMode === "image" && (
        <form
          className="search-bar-form image-search-form"
          onSubmit={handleImageSubmit}
          autoComplete="off"
        >
          <div className="search-bar-input-group">
            <div className="search-bar-input-wrap has-search">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
              <input
                type="text"
                value={searchImageText}
                onChange={e => setSearchImageText(e.target.value)}
                placeholder="Describe what you're looking for..."
                className="search-bar-input form-control"
                disabled={!!imageFile}
              />
            </div>
            <button className="search-bar-submit" type="submit" disabled={imageSearchDisabled}>
              Search
            </button>
          </div>
          <div
            className={`image-search-form__drop-zone${dragging ? " dragging" : ""}`}
            onDragOver={handleImageDragOver}
            onDragLeave={handleImageDragLeave}
            onDrop={handleImageDrop}
            onClick={handleDropZoneClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") handleDropZoneClick();
            }}
            aria-label="Upload image"
          >
            <FontAwesomeIcon icon={faImage} className="image-search-form__drop-icon" />
            <span className="image-search-form__drop-hint">
              Drag image here, or click to browse
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="image-search-form__file-input"
            tabIndex={-1}
          />
          {imageFile && (
            <div className="image-search-form__preview">
              <span className="image-search-form__preview-name">{imageFile.name}</span>
              <button
                type="button"
                className="image-search-form__preview-clear"
                onClick={() => setImageFile(null)}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
});

export default SearchBar;
