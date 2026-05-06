import React, { useMemo } from "react";
import type { HabitLogEntry } from "../types";
import { averageDose, doseSeries } from "../utils/streaks";

export type ChartRange = "30d" | "90d" | "1y";

interface DoseChartProps {
  logs: HabitLogEntry[];
  endDateIso: string;
  unit: string;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
}

const RANGE_DAYS: Record<ChartRange, number> = {
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

const VIEWBOX_W = 800;
const VIEWBOX_H = 180;
const BAR_TOP_PCT = 0.92; // tallest bar reaches 92% of viewbox height

/**
 * Bar chart of dose values across the selected window.  When the habit has
 * no `unit` set this card renders an empty-state instead, since dose tracking
 * is meaningless without a unit.
 */
export function DoseChart({ logs, endDateIso, unit, range, onRangeChange }: DoseChartProps) {
  const days = RANGE_DAYS[range];

  const series = useMemo(() => doseSeries(logs, endDateIso, days), [logs, endDateIso, days]);
  const max = useMemo(() => {
    let m = 0;
    for (const p of series) {
      if (typeof p.value === "number" && p.value > m) m = p.value;
    }
    return m;
  }, [series]);
  const avg = useMemo(() => averageDose(series), [series]);

  if (unit === "") {
    return (
      <article className="hb-dose-card">
        <div className="hb-dose-head">
          <div>
            <div className="hb-dose-title">Dose over time</div>
          </div>
        </div>
        <div className="hb-dose-empty">
          Set a unit on this habit (in admin) to track dose values.
        </div>
      </article>
    );
  }

  const barWidth = VIEWBOX_W / days;

  return (
    <article className="hb-dose-card">
      <div className="hb-dose-head">
        <div>
          <div className="hb-dose-title">Dose over time · {range.toUpperCase()}</div>
          <div className="hb-dose-avg">
            Avg {avg > 0 ? avg.toFixed(1) : "—"} {unit}/day
          </div>
        </div>
        <div className="hb-dose-tabs" role="tablist">
          {(Object.keys(RANGE_DAYS) as ChartRange[]).map(r => (
            <button
              key={r}
              type="button"
              className={`hb-dose-tab${r === range ? " is-active" : ""}`}
              role="tab"
              aria-selected={r === range}
              onClick={() => onRangeChange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <svg
        className="hb-dose-svg"
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="none"
        aria-label="Dose over time"
      >
        {series.map((point, i) => {
          const x = i * barWidth;
          if (point.value === null) {
            // missed: 4px stub at bottom
            return (
              <rect
                key={point.date}
                className="hb-dose-bar is-missed"
                x={x}
                y={VIEWBOX_H - 4}
                width={Math.max(0, barWidth - 0.5)}
                height={4}
              />
            );
          }
          if (typeof point.value !== "number" || max <= 0) return null;
          const h = (point.value / max) * VIEWBOX_H * BAR_TOP_PCT;
          return (
            <rect
              key={point.date}
              className="hb-dose-bar"
              x={x}
              y={VIEWBOX_H - h}
              width={Math.max(0, barWidth - 0.5)}
              height={h}
            />
          );
        })}
      </svg>
    </article>
  );
}
