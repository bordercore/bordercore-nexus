import React, { useMemo } from "react";
import type { HabitLogEntry } from "../types";
import { daysBetween, todayIso } from "../utils/format";

interface KpiStripProps {
  startDate: string;
  currentStreak: number;
  longestStreak: number;
  logs: HabitLogEntry[];
}

/**
 * Five KPI cards: Tracking for / Current streak / Longest streak /
 * 30-day rate / All-time.  Pure presentational; everything is derived from
 * `logs` plus the two server-computed streak values.
 */
export function KpiStrip({ startDate, currentStreak, longestStreak, logs }: KpiStripProps) {
  const today = todayIso();
  const trackingFor = Math.max(0, daysBetween(startDate, today));

  const { rate30, rateRatio, allTimeCompleted, allTimeTotal } = useMemo(() => {
    const cutoff = new Date(today + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - 29); // last 30 days inclusive of today
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    let last30Total = 0;
    let last30Completed = 0;
    let total = 0;
    let completed = 0;
    for (const log of logs) {
      total += 1;
      if (log.completed) completed += 1;
      if (log.date >= cutoffIso) {
        last30Total += 1;
        if (log.completed) last30Completed += 1;
      }
    }
    const ratio = last30Total > 0 ? last30Completed / last30Total : 0;
    return {
      rate30: Math.round(ratio * 100),
      rateRatio: { completed: last30Completed, total: last30Total },
      allTimeCompleted: completed,
      allTimeTotal: total,
    };
  }, [logs, today]);

  return (
    <section className="hb-kpis">
      <div className="hb-kpi-card">
        <div className="hb-kpi-label">Tracking for</div>
        <div className="hb-kpi-value">
          {trackingFor}
          <small>{trackingFor === 1 ? "day" : "days"}</small>
        </div>
      </div>
      <div className="hb-kpi-card">
        <div className="hb-kpi-label">Current streak</div>
        <div className="hb-kpi-value">
          {currentStreak}
          <small>{currentStreak === 1 ? "day" : "days"}</small>
        </div>
      </div>
      <div className="hb-kpi-card">
        <div className="hb-kpi-label">Longest streak</div>
        <div className="hb-kpi-value">
          {longestStreak}
          <small>{longestStreak === 1 ? "day" : "days"}</small>
        </div>
      </div>
      <div className="hb-kpi-card">
        <div className="hb-kpi-label">30-day rate</div>
        <div className="hb-kpi-value">
          {rate30}
          <small>%</small>
        </div>
        <div className="hb-kpi-sub">
          {rateRatio.completed}/{rateRatio.total} entries
        </div>
      </div>
      <div className="hb-kpi-card">
        <div className="hb-kpi-label">All-time</div>
        <div className="hb-kpi-value">{allTimeCompleted}</div>
        <div className="hb-kpi-sub">of {allTimeTotal} entries</div>
      </div>
    </section>
  );
}
