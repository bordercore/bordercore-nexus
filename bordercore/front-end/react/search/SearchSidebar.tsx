import React, { useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faTag, faBrain } from "@fortawesome/free-solid-svg-icons";
import ToggleSwitch from "../common/ToggleSwitch";
import type { Aggregation } from "./types";

type SearchMode = "term" | "tag" | "semantic";

interface SearchSidebarProps {
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
  aggregations: Aggregation[];
  currentDoctype: string;
  onDoctypeSelect: (doctype: string) => void;
  exactMatchInitial: string;
  sortByInitial: string;
  allTags: string[];
  activeTags: string[];
  hasResults: boolean;
  filtersDisabled?: boolean;
}

export function SearchSidebar({
  searchMode,
  onSearchModeChange,
  aggregations,
  currentDoctype,
  onDoctypeSelect,
  exactMatchInitial,
  sortByInitial,
  allTags,
  activeTags,
  hasResults,
  filtersDisabled = false,
}: SearchSidebarProps) {
  const aggList = Array.isArray(aggregations) ? aggregations : [];

  const handleReset = useCallback(() => {
    // Reset all filters by navigating to the base search URL
    const baseUrl = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    // Keep only the search term
    const term = params.get("term_search") || params.get("search") || "";
    const semantic = params.get("semantic_search") || "";
    if (term) {
      window.location.href = `${baseUrl}?term_search=${encodeURIComponent(term)}`;
    } else if (semantic) {
      window.location.href = `${baseUrl}?semantic_search=${encodeURIComponent(semantic)}`;
    } else {
      window.location.href = baseUrl;
    }
  }, []);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(window.location.search);
    params.set("sort", e.target.value);
    window.location.search = params.toString();
  }, []);

  const handleDoctypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onDoctypeSelect(e.target.value);
    },
    [onDoctypeSelect]
  );

  const handleTagToggle = useCallback(
    (tag: string, checked: boolean) => {
      const params = new URLSearchParams(window.location.search);
      // Remove all existing tags params
      params.delete("tags");
      // Build new tag list
      let newTags = [...activeTags];
      if (checked) {
        if (!newTags.includes(tag)) newTags.push(tag);
      } else {
        newTags = newTags.filter(t => t !== tag);
      }
      // Re-add each tag as a separate param
      newTags.forEach(t => params.append("tags", t));
      params.delete("page");
      window.location.search = params.toString();
    },
    [activeTags]
  );

  const searchModes = [
    { key: "term" as SearchMode, label: "Term Search", icon: faMagnifyingGlass },
    { key: "tag" as SearchMode, label: "Tag Search", icon: faTag },
    { key: "semantic" as SearchMode, label: "Semantic", icon: faBrain },
  ];

  return (
    <aside className="search-sidebar">
      <div className="search-sidebar-section">
        <h6 className="search-sidebar-label">SEARCH MODE</h6>
        <div className="search-mode-list">
          {searchModes.map(mode => (
            <button
              key={mode.key}
              className={`search-mode-btn ${searchMode === mode.key ? "active" : ""}`}
              onClick={() => onSearchModeChange(mode.key)}
            >
              <FontAwesomeIcon icon={mode.icon} className="search-mode-icon" />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      <hr className="search-sidebar-divider" />

      <div className={`search-sidebar-section ${filtersDisabled ? "search-filters-disabled" : ""}`}>
        <div className="search-sidebar-filter-header">
          <h6 className="search-sidebar-label">FILTERS</h6>
          <button className="search-sidebar-reset" onClick={handleReset} disabled={filtersDisabled}>
            RESET
          </button>
        </div>

        <div className="search-filter-group">
          <label className="search-filter-label">Content Type</label>
          <select
            className="search-filter-select"
            value={currentDoctype || ""}
            onChange={handleDoctypeChange}
            disabled={filtersDisabled}
          >
            <option value="">All Types</option>
            {aggList.map(agg => (
              <option key={agg.doctype} value={agg.doctype}>
                {agg.doctype.charAt(0).toUpperCase() + agg.doctype.slice(1)} ({agg.count})
              </option>
            ))}
          </select>
        </div>

        <div className="search-filter-group search-filter-inline">
          <label className="search-filter-label">Exact Match</label>
          <ToggleSwitch
            name="exact_match"
            checked={exactMatchInitial === "Yes"}
            onChange={checked => {
              if (filtersDisabled) return;
              const params = new URLSearchParams(window.location.search);
              if (checked) {
                params.set("exact_match", "Yes");
              } else {
                params.delete("exact_match");
              }
              window.location.search = params.toString();
            }}
            disabled={filtersDisabled}
            className="search-tag-toggle"
          />
        </div>

        <div className="search-filter-group">
          <label className="search-filter-label">Sort By</label>
          <select
            className="search-filter-select"
            value={sortByInitial}
            onChange={handleSortChange}
            disabled={filtersDisabled}
          >
            <option value="_score">Relevance</option>
            <option value="date_unixtime">Date</option>
          </select>
        </div>

        <div className="search-filter-group">
          <label className="search-filter-label">Date Range</label>
          <div className="search-date-range-list">
            <button className="search-date-range-btn" disabled={filtersDisabled}>
              Last 24 Hours
            </button>
            <button className="search-date-range-btn" disabled={filtersDisabled}>
              Last 7 Days
            </button>
            <button className="search-date-range-btn" disabled={filtersDisabled}>
              Last 30 Days
            </button>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="search-filter-group">
            <label className="search-filter-label">Tags</label>
            <div className="search-tag-filter-list">
              {allTags.slice(0, 8).map(tag => (
                <div key={tag} className="search-tag-filter-item">
                  <ToggleSwitch
                    name={`tag-filter-${tag}`}
                    checked={activeTags.includes(tag)}
                    onChange={checked => {
                      if (filtersDisabled) return;
                      handleTagToggle(tag, checked);
                    }}
                    disabled={filtersDisabled}
                    className="search-tag-toggle"
                  />
                  <span>#{tag}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default SearchSidebar;
