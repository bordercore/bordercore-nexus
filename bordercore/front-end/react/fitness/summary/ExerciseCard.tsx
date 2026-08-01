import React from "react";
import type { ExerciseCardData } from "./types";
import { Sparkline } from "./Sparkline";
import { WeekStrip } from "./WeekStrip";

interface ExerciseCardProps {
  card: ExerciseCardData;
}

function lastWorkoutText(days: number | null): string {
  if (days === null) return "no history";
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function lastSetSummary(card: ExerciseCardData): string | null {
  if (card.last_weight && card.last_reps) {
    // Show whole-pound weights without a trailing `.0`.
    const w = Number.isInteger(card.last_weight)
      ? card.last_weight
      : Math.round(card.last_weight * 10) / 10;
    return `${w} × ${card.last_reps}`;
  }
  if (card.last_reps) {
    return `${card.last_reps} reps`;
  }
  return null;
}

/**
 * One card in the fitness summary grid. Branches on ``card.status``; styling
 * (gradient, glow, spine, badge) is fully driven by the SCSS modifier set on
 * the root via ``data-status`` + ``data-group``. Exercises already worked
 * today carry ``data-done`` and get a check-mark watermark.
 */
export function ExerciseCard({ card }: ExerciseCardProps) {
  const summary = lastSetSummary(card);
  const doneToday = card.last_workout_days_ago === 0;

  return (
    <article
      className="fitness-card"
      data-status={card.status}
      data-group={card.group}
      data-active={card.is_active ? "1" : "0"}
      data-done={doneToday ? "1" : "0"}
    >
      <span className="fitness-card__spine" aria-hidden="true" />
      {doneToday && (
        <span className="fitness-card__done" role="img" aria-label="completed today">
          ✓
        </span>
      )}
      {card.status === "overdue" && card.last_workout_days_ago !== null && (
        <span
          className="fitness-card__ribbon"
          aria-label={`${card.last_workout_days_ago} days since last workout`}
        >
          {card.last_workout_days_ago}d
        </span>
      )}
      <a className="fitness-card__hit" href={card.exercise_url} aria-label={card.name} />

      <header className="fitness-card__head">
        <span className="fitness-card__group">
          <span className="fitness-card__group-dot" aria-hidden="true" />
          {card.group_label.toLowerCase()}
        </span>
        {card.status === "today" && (
          <span className="fitness-card__badge fitness-card__badge--today">● today</span>
        )}
      </header>

      <h3 className="fitness-card__title">{card.name}</h3>

      <div className="fitness-card__spark-wrap">
        <Sparkline
          series={card.sparkline}
          ariaLabel={`${card.name} ${card.sparkline_metric ?? ""} trend`}
        />
      </div>

      <footer className="fitness-card__foot">
        <WeekStrip schedule={card.schedule} />
        <span className="fitness-card__meta">
          {summary && <span className="fitness-card__meta-summary">{summary}</span>}
          {card.status !== "overdue" && (
            <span className="fitness-card__meta-when">
              {lastWorkoutText(card.last_workout_days_ago)}
            </span>
          )}
        </span>
      </footer>
    </article>
  );
}

export default ExerciseCard;
