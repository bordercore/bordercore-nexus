import React, { useState, useMemo, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExchangeAlt, faCalendarAlt } from "@fortawesome/free-solid-svg-icons";
import { Modal } from "bootstrap";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { doPost, EventBus } from "../utils/reactUtils";
import type { ActivityInfo, RelatedExercise } from "./types";

interface ScheduleProps {
  activityInfo: ActivityInfo;
  relatedExercises: RelatedExercise[];
  exerciseUuid: string;
  exerciseName: string;
  changeActiveStatusUrl: string;
  editScheduleUrl: string;
  onActivityInfoChange: (info: ActivityInfo) => void;
}

const DAYS_OF_THE_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function Schedule({
  activityInfo,
  relatedExercises,
  exerciseUuid,
  exerciseName,
  changeActiveStatusUrl,
  editScheduleUrl,
  onActivityInfoChange,
}: ScheduleProps) {
  const [isActive, setIsActive] = useState(!!activityInfo.started);
  const [schedule, setSchedule] = useState<boolean[]>(
    activityInfo.schedule || [false, false, false, false, false, false, false]
  );

  const switchExerciseModalRef = useRef<HTMLDivElement>(null);
  const changeScheduleModalRef = useRef<HTMLDivElement>(null);
  const switchExerciseModalInstanceRef = useRef<Modal | null>(null);
  const changeScheduleModalInstanceRef = useRef<Modal | null>(null);

  useEffect(() => {
    if (switchExerciseModalRef.current && !switchExerciseModalInstanceRef.current) {
      switchExerciseModalInstanceRef.current = new Modal(switchExerciseModalRef.current);
    }
    if (changeScheduleModalRef.current && !changeScheduleModalInstanceRef.current) {
      changeScheduleModalInstanceRef.current = new Modal(changeScheduleModalRef.current);
    }
  }, []);

  const scheduleDays = useMemo(() => {
    const days: string[] = [];
    const baseDate = new Date(2023, 0, 2); // Monday, January 2, 2023

    for (let index = 0; index < schedule.length; index++) {
      if (schedule[index]) {
        const targetDate = new Date(baseDate.getTime());
        targetDate.setDate(targetDate.getDate() + index);
        days.push(targetDate.toLocaleString("en-US", { weekday: "long" }));
      }
    }

    return days.join(" and ");
  }, [schedule]);

  const activeButtonValue = isActive ? "Active" : "Activate Exercise";

  function openSwitchExerciseModal() {
    switchExerciseModalInstanceRef.current?.show();
  }

  function openChangeScheduleModal() {
    changeScheduleModalInstanceRef.current?.show();
  }

  function handleScheduleChange() {
    doPost(
      editScheduleUrl,
      {
        uuid: exerciseUuid,
        schedule: schedule.join(","),
      },
      () => {
        changeScheduleModalInstanceRef.current?.hide();
        EventBus.$emit("toast", {
          body: `Exercise schedule changed to ${scheduleDays}`,
        });
      }
    );
  }

  function handleSelectRelatedExercise(uuid: string, name: string) {
    doPost(
      changeActiveStatusUrl,
      {
        uuid: uuid,
        remove: "false",
      },
      () => {
        switchExerciseModalInstanceRef.current?.hide();
        EventBus.$emit("toast", {
          body: `Exercise '${name}' added to active list`,
        });

        doPost(
          changeActiveStatusUrl,
          {
            uuid: exerciseUuid,
            remove: "true",
          },
          () => {
            setIsActive(false);
            EventBus.$emit("toast", {
              body: `Exercise '${exerciseName}' is now inactive`,
            });
          }
        );
      }
    );
  }

  function handleStatusChange() {
    doPost(
      changeActiveStatusUrl,
      {
        uuid: exerciseUuid,
        remove: isActive ? "true" : "false",
      },
      response => {
        setIsActive(!isActive);
        onActivityInfoChange(
          response.data.info || { schedule: [false, false, false, false, false, false, false] }
        );
        if (response.data.info) {
          setSchedule(
            response.data.info.schedule || [false, false, false, false, false, false, false]
          );
        }
      }
    );
  }

  function handleScheduleToggle(index: number) {
    setSchedule(prev => {
      const newSchedule = [...prev];
      newSchedule[index] = !newSchedule[index];
      return newSchedule;
    });
  }

  const dropdownContent = (
    <ul className="dropdown-menu-list">
      <li>
        <a
          className="dropdown-item"
          href="#"
          onClick={e => {
            e.preventDefault();
            openSwitchExerciseModal();
          }}
        >
          <FontAwesomeIcon icon={faExchangeAlt} className="text-primary me-3" />
          Switch Exercise
        </a>
      </li>
      <li>
        <a
          className="dropdown-item"
          href="#"
          onClick={e => {
            e.preventDefault();
            openChangeScheduleModal();
          }}
        >
          <FontAwesomeIcon icon={faCalendarAlt} className="text-primary me-3" />
          Change Schedule
        </a>
      </li>
    </ul>
  );

  return (
    <div>
      {/* Switch Exercise Modal */}
      <div
        ref={switchExerciseModalRef}
        id="modalSwitchExercise"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="myModalLabel"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 id="myModalLabel" className="modal-title">
                Switch Exercise
              </h4>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div className="mb-3 text-primary">
                <small>
                  Selecting an exercise from the list below will make it <em>active</em> and make
                  the exercise <strong>{exerciseName}</strong> <em>inactive</em>.
                </small>
              </div>
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedExercises.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-center">
                        No related exercises
                      </td>
                    </tr>
                  ) : (
                    relatedExercises.map(exercise => (
                      <tr
                        key={exercise.uuid}
                        className="cursor-pointer"
                        onClick={() => handleSelectRelatedExercise(exercise.uuid, exercise.name)}
                      >
                        <td>{exercise.name}</td>
                        <td>{exercise.last_active}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Change Schedule Modal */}
      <div
        ref={changeScheduleModalRef}
        id="modalChangeSchedule"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="myModalLabel"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 id="myModalLabel" className="modal-title">
                Change Exercise Schedule
              </h4>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div className="d-flex">
                <div className="text-nowrap">Workout every</div>
                <div className="ms-3">
                  {DAYS_OF_THE_WEEK.map((day, index) => (
                    <div key={index} className="d-flex">
                      <div id="fitness-schedule-d-o-t-w" className="text-info me-2">
                        {day}
                      </div>
                      <div className="d-flex align-items-center">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={schedule[index]}
                            onChange={() => handleScheduleToggle(index)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ms-5 mt-2">
                  <button type="button" className="btn btn-primary" onClick={handleScheduleChange}>
                    Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Card */}
      <div className={isActive ? "hover-target" : ""}>
        <Card
          cardClassName="z-index-positive flex-grow-0 position-relative backdrop-filter"
          title=""
        >
          <div className="d-flex flex-column">
            {isActive ? (
              <div className="mb-2 d-flex flex-column">
                <div className="d-flex">
                  <div className="item-name">Started</div>
                  <div className="item-value d-flex flex-column ms-2">
                    <div>
                      <strong>{activityInfo.started}</strong>
                    </div>
                    <div>
                      <span className="text-small ms-1">{activityInfo.relative_date}</span>
                    </div>
                  </div>
                  <div className="ms-auto">
                    <DropDownMenu showOnHover={true} dropdownSlot={dropdownContent} />
                  </div>
                </div>
                <hr className="m-2" />
                <div className="d-flex">
                  <div className="item-name">Schedule</div>
                  <div className="item-value fw-bold ms-2">
                    {scheduleDays ? <div>every {scheduleDays}</div> : <div>Not scheduled</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div>Exercise not active.</div>
            )}
            <div className="mt-3">
              <button type="submit" className="btn btn-primary" onClick={handleStatusChange}>
                {isActive && <FontAwesomeIcon icon={faCheck} className="me-2" />}
                {activeButtonValue}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Schedule;
