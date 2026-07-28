import React from "react";
import type { HabitLogEntry, HabitNoteEntry } from "../types";
import { eyebrowDate } from "../utils/format";

interface HeatmapInspectorProps {
  date: string | null;
  log: HabitLogEntry | null;
  /** Every note filed under `date`, in chronological order. */
  notes: HabitNoteEntry[];
  unit: string;
  onEdit: (date: string) => void;
}

/**
 * Inspector strip that appears below the heatmap and reflects the current
 * selection: shows the date, status (logged / missed / untracked), that day's
 * notes, and an "Edit this day" button that retargets the sticky log panel to
 * that date.
 */
export function HeatmapInspector({ date, log, notes, unit, onEdit }: HeatmapInspectorProps) {
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
      {notes.map(note => (
        <div key={note.uuid} className="hb-inspector-note">
          {note.time && <span className="hb-inspector-note-time">{note.time}</span>}“{note.note}”
        </div>
      ))}
      <button type="button" className="hb-inspector-edit" onClick={() => onEdit(date)}>
        Edit this day →
      </button>
    </div>
  );
}
