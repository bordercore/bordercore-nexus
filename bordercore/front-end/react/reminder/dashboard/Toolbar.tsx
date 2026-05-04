import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import type { FilterKey } from "../types";

interface ToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  counts: Record<FilterKey, number>;
}

const PILLS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "all" },
  { key: "active", label: "active" },
  { key: "today", label: "firing today" },
];

export function Toolbar({ query, onQueryChange, filter, onFilterChange, counts }: ToolbarProps) {
  return (
    <div className="rm-toolbar">
      <label className="rm-search">
        <FontAwesomeIcon icon={faSearch} className="rm-search-icon" />
        <input
          type="search"
          autoComplete="off"
          placeholder="filter reminders · fuzzy match name + note"
          aria-label="filter reminders"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
        />
      </label>
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
