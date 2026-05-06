import React from "react";
import { CompletionRing } from "./CompletionRing";
import { greetingForHour, mastheadDate } from "../utils/format";

interface HeroProps {
  /** ISO date for "today". */
  todayIso: string;
  /** Current local hour (0–23). */
  hour: number;
  completedToday: number;
  totalActiveToday: number;
  onNewHabit: () => void;
}

/**
 * Top-of-page header: date eyebrow, large greeting + done-count masthead,
 * the completion ring, and the cyan "+ New Habit" button.
 */
export function Hero({ todayIso, hour, completedToday, totalActiveToday, onNewHabit }: HeroProps) {
  const pct = totalActiveToday > 0 ? completedToday / totalActiveToday : 0;
  const pctLabel = `${Math.round(pct * 100)}%`;

  return (
    <header className="hb-hero">
      <div>
        <div className="hb-hero-eyebrow">{mastheadDate(todayIso)}</div>
        <h1 className="hb-hero-masthead">
          {greetingForHour(hour)}.{" "}
          <span className="hb-hero-masthead-dim">
            {completedToday} of {totalActiveToday} done.
          </span>
        </h1>
      </div>
      <div className="hb-hero-right">
        <div className="hb-ring">
          <CompletionRing pct={pct} />
          <div className="hb-ring-pct">{pctLabel}</div>
        </div>
        <button type="button" className="refined-btn primary" onClick={onNewHabit}>
          + New Habit
        </button>
      </div>
    </header>
  );
}
