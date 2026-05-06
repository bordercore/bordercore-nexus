import React, { useMemo } from "react";
import type { HabitLogEntry } from "../types";
import {
  buildHeatmapGrid,
  cellLevel,
  indexLogsByDate,
  maxValue,
  monthLabelPositions,
} from "../utils/streaks";

interface HeatmapProps {
  /** All logs in the window (newest-first or any order). */
  logs: HabitLogEntry[];
  /** ISO date that anchors the right-most column. */
  endDateIso: string;
  /** ISO date currently highlighted, or null. */
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

/**
 * Year-long completion heatmap.  53 columns × 7 rows of 16×16 cells, with a
 * cyan ramp keyed by the day's value relative to the per-window max.
 */
export function Heatmap({ logs, endDateIso, selectedDate, onSelect }: HeatmapProps) {
  const grid = useMemo(() => buildHeatmapGrid(endDateIso, 365), [endDateIso]);
  const logIndex = useMemo(() => indexLogsByDate(logs), [logs]);
  const max = useMemo(() => maxValue(logs), [logs]);
  const monthLabels = useMemo(() => monthLabelPositions(grid), [grid]);

  return (
    <div className="hb-heatmap-grid-wrap">
      <div className="hb-month-labels" aria-hidden="true">
        {monthLabels.map(({ col, label }) => (
          <span key={`${col}-${label}`} className="hb-month-label" data-col={col}>
            {label}
          </span>
        ))}
      </div>
      <div className="hb-heatmap-grid" role="grid" aria-label="Completion heatmap">
        {grid.map((column, ci) => (
          <div key={ci} className="hb-heatmap-col" role="row">
            {column.map((iso, ri) => {
              if (iso === null) {
                return (
                  <div key={ri} className="hb-cell is-blank" role="gridcell" aria-hidden="true" />
                );
              }
              const log = logIndex.get(iso);
              const level = cellLevel(log, max);
              const classes = ["hb-cell", `is-${level}`];
              if (iso === selectedDate) classes.push("is-selected");
              const status = log ? (log.completed ? "logged" : "missed") : "untracked";
              return (
                <button
                  key={ri}
                  type="button"
                  className={classes.join(" ")}
                  role="gridcell"
                  aria-label={`${iso}: ${status}`}
                  aria-pressed={iso === selectedDate}
                  onClick={() => onSelect(iso)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
