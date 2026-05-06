/**
 * Heatmap and streak helpers for the detail page.
 *
 * Pure functions; given a list of HabitLog entries they bin by date, compute
 * level for the heatmap, and return per-window aggregates for the dose chart.
 */

import type { HabitLogEntry } from "../types";
import { addDays, parseIsoDate, toIsoDate } from "./format";

export type HeatLevel = "untracked" | "missed" | "l1" | "l2" | "l3" | "l4";

/** Index logs by ISO date for O(1) lookup. */
export function indexLogsByDate(logs: HabitLogEntry[]): Map<string, HabitLogEntry> {
  const m = new Map<string, HabitLogEntry>();
  for (const log of logs) m.set(log.date, log);
  return m;
}

/**
 * Resolve the heatmap level for a single day.
 *
 * - `untracked` if no log exists for that day.
 * - `missed` if a log exists but `completed=false`.
 * - `l1`–`l4` for completed days.  When the habit has any numeric values in
 *   the window the level ramps with `value / max`.  When no values are
 *   present anywhere we treat every completed day as `l4`, which is what
 *   we want for habits without a unit (yes-or-no completion).
 */
export function cellLevel(log: HabitLogEntry | undefined, maxValueInWindow: number): HeatLevel {
  if (!log) return "untracked";
  if (!log.completed) return "missed";

  const v = log.value !== null ? Number(log.value) : NaN;
  if (!Number.isFinite(v) || v <= 0 || maxValueInWindow <= 0) return "l4";

  const ratio = v / maxValueInWindow;
  if (ratio >= 0.85) return "l4";
  if (ratio >= 0.6) return "l3";
  if (ratio >= 0.35) return "l2";
  return "l1";
}

/** Largest numeric value among the supplied logs (0 if none). */
export function maxValue(logs: HabitLogEntry[]): number {
  let max = 0;
  for (const log of logs) {
    if (!log.completed || log.value === null) continue;
    const v = Number(log.value);
    if (Number.isFinite(v) && v > max) max = v;
  }
  return max;
}

/**
 * Build the column-major grid the heatmap renders.
 *
 * The right-most column always represents the week containing `endDateIso`;
 * within each column row 0 is Sunday and row 6 is Saturday.  Cells before
 * the window's first day or after `endDateIso` are returned as `null` so
 * the consumer can render them as blank padding.
 */
export function buildHeatmapGrid(endDateIso: string, totalDays: number): (string | null)[][] {
  const end = parseIsoDate(endDateIso);
  const endDow = end.getDay();

  // Window start = endDate - (totalDays-1). Pad backward to the nearest
  // Sunday so column 0 row 0 is a Sunday.
  const windowStart = parseIsoDate(addDays(endDateIso, -(totalDays - 1)));
  const startDow = windowStart.getDay();
  const leadingPad = startDow; // blank cells before windowStart
  const trailingPad = 6 - endDow; // blank cells after endDate
  const totalCells = leadingPad + totalDays + trailingPad;
  const totalColumns = totalCells / 7; // always integer (verified below)

  const grid: (string | null)[][] = [];
  for (let col = 0; col < totalColumns; col += 1) {
    const column: (string | null)[] = [];
    for (let row = 0; row < 7; row += 1) {
      const cellIndex = col * 7 + row;
      const dayOffset = cellIndex - leadingPad - (totalDays - 1);
      // dayOffset is relative to endDate; visible window is [-(totalDays-1), 0].
      if (dayOffset < -(totalDays - 1) || dayOffset > 0) {
        column.push(null);
      } else {
        column.push(addDays(endDateIso, dayOffset));
      }
    }
    grid.push(column);
  }
  return grid;
}

/**
 * Compute the column index where each calendar month first appears, for the
 * "JAN FEB MAR…" labels above the heatmap.
 */
export function monthLabelPositions(grid: (string | null)[][]): { col: number; label: string }[] {
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const positions: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < grid.length; col += 1) {
    const firstCell = grid[col].find(d => d !== null);
    if (!firstCell) continue;
    const month = parseIsoDate(firstCell).getMonth();
    if (month !== lastMonth) {
      positions.push({ col, label: months[month] });
      lastMonth = month;
    }
  }
  return positions;
}

/** Build a single ISO list (oldest → newest) covering the chart window. */
export function chartWindow(endDateIso: string, windowDays: number): string[] {
  return Array.from({ length: windowDays }, (_, i) => addDays(endDateIso, -(windowDays - 1 - i)));
}

/** Daily values for the dose chart: undefined = no log, null = missed. */
export interface DosePoint {
  date: string;
  value: number | null | undefined;
}

export function doseSeries(
  logs: HabitLogEntry[],
  endDateIso: string,
  windowDays: number
): DosePoint[] {
  const idx = indexLogsByDate(logs);
  return chartWindow(endDateIso, windowDays).map(date => {
    const log = idx.get(date);
    if (!log) return { date, value: undefined };
    if (!log.completed) return { date, value: null };
    if (log.value === null) return { date, value: undefined };
    const v = Number(log.value);
    return { date, value: Number.isFinite(v) ? v : undefined };
  });
}

/** Average value across the supplied DosePoints, ignoring missed/undefined. */
export function averageDose(points: DosePoint[]): number {
  let sum = 0;
  let n = 0;
  for (const p of points) {
    if (typeof p.value === "number") {
      sum += p.value;
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}

/** today ISO from a Date arg (test seam) — re-exported for convenience. */
export { toIsoDate };
