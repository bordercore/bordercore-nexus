import React from "react";
import { createRoot } from "react-dom/client";
import ExerciseDetailPage from "../react/fitness/ExerciseDetailPage";
import type { ActivityInfo, RelatedExercise, TargetedMuscles } from "../react/fitness/types";

function readJson<T>(container: HTMLElement, attr: string, fallback: T): T {
  try {
    const raw = container.getAttribute(attr);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Error parsing ${attr}:`, e);
    return fallback;
  }
}

const container = document.getElementById("react-root");
if (container) {
  const exerciseUuid = container.getAttribute("data-exercise-uuid") || "";
  const exerciseName = container.getAttribute("data-exercise-name") || "";
  const hasWeight = container.getAttribute("data-has-weight") === "true";
  const hasDuration = container.getAttribute("data-has-duration") === "true";

  const activityInfo = readJson<ActivityInfo>(container, "data-activity-info", {
    schedule: [false, false, false, false, false, false, false],
  });
  if (!activityInfo.schedule) {
    activityInfo.schedule = [false, false, false, false, false, false, false];
  }

  const relatedExercises = readJson<RelatedExercise[]>(container, "data-related-exercises", []);
  const targetedMuscles = readJson<TargetedMuscles>(container, "data-targeted-muscles", {
    primary: [],
    secondary: [],
  });

  const lastWorkoutDate = container.getAttribute("data-last-workout-date") || "";
  const descriptionRaw = container.getAttribute("data-description") || "";
  const description = descriptionRaw ? JSON.parse(`"${descriptionRaw}"`) : "";
  const noteRaw = container.getAttribute("data-note") || "";
  const note = noteRaw ? JSON.parse(`"${noteRaw}"`) : "";
  const deltaDays = parseInt(container.getAttribute("data-delta-days") || "7", 10);

  const latestWeight = readJson<number[]>(container, "data-latest-weight", [0]);
  const latestReps = readJson<number[]>(container, "data-latest-reps", [0]);
  const latestDuration = readJson<number[]>(container, "data-latest-duration", [0]);
  const previousWeight = readJson<number[]>(container, "data-previous-weight", []);
  const previousReps = readJson<number[]>(container, "data-previous-reps", []);
  const previousDuration = readJson<number[]>(container, "data-previous-duration", []);

  const root = createRoot(container);
  root.render(
    <ExerciseDetailPage
      urls={{
        getWorkoutData: container.getAttribute("data-get-workout-data-url") || "",
        updateRestPeriod: container.getAttribute("data-update-rest-period-url") || "",
        updateSchedule: container.getAttribute("data-update-schedule-url") || "",
        changeActiveStatus: container.getAttribute("data-change-active-status-url") || "",
        swapActiveExercise: container.getAttribute("data-swap-active-exercise-url") || "",
        editNote: container.getAttribute("data-edit-note-url") || "",
        logSet: container.getAttribute("data-log-set-url") || "",
        deleteSet: container.getAttribute("data-delete-set-url") || "",
        summary: container.getAttribute("data-fitness-summary-url") || "",
      }}
      exerciseUuid={exerciseUuid}
      exerciseName={exerciseName}
      activityInfo={activityInfo}
      relatedExercises={relatedExercises}
      targetedMuscles={targetedMuscles}
      lastWorkout={{
        date: lastWorkoutDate,
        description,
        note,
        deltaDays,
        latestWeight,
        latestReps,
        latestDuration,
        previousWeight,
        previousReps,
        previousDuration,
      }}
      exercise={{
        hasWeight,
        hasDuration,
      }}
    />
  );
}
