import React from "react";
import type { HabitSummary } from "../types";
import { WeekDots } from "./WeekDots";
import { timeAgo } from "../utils/format";

interface HabitCardProps {
  habit: HabitSummary;
  todayIso: string;
  detailUrl: string;
  onToggleToday: (habit: HabitSummary) => void;
}

/**
 * One habit per card.  Top row = name/tags/started + today-toggle button;
 * middle row = purpose; bottom row = week dots and stat values.  The Dose
 * stat only renders when the habit has a `unit` set.
 */
export function HabitCard({ habit, todayIso, detailUrl, onToggleToday }: HabitCardProps) {
  const toggleClass = `hb-toggle-today ${habit.completed_today ? "is-logged" : "is-pending"}`;
  const toggleLabel = habit.completed_today ? "Logged for today; click to unlog" : "Log today";

  const showDose = habit.unit !== "" && habit.last_value !== null;

  return (
    <article className="hb-habit-card">
      <div className="hb-habit-card-top">
        <div>
          <a className="hb-habit-name" href={detailUrl}>
            {habit.name}
          </a>
          <div className="hb-habit-meta">
            {habit.tags.map(tag => (
              <span key={tag} className="hb-tag-chip">
                {tag}
              </span>
            ))}
            <span className="hb-habit-started">started {timeAgo(habit.start_date)}</span>
          </div>
        </div>
        <button
          type="button"
          className={toggleClass}
          aria-label={toggleLabel}
          aria-pressed={habit.completed_today}
          onClick={() => onToggleToday(habit)}
        >
          {habit.completed_today ? "✓" : "+"}
        </button>
      </div>

      {habit.purpose && <p className="hb-habit-purpose">{habit.purpose}</p>}

      <div className="hb-habit-card-bottom">
        <WeekDots days={habit.recent_logs} todayIso={todayIso} />
        <div className="hb-stats">
          <div>
            <div className="hb-stat-label">Streak</div>
            <div className="hb-stat-value">{habit.current_streak}</div>
          </div>
          <div>
            <div className="hb-stat-label">All-time</div>
            <div className="hb-stat-value">{habit.completed_logs}</div>
          </div>
          {showDose && (
            <div>
              <div className="hb-stat-label">Dose</div>
              <div className="hb-stat-value">
                {habit.last_value}
                <span className="hb-stat-unit">{habit.unit}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
