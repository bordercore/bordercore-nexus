import React, { useMemo } from "react";
import type { HabitLogEntry } from "../types";
import { eyebrowDate } from "../utils/format";

interface NotebookProps {
  logs: HabitLogEntry[];
  /** Maximum entries to display.  Defaults to 5 (per design). */
  limit?: number;
}

/**
 * Filters `logs` to those with a non-empty note and shows the most-recent
 * `limit` entries.  Each entry: cyan uppercase date + plain-text note.
 */
export function Notebook({ logs, limit = 5 }: NotebookProps) {
  const entries = useMemo(
    () => logs.filter(l => l.note && l.note.trim() !== "").slice(0, limit),
    [logs, limit]
  );

  return (
    <article className="hb-notebook-card">
      <div className="hb-notebook-title">Notebook</div>
      {entries.length === 0 ? (
        <div className="hb-notebook-empty">No notes yet.</div>
      ) : (
        entries.map(entry => (
          <div key={entry.uuid} className="hb-notebook-entry">
            <div className="hb-notebook-date">{eyebrowDate(entry.date)}</div>
            <div className="hb-notebook-note">{entry.note}</div>
          </div>
        ))
      )}
    </article>
  );
}
