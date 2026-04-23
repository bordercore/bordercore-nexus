import React from "react";
import type { PlotType } from "../types";

interface StatsStripProps {
  data: number[][];
  series: PlotType;
}

const UNIT_LABELS: Record<PlotType, { short: string; full: string }> = {
  weight: { short: "lb", full: "lb" },
  reps: { short: "reps", full: "reps" },
  duration: { short: "s", full: "sec" },
};

function workoutBest(sets: number[]): number {
  return sets.length > 0 ? Math.max(0, ...sets) : 0;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}`;
  return `${Number(n.toFixed(n % 1 ? 1 : 0))}`;
}

function formatDelta(n: number): string {
  if (n === 0) return "±0";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Number(n.toFixed(n % 1 ? 1 : 0))}`;
}

export function StatsStrip({ data, series }: StatsStripProps) {
  const unit = UNIT_LABELS[series];
  const sessionsCount = data.length;
  const lastBest = sessionsCount > 0 ? workoutBest(data[data.length - 1]) : 0;
  const firstBest = sessionsCount > 0 ? workoutBest(data[0]) : 0;
  const trend = lastBest - firstBest;
  const total = data.reduce((sum, sets) => sum + sets.reduce((a, b) => a + b, 0), 0);
  const averagePerSession = sessionsCount > 0 ? total / sessionsCount : 0;

  const totalUnit = series === "weight" && total >= 1000 ? "k lb" : unit.short;

  return (
    <div className="ex-stats">
      <div className="ex-stat">
        <div className="k">current best</div>
        <div className="v">
          {formatNumber(lastBest)}
          <span className="u">{unit.short}</span>
        </div>
        <div className={`d ${trend >= 0 ? "up" : "down"}`}>{formatDelta(trend)} vs first</div>
      </div>
      <div className="ex-stat">
        <div className="k">sessions</div>
        <div className="v">
          {sessionsCount}
          <span className="u">pts</span>
        </div>
        <div className="d up">this page</div>
      </div>
      <div className="ex-stat">
        <div className="k">total volume</div>
        <div className="v">
          {formatNumber(total)}
          <span className="u">{totalUnit}</span>
        </div>
        <div className="d up">↗ {formatNumber(averagePerSession)}/session</div>
      </div>
      <div className="ex-stat">
        <div className="k">best set</div>
        <div className="v">
          {formatNumber(lastBest)}
          <span className="u">{unit.full}</span>
        </div>
        <div className={`d ${trend >= 0 ? "up" : "down"}`}>last session</div>
      </div>
    </div>
  );
}
