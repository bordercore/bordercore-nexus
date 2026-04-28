import React from "react";
import { fillUrlTemplate } from "./utils";
import type { OverdueExercise } from "../types";

interface ExerciseSeverityListProps {
  exercises: OverdueExercise[];
  exerciseDetailUrlTemplate: string;
  limit?: number;
}

const MAX_BAR_DAYS = 240;

function severityClass(deltaDays: number): string {
  if (deltaDays > 100) return "is-sev-danger";
  if (deltaDays > 30) return "is-sev-warn";
  return "is-sev-ok";
}

export function ExerciseSeverityList({
  exercises,
  exerciseDetailUrlTemplate,
  limit = 5,
}: ExerciseSeverityListProps) {
  const visible = exercises.slice(0, limit);

  if (visible.length === 0) {
    return <div className="mag-empty">Nothing overdue.</div>;
  }

  return (
    <div className="mag-sev">
      {visible.map(exercise => {
        const sev = severityClass(exercise.delta_days);
        const fillPct = Math.min(100, (exercise.delta_days / MAX_BAR_DAYS) * 100);
        return (
          <div key={exercise.uuid} className={`mag-sev-row ${sev}`}>
            <div className="mag-sev-head">
              <span className="mag-sev-name">
                <a href={fillUrlTemplate(exerciseDetailUrlTemplate, exercise.uuid)}>
                  {exercise.name}
                </a>
              </span>
              <span className="mag-sev-days mag-mono">{exercise.delta_days}d</span>
            </div>
            <div className="mag-sev-bar">
              <div
                className="mag-sev-fill"
                style={{ width: `${fillPct}%` }} // must remain inline
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
