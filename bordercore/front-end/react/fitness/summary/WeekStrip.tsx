import React from "react";

interface WeekStripProps {
  schedule: boolean[]; // 7 booleans, Monday-first
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Seven-dot weekly-schedule strip. A dot is filled in the card-accent color
 * when the exercise is scheduled for that weekday and dim otherwise — no
 * separate "today" marker.
 */
export function WeekStrip({ schedule }: WeekStripProps) {
  return (
    <ol className="fitness-card__week" aria-label="weekly schedule">
      {DAY_LABELS.map((letter, i) => {
        const modifier = schedule[i] ? "on" : "off";
        return (
          <li
            key={i}
            className={`fitness-card__week-dot fitness-card__week-dot--${modifier}`}
            aria-label={letter}
          />
        );
      })}
    </ol>
  );
}

export default WeekStrip;
