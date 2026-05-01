import React from "react";

interface ImportanceFiltersProps {
  starredCount: number;
  pinnedCount: number;
  starredOnly: boolean;
  pinnedOnly: boolean;
  onToggleStarred: () => void;
  onTogglePinned: () => void;
}

export function ImportanceFilters({
  starredCount,
  pinnedCount,
  starredOnly,
  pinnedOnly,
  onToggleStarred,
  onTogglePinned,
}: ImportanceFiltersProps) {
  return (
    <section className="rb-rail-section">
      <h3 className="rb-rail-heading">importance</h3>
      <ul className="rb-rail-list">
        <li>
          <button
            type="button"
            className={`rb-rail-row${starredOnly ? " is-active" : ""}`}
            aria-pressed={starredOnly}
            onClick={onToggleStarred}
          >
            <span className="rb-imp-star" aria-hidden="true">
              ★
            </span>
            <span className="rb-rail-row-label">Starred only</span>
            <span className="rb-rail-row-count">{starredCount}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={`rb-rail-row${pinnedOnly ? " is-active" : ""}`}
            aria-pressed={pinnedOnly}
            onClick={onTogglePinned}
          >
            <span className="rb-dt-dot rb-dt-image" aria-hidden="true" />
            <span className="rb-rail-row-label">Pinned notes</span>
            <span className="rb-rail-row-count">{pinnedCount}</span>
          </button>
        </li>
      </ul>
    </section>
  );
}

export default ImportanceFilters;
