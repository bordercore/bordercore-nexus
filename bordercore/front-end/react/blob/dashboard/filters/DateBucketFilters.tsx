import React from "react";
import type { DateBucket, DateBucketCounts } from "../types";
import { DATE_BUCKETS, DATE_BUCKET_LABELS } from "../types";

interface DateBucketFiltersProps {
  counts: DateBucketCounts;
  active: DateBucket | null;
  onSelect: (value: DateBucket | null) => void;
}

export function DateBucketFilters({ counts, active, onSelect }: DateBucketFiltersProps) {
  const max = Math.max(1, ...DATE_BUCKETS.map(b => counts[b]));

  return (
    <section className="rb-rail-section">
      <h3 className="rb-rail-heading">added</h3>
      <ul className="rb-rail-list rb-rail-histogram">
        {DATE_BUCKETS.map(bucket => {
          const count = counts[bucket];
          const isActive = active === bucket;
          const pct = (count / max) * 100;
          return (
            <li key={bucket}>
              <button
                type="button"
                className={`rb-histogram-row${isActive ? " is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => onSelect(isActive ? null : bucket)}
                disabled={count === 0}
              >
                <span className="rb-histogram-label">{DATE_BUCKET_LABELS[bucket]}</span>
                <span className="rb-histogram-track" aria-hidden="true">
                  <span
                    className="rb-histogram-fill"
                    ref={node => {
                      if (node) node.style.setProperty("--fill", `${pct}%`);
                    }}
                  />
                </span>
                <span className="rb-histogram-count">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default DateBucketFilters;
