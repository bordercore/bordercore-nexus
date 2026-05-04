import React from "react";
import DensitySlider from "./DensitySlider";
import type { Density } from "./density";

interface ActionClusterProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  density: Density;
  filteredCount: number;
  onDensityChange: (d: Density) => void;
  onCreateClick: () => void;
}

export function ActionCluster({
  searchQuery,
  onSearchChange,
  density,
  filteredCount,
  onDensityChange,
  onCreateClick,
}: ActionClusterProps) {
  return (
    <div className="cl-actions">
      <div className="cl-search">
        <span className="cl-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="text"
          placeholder="search collections"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          aria-label="Search collections"
        />
        {searchQuery && (
          <button
            type="button"
            className="cl-search-clear"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <DensitySlider density={density} count={filteredCount} onChange={onDensityChange} />

      <button type="button" className="cl-iconbtn is-primary" onClick={onCreateClick}>
        + new
      </button>
    </div>
  );
}

export default ActionCluster;
