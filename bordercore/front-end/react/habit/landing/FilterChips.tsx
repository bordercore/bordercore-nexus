import React from "react";

interface FilterChipsProps {
  options: string[];
  active: string;
  onChange: (value: string) => void;
}

/**
 * Horizontal pill-shaped filter row.  The active chip uses the cyan accent;
 * inactive chips are slate-bordered.  Filtering is purely tag-based — the
 * parent passes the union of tags as `options` and toggles `active` back
 * to "" (no filter) when the user reclicks the live chip.
 */
export function FilterChips({ options, active, onChange }: FilterChipsProps) {
  return (
    <nav className="hb-chips" aria-label="Filter habits by tag">
      {options.map(opt => {
        const isActive = opt === active;
        return (
          <button
            key={opt}
            type="button"
            className={`hb-chip${isActive ? " is-active" : ""}`}
            aria-pressed={isActive}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        );
      })}
    </nav>
  );
}
