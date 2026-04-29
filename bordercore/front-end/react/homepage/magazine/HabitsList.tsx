import React from "react";
import type { Habit } from "../types";

interface HabitsListProps {
  habits: Habit[];
}

function formatStreak(days: number): string {
  if (days <= 0) return "—";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"}`;
}

export function HabitsList({ habits }: HabitsListProps) {
  if (habits.length === 0) {
    return <div className="mag-empty">No active habits.</div>;
  }

  return (
    <div className="mag-habits">
      {habits.map(habit => (
        <div key={habit.uuid} className="mag-habit-row">
          <span className="mag-habit-name">{habit.name}</span>
          <span
            className={`mag-habit-streak ${habit.streak > 0 ? "is-active" : ""}`}
            title={`${habit.streak} day${habit.streak === 1 ? "" : "s"}`}
          >
            {formatStreak(habit.streak)}
          </span>
        </div>
      ))}
    </div>
  );
}
