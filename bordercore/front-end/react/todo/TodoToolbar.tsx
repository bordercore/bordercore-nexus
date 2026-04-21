import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faTimes, faList, faBars } from "@fortawesome/free-solid-svg-icons";
import type { ViewType } from "./types";

export type SortField = "sort_order" | "name" | "priority" | "created_unixtime";

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "sort_order", label: "Manual" },
  { field: "created_unixtime", label: "Date" },
  { field: "priority", label: "Priority" },
  { field: "name", label: "Title" },
];

interface TodoToolbarProps {
  search: string;
  view: ViewType;
  sortField: SortField;
  onSearch: (value: string) => void;
  onClearSearch: () => void;
  onViewChange: (view: ViewType) => void;
  onSortChange: (field: SortField) => void;
}

export function TodoToolbar({
  search,
  view,
  sortField,
  onSearch,
  onClearSearch,
  onViewChange,
  onSortChange,
}: TodoToolbarProps) {
  return (
    <div className="todo-toolbar">
      <div className="todo-search-wrap">
        <FontAwesomeIcon icon={faSearch} className="icon" />
        <input
          type="text"
          className="refined-input todo-search-input"
          placeholder="Search tasks…"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
        {search && (
          <button type="button" className="clear" onClick={onClearSearch} aria-label="Clear search">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
      </div>

      <div className="todo-seg" role="group" aria-label="View density">
        <button
          type="button"
          className={view === "normal" ? "active" : ""}
          onClick={() => onViewChange("normal")}
          aria-pressed={view === "normal"}
          title="List view"
        >
          <FontAwesomeIcon icon={faList} />
        </button>
        <button
          type="button"
          className={view === "compact" ? "active" : ""}
          onClick={() => onViewChange("compact")}
          aria-pressed={view === "compact"}
          title="Compact view"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
      </div>

      <label className="todo-sort-wrap">
        <span>Sort By</span>
        <div className="refined-select-wrap">
          <select
            className="refined-select"
            value={sortField}
            onChange={e => onSortChange(e.target.value as SortField)}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.field} value={opt.field}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </label>
    </div>
  );
}

export default TodoToolbar;
