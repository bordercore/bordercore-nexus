import React, { useState, useRef, useEffect } from "react";
import { Modal } from "bootstrap";
import { Card } from "../common/Card";
import { doPost } from "../utils/reactUtils";
import { Schedule } from "./Schedule";
import { LastWorkout } from "./LastWorkout";
import { WorkoutGraph } from "./WorkoutGraph";
import { AddWorkoutForm } from "./AddWorkoutForm";
import type { ActivityInfo, RelatedExercise, TargetedMuscles } from "./types";

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

interface ExerciseDetailUrls {
  changeActiveStatus: string;
  editNote: string;
  getWorkoutData: string;
  updateSchedule: string;
  updateRestPeriod: string;
  addWorkout: string;
}

interface ExerciseDetailPageProps {
  urls: ExerciseDetailUrls;
  exerciseUuid: string;
  exerciseName: string;
  csrfToken: string;
  activityInfo: ActivityInfo;
  relatedExercises: RelatedExercise[];
  targetedMuscles: TargetedMuscles;
  lastWorkout: {
    date: string;
    description: string;
    note: string;
    deltaDays: number;
    latestWeight: number[];
    latestReps: number[];
    latestDuration: number[];
  };
  exercise: {
    hasWeight: boolean;
    hasDuration: boolean;
  };
}

export function ExerciseDetailPage({
  urls,
  exerciseUuid,
  exerciseName,
  csrfToken,
  activityInfo: initialActivityInfo,
  relatedExercises,
  targetedMuscles,
  lastWorkout,
  exercise,
}: ExerciseDetailPageProps) {
  const [activityInfo, setActivityInfo] = useState<ActivityInfo>(initialActivityInfo);
  const [restPeriod, setRestPeriod] = useState<string>(
    String(initialActivityInfo.rest_period || 3)
  );
  const [timerDisplay, setTimerDisplay] = useState<string>("");

  const timerModalRef = useRef<HTMLDivElement>(null);
  const timerModalInstanceRef = useRef<Modal | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerModalRef.current && !timerModalInstanceRef.current) {
      timerModalInstanceRef.current = new Modal(timerModalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  function handleChangeRestPeriod() {
    doPost(
      urls.updateRestPeriod,
      {
        uuid: exerciseUuid,
        rest_period: restPeriod,
      },
      () => {},
      "Rest period changed"
    );
  }

  function handleStartTimer() {
    const currentDate = new Date();
    const timerEnd = new Date(currentDate.getTime() + Number(restPeriod) * 60000);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      const total = timerEnd.getTime() - new Date().getTime();
      const seconds = Math.floor((total / 1000) % 60);
      const minutes = Math.floor((total / 1000 / 60) % 60);

      if (minutes < 1) {
        setTimerDisplay(`${seconds} seconds`);
      } else {
        setTimerDisplay(`${minutes} ${pluralize("minute", minutes)} ${seconds} seconds`);
      }

      if (total <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        setTimerDisplay("Done");
        timerModalInstanceRef.current?.show();
      }
    }, 1000);
  }

  return (
    <div id="exercise-detail" className="row g-0 h-100 mx-2">
      {/* Timer Modal */}
      <div
        ref={timerModalRef}
        id="modalTimer"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="myModalLabel"
      >
        <div className="modal-dialog modal-sm" role="document">
          <div className="modal-content">
            <div className="modal-body d-flex align-items-center">
              <h4 className="mb-0">Timer done!</h4>
              <input
                type="button"
                className="btn btn-primary ms-auto"
                value="Close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Left Column */}
      <div className="col-lg-3 d-flex flex-column">
        <div className="mb-gutter">
          <Schedule
            activityInfo={activityInfo}
            relatedExercises={relatedExercises}
            exerciseUuid={exerciseUuid}
            exerciseName={exerciseName}
            changeActiveStatusUrl={urls.changeActiveStatus}
            editScheduleUrl={urls.updateSchedule}
            onActivityInfoChange={setActivityInfo}
          />
        </div>
        <LastWorkout
          date={lastWorkout.date}
          description={lastWorkout.description}
          exerciseUuid={exerciseUuid}
          initialNote={lastWorkout.note}
          duration={lastWorkout.latestDuration}
          weight={lastWorkout.latestWeight}
          reps={lastWorkout.latestReps}
          interval={lastWorkout.deltaDays}
          editNoteUrl={urls.editNote}
        />
      </div>

      {/* Right Column */}
      <div className="col-lg-9 d-flex flex-column ps-gutter">
        <WorkoutGraph getWorkoutDataUrl={urls.getWorkoutData} />
        <div className="d-flex h-100">
          <AddWorkoutForm
            csrfToken={csrfToken}
            initialWeight={String(lastWorkout.latestWeight[0] || 0)}
            initialReps={String(lastWorkout.latestReps[0] || 0)}
            initialDuration={String(lastWorkout.latestDuration[0] || 0)}
            addWorkoutUrl={urls.addWorkout}
            hasWeight={exercise.hasWeight}
            hasDuration={exercise.hasDuration}
          />
          <div className="d-flex flex-column w-50">
            <Card cardClassName="me-2 mb-gutter backdrop-filter" title="" id="muscles-targeted">
              <div className="d-flex">
                <div className="card-title text-primary">
                  Muscles Targeted:
                  <ul>
                    {targetedMuscles.primary.map(muscle => (
                      <li key={muscle}>
                        <span className="item-name">{muscle}</span>
                        <span className="item-value small text-muted">PRIMARY</span>
                      </li>
                    ))}
                    {targetedMuscles.secondary.map(muscle => (
                      <li key={muscle}>
                        <span className="item-name">{muscle}</span>
                        <span className="item-value small text-muted">SECONDARY</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
            <Card cardClassName="backdrop-filter flex-grow-1" title="">
              <div className="d-flex">
                <div className="card-title text-primary">
                  Rest between sets:
                  <div className="d-flex align-items-center my-2">
                    <label className="w-50">Minutes</label>
                    <input
                      className="form-control w-50 ms-3"
                      type="text"
                      size={3}
                      value={restPeriod}
                      onChange={e => setRestPeriod(e.target.value)}
                      autoComplete="off"
                    />
                    <input
                      className="btn btn-primary ms-3"
                      type="button"
                      value="Change"
                      onClick={handleChangeRestPeriod}
                    />
                  </div>
                  <div className="d-flex mt-3">
                    <input
                      className="btn btn-primary"
                      type="button"
                      value="Start Timer"
                      onClick={handleStartTimer}
                    />
                    <div id="timer" className="ms-3">
                      {timerDisplay}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExerciseDetailPage;
