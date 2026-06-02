import React, { useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import DensitySlider from "./DensitySlider";
import type { Density } from "./density";
import { useFocusOnCtrlK } from "../common/hooks/useFocusOnCtrlK";

interface ActionClusterProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  density: Density;
  filteredCount: number;
  onDensityChange: (d: Density) => void;
}

/**
 * Main-column toolbar (search + density), mirroring /todo/'s TodoToolbar and
 * the bookmark toolbar. The primary "new" button lives in the page head, not
 * here, so the head holds only the title + count + create action.
 */
export function ActionCluster({
  searchQuery,
  onSearchChange,
  density,
  filteredCount,
  onDensityChange,
}: ActionClusterProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  useFocusOnCtrlK(searchRef);
  return (
    <div className="cl-toolbar">
      <div className="cl-search" role="search">
        <FontAwesomeIcon icon={faSearch} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search collections…"
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
    </div>
  );
}

export default ActionCluster;
