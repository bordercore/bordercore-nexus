import React from "react";
import type { HabitLogEntry } from "../types";
import { shortDate } from "../utils/format";

interface RecentLogTableProps {
  logs: HabitLogEntry[];
  unit: string;
  /** Total log count across all history; used in the head row. */
  totalCount: number;
  /** Limit for the table body.  Default 10. */
  limit?: number;
  onEdit: (date: string) => void;
}

/**
 * Six-column grid: Date / Status / Dose / vs target / Note / edit.
 *
 * The "vs target" column renders "—" everywhere because Phase B (the
 * scope we're shipping) does not introduce a per-habit target field.
 * The column is preserved for visual fidelity and easy upgrade later.
 */
export function RecentLogTable({
  logs,
  unit,
  totalCount,
  limit = 10,
  onEdit,
}: RecentLogTableProps) {
  const rows = logs.slice(0, limit);

  return (
    <article className="hb-recent-card">
      <div className="hb-recent-head-row">
        <div className="hb-recent-title">Recent log</div>
        <div className="hb-recent-meta">
          showing last {rows.length} · {totalCount} total
        </div>
      </div>

      <div className="hb-recent-grid">
        <div className="hb-recent-grid-head">
          <div className="hb-recent-cell is-head">Date</div>
          <div className="hb-recent-cell is-head">Status</div>
          <div className="hb-recent-cell is-head">Dose</div>
          <div className="hb-recent-cell is-head is-target">vs target</div>
          <div className="hb-recent-cell is-head">Note</div>
          <div className="hb-recent-cell is-head" aria-hidden="true" />
        </div>

        {rows.map(log => (
          <div key={log.uuid} className="hb-recent-grid-row">
            <div className="hb-recent-cell is-date">{shortDate(log.date)}</div>
            <div className="hb-recent-cell">
              <span className={`hb-status-dot ${log.completed ? "is-done" : "is-missed"}`}>
                {log.completed ? "● Done" : "○ Missed"}
              </span>
            </div>
            <div className="hb-recent-cell is-dose">
              {log.completed && log.value !== null ? `${log.value}${unit ? " " + unit : ""}` : "—"}
            </div>
            <div className="hb-recent-cell is-target">—</div>
            <div className="hb-recent-cell is-note">{log.note}</div>
            <div className="hb-recent-cell is-edit">
              <button type="button" onClick={() => onEdit(log.date)}>
                edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
