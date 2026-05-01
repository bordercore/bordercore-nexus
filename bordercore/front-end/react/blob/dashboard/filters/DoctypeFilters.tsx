import React from "react";
import type { DoctypeCounts, DoctypeFilter } from "../types";
import { DOCTYPES, DOCTYPE_LABELS } from "../types";

interface DoctypeFiltersProps {
  counts: DoctypeCounts;
  active: DoctypeFilter;
  onSelect: (value: DoctypeFilter) => void;
}

export function DoctypeFilters({ counts, active, onSelect }: DoctypeFiltersProps) {
  const rows: { value: DoctypeFilter; label: string; showDot: boolean }[] = [
    { value: "all", label: "All blobs", showDot: false },
    ...DOCTYPES.map(dt => ({
      value: dt as DoctypeFilter,
      label: DOCTYPE_LABELS[dt],
      showDot: true,
    })),
  ];

  return (
    <section className="rb-rail-section">
      <h3 className="rb-rail-heading">doctype</h3>
      <ul className="rb-rail-list" role="listbox" aria-label="Filter by doctype">
        {rows.map(row => {
          const count = row.value === "all" ? counts.all : counts[row.value as keyof DoctypeCounts];
          if (row.value !== "all" && count === 0) return null;
          const isActive = active === row.value;
          return (
            <li key={row.value}>
              <button
                type="button"
                className={`rb-rail-row${isActive ? " is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => onSelect(row.value)}
              >
                {row.showDot ? (
                  <span className={`rb-dt-dot rb-dt-${row.value}`} aria-hidden="true" />
                ) : (
                  <span className="rb-dt-dot rb-dt-empty" aria-hidden="true" />
                )}
                <span className="rb-rail-row-label">{row.label}</span>
                <span className="rb-rail-row-count">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default DoctypeFilters;
