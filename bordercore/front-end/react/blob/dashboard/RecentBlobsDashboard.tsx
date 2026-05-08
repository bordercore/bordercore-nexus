import React, { useCallback, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import type { DashboardData, DashboardUrls, DateBucket, DoctypeFilter, FilterState } from "./types";
import { EMPTY_FILTERS } from "./types";
import FilterRail from "./FilterRail";
import ActiveFiltersStrip from "./ActiveFiltersStrip";
import BlobCardGrid from "./BlobCardGrid";
import { isFilterActive, useFilteredBlobs } from "./hooks/useFilteredBlobs";

interface RecentBlobsDashboardProps {
  data: DashboardData;
  urls: DashboardUrls;
}

export function RecentBlobsDashboard({ data, urls }: RecentBlobsDashboardProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const filteredBlobs = useFilteredBlobs(data.blobs, filters);
  const filtersActive = isFilterActive(filters);

  const handleDoctype = useCallback((value: DoctypeFilter) => {
    setFilters(f => ({ ...f, doctype: value }));
  }, []);

  const handleTag = useCallback((tag: string) => {
    setFilters(f => {
      const next = new Set(f.tags);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return { ...f, tags: next };
    });
  }, []);

  const handleDateBucket = useCallback((bucket: DateBucket | null) => {
    setFilters(f => ({ ...f, dateBucket: bucket }));
  }, []);

  const handleToggleStarred = useCallback(() => {
    setFilters(f => ({ ...f, starredOnly: !f.starredOnly }));
  }, []);

  const handleTogglePinned = useCallback(() => {
    setFilters(f => ({ ...f, pinnedOnly: !f.pinnedOnly }));
  }, []);

  const handleClearDoctype = useCallback(() => {
    setFilters(f => ({ ...f, doctype: "all" }));
  }, []);

  const handleRemoveTag = useCallback((tag: string) => {
    setFilters(f => {
      const next = new Set(f.tags);
      next.delete(tag);
      return { ...f, tags: next };
    });
  }, []);

  const handleClearDateBucket = useCallback(() => {
    setFilters(f => ({ ...f, dateBucket: null }));
  }, []);

  const handleClearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const subCopy = filtersActive
    ? `filtered · ${filteredBlobs.length} of ${data.total_count}`
    : "filter by doctype, tag, or date in the rail";

  return (
    <div className="rb-app">
      <div className="rb-shell">
        <FilterRail
          data={data}
          filters={filters}
          onDoctype={handleDoctype}
          onTag={handleTag}
          onDateBucket={handleDateBucket}
          onToggleStarred={handleToggleStarred}
          onTogglePinned={handleTogglePinned}
        />

        <main className="rb-main">
          <header className="rb-page-head">
            <div className="rb-page-head-text">
              <h1 className="rb-page-title">Recent Blobs</h1>
              <p className="rb-page-sub">{subCopy}</p>
            </div>
            <div className="rb-page-actions">
              <a href={urls.createBlob} className="refined-btn primary">
                <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
                new
              </a>
              <a href={urls.importBlob} className="refined-btn">
                import
              </a>
              <a href={urls.bookshelf} className="refined-btn">
                bookshelf
              </a>
            </div>
          </header>

          {filtersActive && (
            <ActiveFiltersStrip
              filters={filters}
              onClearDoctype={handleClearDoctype}
              onRemoveTag={handleRemoveTag}
              onClearDateBucket={handleClearDateBucket}
              onClearStarred={handleToggleStarred}
              onClearPinned={handleTogglePinned}
              onClearAll={handleClearAll}
            />
          )}

          {filteredBlobs.length === 0 ? (
            <div className="rb-empty">
              <p>// no blobs match this filter</p>
              {filtersActive && (
                <button type="button" className="rb-clear-all" onClick={handleClearAll}>
                  clear all
                </button>
              )}
            </div>
          ) : (
            <BlobCardGrid blobs={filteredBlobs} onTagClick={handleTag} />
          )}
        </main>
      </div>
    </div>
  );
}

export default RecentBlobsDashboard;
