import React from "react";
import { MagSection } from "./MagSection";
import { TasksList } from "./TasksList";
import { ExerciseSeverityList } from "./ExerciseSeverityList";
import type { OverdueExercise, Task } from "../types";

interface FrontPageColumnProps {
  tasks: Task[];
  todoListUrl: string;
  overdueExercises: OverdueExercise[];
  exerciseDetailUrlTemplate: string;
}

export function FrontPageColumn({
  tasks,
  todoListUrl,
  overdueExercises,
  exerciseDetailUrlTemplate,
}: FrontPageColumnProps) {
  const headline =
    tasks.length === 0
      ? "Inbox zero — focus on what matters today"
      : `${tasks.length} high-priority task${tasks.length === 1 ? "" : "s"} await${
          tasks.length === 1 ? "s" : ""
        } attention`;

  return (
    <div className="mag-column">
      <MagSection accent="pink" kicker="front page">
        <h2 className="mag-lede">
          <a href={todoListUrl}>{headline}</a>
        </h2>
        <TasksList tasks={tasks} todoListUrl={todoListUrl} />
      </MagSection>

      <MagSection accent="danger" kicker="health watch · overdue">
        <ExerciseSeverityList
          exercises={overdueExercises}
          exerciseDetailUrlTemplate={exerciseDetailUrlTemplate}
        />
      </MagSection>
    </div>
  );
}
