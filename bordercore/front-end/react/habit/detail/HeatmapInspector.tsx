import React from "react";
import type { HabitLogEntry } from "../types";
import { eyebrowDate } from "../utils/format";

interface HeatmapInspectorProps {
  date: string | null;
  log: HabitLogEntry | null;
  unit: string;
  onEdit: (date: string) => void;
}

/**
 * Inspector strip that appears below the heatmap and reflects the current
 * selection: shows the date, status (logged / missed / untracked), the note
 * if one exists, and an "Edit this day" button that retargets the sticky
 * log panel to that date.
 */
export function HeatmapInspector({ date, log, unit, onEdit }: HeatmapInspectorProps) {
  if (date === null) return null;

  let statusClass: string;
  let statusText: string;
  if (!log) {
    statusClass = "is-untracked";
    statusText = "○ Untracked";
  } else if (log.completed) {
    statusClass = "is-done";
    statusText = "● Logged";
  } else {
    statusClass = "is-missed";
    statusText = "○ Missed";
  }

  const dose =
    log && log.completed && log.value !== null && unit !== "" ? ` · ${log.value} ${unit}` : "";

  return (
    <div className="hb-inspector">
      <div className="hb-inspector-date">{eyebrowDate(date)}</div>
      <div className={`hb-inspector-status ${statusClass}`}>
        {statusText}
        {dose}
      </div>
      {log?.note && <div className="hb-inspector-note">“{log.note}”</div>}
      <button type="button" className="hb-inspector-edit" onClick={() => onEdit(date)}>
        Edit this day →
      </button>
    </div>
  );
}
