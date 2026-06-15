import React, { useMemo, useState } from "react";
import type { HabitSummary } from "../types";

type SortField = "name" | "start_date" | "end_date";
type SortDirection = "asc" | "desc";

interface ArchiveBarProps {
  inactiveHabits: HabitSummary[];
  detailUrlFor: (uuid: string) => string;
}

/**
 * Collapsed archive disclosure at the bottom of the landing page.  Default
 * state shows just the count and a chevron; the whole header is clickable.
 * Expanding reveals a sortable Name / Start / End / Completed table of the
 * previous habits.
 */
export function ArchiveBar({ inactiveHabits, detailUrlFor }: ArchiveBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [sortField, setSortField] = useState<SortField>("end_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sorted = useMemo(() => {
    const list = [...inactiveHabits];
    list.sort((a, b) => {
      const av = (a[sortField] ?? "").toString().toLowerCase();
      const bv = (b[sortField] ?? "").toString().toLowerCase();
      if (av < bv) return sortDirection === "asc" ? -1 : 1;
      if (av > bv) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [inactiveHabits, sortField, sortDirection]);

  if (inactiveHabits.length === 0) return null;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function indicator(field: SortField) {
    if (field !== sortField) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  return (
    <section className="hb-archive">
      <button
        type="button"
        className="hb-archive-summary"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="hb-archive-title">
          Archive · {inactiveHabits.length} {inactiveHabits.length === 1 ? "habit" : "habits"}
        </span>
        <span className="hb-archive-chevron" aria-hidden="true">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <table className="hb-archive-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("name")}>Name{indicator("name")}</th>
              <th onClick={() => toggleSort("start_date")}>Start{indicator("start_date")}</th>
              <th onClick={() => toggleSort("end_date")}>End{indicator("end_date")}</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(h => (
              <tr key={h.uuid}>
                <td>
                  <a href={detailUrlFor(h.uuid)}>{h.name}</a>
                </td>
                <td>{h.start_date}</td>
                <td>{h.end_date}</td>
                <td>
                  {h.completed_logs} / {h.total_logs}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
