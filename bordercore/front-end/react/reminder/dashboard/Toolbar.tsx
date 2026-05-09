import React from "react";
import type { FilterKey } from "../types";

interface ToolbarProps {
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  counts: Record<FilterKey, number>;
}

const PILLS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "all" },
  { key: "active", label: "active" },
  { key: "today", label: "firing today" },
];

export function Toolbar({ filter, onFilterChange, counts }: ToolbarProps) {
  return (
    <div className="rm-toolbar">
      <div className="rm-filter-pills" role="group" aria-label="filter">
        {PILLS.map(pill => (
          <button
            key={pill.key}
            type="button"
            className={`rm-pill${filter === pill.key ? " is-active" : ""}`}
            onClick={() => onFilterChange(pill.key)}
            aria-pressed={filter === pill.key}
          >
            <span>{pill.label}</span>
            <span className="rm-pill-count">{counts[pill.key]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Toolbar;
