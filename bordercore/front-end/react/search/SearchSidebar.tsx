import React, { useCallback } from "react";
import ToggleSwitch from "../common/ToggleSwitch";
import SearchModeNav from "./SearchModeNav";
import type { SearchMode } from "./SearchModeNav";
import type { Aggregation } from "./types";

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
  onSortChange: (sort: string) => void;
  onExactMatchChange: (enabled: boolean) => void;
  onTagToggle: (tag: string, checked: boolean) => void;
  onReset: () => void;
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
  onSortChange,
  onExactMatchChange,
  onTagToggle,
  onReset,
}: SearchSidebarProps) {
  const aggList = Array.isArray(aggregations) ? aggregations : [];

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onSortChange(e.target.value);
    },
    [onSortChange]
  );

  const handleDoctypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onDoctypeSelect(e.target.value);
    },
    [onDoctypeSelect]
  );

  return (
    <aside className="search-sidebar">
      <SearchModeNav activeMode={searchMode} onModeChange={onSearchModeChange} />

      <hr className="search-sidebar-divider" />

      <div className={`search-sidebar-section ${filtersDisabled ? "search-filters-disabled" : ""}`}>
        <div className="search-sidebar-filter-header">
          <h6 className="search-sidebar-label">FILTERS</h6>
          <button className="search-sidebar-reset" onClick={onReset} disabled={filtersDisabled}>
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
              onExactMatchChange(checked);
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
                      onTagToggle(tag, checked);
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
