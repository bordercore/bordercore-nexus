import React, { useState } from "react";
import { ActivityCard } from "./exercise_detail/ActivityCard";
import { DescriptionCard } from "./exercise_detail/DescriptionCard";
import { LastWorkoutCard } from "./exercise_detail/LastWorkoutCard";
import { LogSetCard } from "./exercise_detail/LogSetCard";
import { MusclesCard } from "./exercise_detail/MusclesCard";
import { RelatedExercisesCard } from "./exercise_detail/RelatedExercisesCard";
import { RestTimerCard } from "./exercise_detail/RestTimerCard";
import { WorkoutChartCard } from "./exercise_detail/WorkoutChartCard";
import type { ActivityInfo, RelatedExercise, TargetedMuscles } from "./types";

interface ExerciseDetailUrls {
  getWorkoutData: string;
  updateRestPeriod: string;
  updateSchedule: string;
  changeActiveStatus: string;
  swapActiveExercise: string;
  editNote: string;
  logSet: string;
  deleteSet: string;
  summary: string;
}

interface ExerciseDetailPageProps {
  urls: ExerciseDetailUrls;
  exerciseUuid: string;
  exerciseName: string;
  activityInfo: ActivityInfo;
  relatedExercises: RelatedExercise[];
  targetedMuscles: TargetedMuscles;
  lastWorkout: {
    date: string;
    description: string;
    note: string;
    latestWeight: number[];
    latestReps: number[];
    latestDuration: number[];
    previousWeight: number[];
    previousReps: number[];
    previousDuration: number[];
  };
  exercise: {
    hasWeight: boolean;
    hasDuration: boolean;
  };
}

function defaultLoggedValue(values: number[]): string {
  if (values.length === 0) return "0";
  const last = values[values.length - 1];
  return last === null || last === undefined ? "0" : String(last);
}

export function ExerciseDetailPage({
  urls,
  exerciseUuid,
  exerciseName,
  activityInfo: initialActivityInfo,
  relatedExercises,
  targetedMuscles,
  lastWorkout,
  exercise,
}: ExerciseDetailPageProps) {
  const [activityInfo, setActivityInfo] = useState<ActivityInfo>(initialActivityInfo);
  const isActive = activityInfo.is_active ?? false;
  const scheduleDays = (activityInfo.schedule_days || "").toLowerCase();
  const defaultMinutes =
    typeof activityInfo.rest_period === "number" && activityInfo.rest_period > 0
      ? activityInfo.rest_period
      : 3;

  return (
    <div className="exercise-detail-app">
      <div className="ex-page-head">
        <div className="ex-title-row">
          <h1 className="ex-title">{exerciseName}</h1>
          {isActive && (
            <div className="ex-status" title="active schedule">
              <span className="pulse" />
              <span>active</span>
            </div>
          )}
          {scheduleDays && (
            <div className="ex-title-meta">
              <span>every {scheduleDays}</span>
              {activityInfo.relative_date && (
                <>
                  <span className="dot" />
                  <span>since {activityInfo.relative_date}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ex-grid">
        <div className="ex-col">
          <ActivityCard
            activityInfo={activityInfo}
            exerciseUuid={exerciseUuid}
            updateScheduleUrl={urls.updateSchedule}
            changeActiveStatusUrl={urls.changeActiveStatus}
            onActivityInfoChange={setActivityInfo}
          />
          <LastWorkoutCard
            date={lastWorkout.date}
            hasWeight={exercise.hasWeight}
            hasDuration={exercise.hasDuration}
            latestWeight={lastWorkout.latestWeight}
            latestReps={lastWorkout.latestReps}
            latestDuration={lastWorkout.latestDuration}
            previousWeight={lastWorkout.previousWeight}
            previousReps={lastWorkout.previousReps}
            previousDuration={lastWorkout.previousDuration}
          />
          <DescriptionCard
            description={lastWorkout.description}
            note={lastWorkout.note}
            exerciseUuid={exerciseUuid}
            editNoteUrl={urls.editNote}
          />
          <RestTimerCard
            exerciseUuid={exerciseUuid}
            defaultMinutes={defaultMinutes}
            updateRestPeriodUrl={urls.updateRestPeriod}
          />
        </div>

        <div className="ex-col">
          <WorkoutChartCard
            exerciseUuid={exerciseUuid}
            getWorkoutDataUrl={urls.getWorkoutData}
            hasWeight={exercise.hasWeight}
            hasDuration={exercise.hasDuration}
          />
          <LogSetCard
            hasWeight={exercise.hasWeight}
            hasDuration={exercise.hasDuration}
            logSetUrl={urls.logSet}
            deleteSetUrl={urls.deleteSet}
            defaultWeight={defaultLoggedValue(lastWorkout.latestWeight)}
            defaultReps={defaultLoggedValue(lastWorkout.latestReps)}
            defaultDuration={defaultLoggedValue(lastWorkout.latestDuration)}
          />
          <div className="ex-row-split">
            <MusclesCard muscles={targetedMuscles} />
            <RelatedExercisesCard
              related={relatedExercises}
              exerciseUuid={exerciseUuid}
              isActive={isActive}
              swapActiveExerciseUrl={urls.swapActiveExercise}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExerciseDetailPage;
