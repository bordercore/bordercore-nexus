import React from "react";
import { createRoot } from "react-dom/client";
import ExerciseDetailPage from "../react/fitness/ExerciseDetailPage";
import type { ActivityInfo, RelatedExercise, TargetedMuscles } from "../react/fitness/types";

const container = document.getElementById("react-root");
if (container) {
  // URLs
  const changeActiveStatusUrl = container.getAttribute("data-change-active-status-url") || "";
  const editNoteUrl = container.getAttribute("data-edit-note-url") || "";
  const getWorkoutDataUrl = container.getAttribute("data-get-workout-data-url") || "";
  const updateScheduleUrl = container.getAttribute("data-update-schedule-url") || "";
  const updateRestPeriodUrl = container.getAttribute("data-update-rest-period-url") || "";
  const addWorkoutUrl = container.getAttribute("data-add-workout-url") || "";

  // Exercise info
  const exerciseUuid = container.getAttribute("data-exercise-uuid") || "";
  const exerciseName = container.getAttribute("data-exercise-name") || "";
  const hasWeight = container.getAttribute("data-has-weight") === "true";
  const hasDuration = container.getAttribute("data-has-duration") === "true";

  // CSRF token
  const csrfToken = container.getAttribute("data-csrf-token") || "";

  // JSON data
  let activityInfo: ActivityInfo = { schedule: [false, false, false, false, false, false, false] };
  let relatedExercises: RelatedExercise[] = [];
  let targetedMuscles: TargetedMuscles = { primary: [], secondary: [] };

  try {
    const activityInfoJson = container.getAttribute("data-activity-info") || "{}";
    activityInfo = JSON.parse(activityInfoJson);
    if (!activityInfo.schedule) {
      activityInfo.schedule = [false, false, false, false, false, false, false];
    }
  } catch (e) {
    console.error("Error parsing activity info:", e);
  }

  try {
    const relatedExercisesJson = container.getAttribute("data-related-exercises") || "[]";
    relatedExercises = JSON.parse(relatedExercisesJson);
  } catch (e) {
    console.error("Error parsing related exercises:", e);
  }

  try {
    const targetedMusclesJson = container.getAttribute("data-targeted-muscles") || "{}";
    targetedMuscles = JSON.parse(targetedMusclesJson);
  } catch (e) {
    console.error("Error parsing targeted muscles:", e);
  }

  // Last workout data
  const lastWorkoutDate = container.getAttribute("data-last-workout-date") || "";
  const description = container.getAttribute("data-description") || "";
  const note = container.getAttribute("data-note") || "";
  const deltaDays = parseInt(container.getAttribute("data-delta-days") || "7", 10);

  let latestWeight: number[] = [0];
  let latestReps: number[] = [0];
  let latestDuration: number[] = [0];

  try {
    const latestWeightJson = container.getAttribute("data-latest-weight") || "[0]";
    latestWeight = JSON.parse(latestWeightJson);
  } catch (e) {
    console.error("Error parsing latest weight:", e);
  }

  try {
    const latestRepsJson = container.getAttribute("data-latest-reps") || "[0]";
    latestReps = JSON.parse(latestRepsJson);
  } catch (e) {
    console.error("Error parsing latest reps:", e);
  }

  try {
    const latestDurationJson = container.getAttribute("data-latest-duration") || "[0]";
    latestDuration = JSON.parse(latestDurationJson);
  } catch (e) {
    console.error("Error parsing latest duration:", e);
  }

  const root = createRoot(container);
  root.render(
    <ExerciseDetailPage
      urls={{
        changeActiveStatus: changeActiveStatusUrl,
        editNote: editNoteUrl,
        getWorkoutData: getWorkoutDataUrl,
        updateSchedule: updateScheduleUrl,
        updateRestPeriod: updateRestPeriodUrl,
        addWorkout: addWorkoutUrl,
      }}
      exerciseUuid={exerciseUuid}
      exerciseName={exerciseName}
      csrfToken={csrfToken}
      activityInfo={activityInfo}
      relatedExercises={relatedExercises}
      targetedMuscles={targetedMuscles}
      lastWorkout={{
        date: lastWorkoutDate,
        description: description,
        note: note,
        deltaDays: deltaDays,
        latestWeight: latestWeight,
        latestReps: latestReps,
        latestDuration: latestDuration,
      }}
      exercise={{
        hasWeight: hasWeight,
        hasDuration: hasDuration,
      }}
    />
  );
}
