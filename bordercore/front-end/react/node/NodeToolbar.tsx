import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faTimes, faList, faBars } from "@fortawesome/free-solid-svg-icons";
import type { NodeSort } from "./types";

const SORT_OPTIONS: { k: NodeSort; l: string }[] = [
  { k: "modified", l: "modified" },
  { k: "name", l: "name" },
  { k: "coll", l: "collections" },
  { k: "todos", l: "todos" },
];

interface NodeToolbarProps {
  q: string;
  setQ: (q: string) => void;
  sort: NodeSort;
  setSort: (s: NodeSort) => void;
  dense: boolean;
  setDense: (d: boolean) => void;
  total: number;
  showing: number;
}

export function NodeToolbar({
  q,
  setQ,
  sort,
  setSort,
  dense,
  setDense,
  total,
  showing,
}: NodeToolbarProps) {
  return (
    <div className="nl-toolbar">
      <div className="nl-search">
        <FontAwesomeIcon icon={faSearch} aria-hidden="true" />
        <input
          type="text"
          placeholder="filter nodes · fuzzy match name"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {q && (
          <button
            type="button"
            className="nl-search-clear"
            onClick={() => setQ("")}
            title="clear"
            aria-label="clear search"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
      </div>

      <div className="nl-sort" role="group" aria-label="sort">
        <span className="nl-sort-label">sort</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.k}
            type="button"
            className={`nl-sort-btn${sort === opt.k ? " active" : ""}`}
            onClick={() => setSort(opt.k)}
            aria-pressed={sort === opt.k}
          >
            {opt.l}
          </button>
        ))}
      </div>

      <div className="nl-view" role="group" aria-label="view density">
        <button
          type="button"
          className={`nl-view-btn${!dense ? " active" : ""}`}
          onClick={() => setDense(false)}
          title="grid view"
          aria-pressed={!dense}
        >
          <FontAwesomeIcon icon={faList} /> grid
        </button>
        <button
          type="button"
          className={`nl-view-btn${dense ? " active" : ""}`}
          onClick={() => setDense(true)}
          title="compact view"
          aria-pressed={dense}
        >
          <FontAwesomeIcon icon={faBars} /> compact
        </button>
      </div>

      <div className="nl-count">
        <span className="mono">{showing}</span>
        <span className="dim">/ {total}</span>
      </div>
    </div>
  );
}

export default NodeToolbar;
