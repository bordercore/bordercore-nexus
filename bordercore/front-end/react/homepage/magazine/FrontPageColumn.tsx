import React from "react";
import { MagSection } from "./MagSection";
import { TasksList } from "./TasksList";
import { ExerciseSeverityList } from "./ExerciseSeverityList";
import { HabitsList } from "./HabitsList";
import type { Habit, OverdueExercise, Task } from "../types";

interface FrontPageColumnProps {
  tasks: Task[];
  todoListUrl: string;
  overdueExercises: OverdueExercise[];
  exerciseDetailUrlTemplate: string;
  fitnessSummaryUrl: string;
  habits: Habit[];
  habitListUrl: string;
}

export function FrontPageColumn({
  tasks,
  todoListUrl,
  overdueExercises,
  exerciseDetailUrlTemplate,
  fitnessSummaryUrl,
  habits,
  habitListUrl,
}: FrontPageColumnProps) {
  return (
    <div className="mag-column">
      <MagSection accent="pink" kicker={<a href={todoListUrl}>the slate</a>}>
        <TasksList tasks={tasks} todoListUrl={todoListUrl} />
      </MagSection>

      <MagSection accent="danger" kicker={<a href={fitnessSummaryUrl}>health watch · overdue</a>}>
        <ExerciseSeverityList
          exercises={overdueExercises}
          exerciseDetailUrlTemplate={exerciseDetailUrlTemplate}
        />
      </MagSection>

      <MagSection accent="cyan" kicker={<a href={habitListUrl}>habits</a>}>
        <HabitsList habits={habits} />
      </MagSection>
    </div>
  );
}
