import React from "react";
import type { RecentDay } from "../types";
import { parseIsoDate } from "../utils/format";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

interface WeekDotsProps {
  /** Last 7 days, oldest-first; today should be the final entry. */
  days: RecentDay[];
  /** ISO date treated as "today" — gets the cyan outline. */
  todayIso: string;
}

/**
 * Seven stacked label+square columns showing the last 7 days of completion.
 * Filled cyan when completed; dashed-muted otherwise.  Today gets a 2px
 * cyan outline regardless of completion state.
 */
export function WeekDots({ days, todayIso }: WeekDotsProps) {
  return (
    <div className="hb-week-dots" aria-label="Last 7 days">
      {days.map(day => {
        const dow = parseIsoDate(day.date).getDay();
        const classes = ["hb-week-square"];
        if (day.completed) classes.push("is-filled");
        if (day.date === todayIso) classes.push("is-today");
        return (
          <div key={day.date} className="hb-week-day">
            <div className="hb-week-day-letter">{LETTERS[dow]}</div>
            <div
              className={classes.join(" ")}
              title={`${day.date}: ${day.completed ? "logged" : "missed"}`}
            />
          </div>
        );
      })}
    </div>
  );
}
