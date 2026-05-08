import React, { useRef, useState } from "react";
import { doPost } from "../../utils/reactUtils";
import type { ActivityInfo } from "../types";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface ActivityCardProps {
  activityInfo: ActivityInfo;
  exerciseUuid: string;
  updateScheduleUrl: string;
  changeActiveStatusUrl: string;
  onActivityInfoChange: (info: ActivityInfo) => void;
}

const EMPTY_SCHEDULE: boolean[] = [false, false, false, false, false, false, false];

export function ActivityCard({
  activityInfo,
  exerciseUuid,
  updateScheduleUrl,
  changeActiveStatusUrl,
  onActivityInfoChange,
}: ActivityCardProps) {
  const schedule = activityInfo.schedule || EMPTY_SCHEDULE;
  const isActive = activityInfo.is_active ?? false;
  const started = activityInfo.started || "—";
  const elapsed = activityInfo.relative_date || "—";
  const frequency = activityInfo.frequency;
  const scheduleDays = activityInfo.schedule_days || "";

  // Track the schedule that the server last confirmed. If a request fails we
  // revert to this snapshot.
  const lastCommittedRef = useRef<boolean[]>(schedule);
  lastCommittedRef.current = schedule;

  const [pending, setPending] = useState<boolean>(false);

  function toggleDay(index: number) {
    if (pending) return;
    const next = schedule.slice();
    next[index] = !next[index];

    // Optimistic local update so the pill flips immediately.
    onActivityInfoChange({ ...activityInfo, schedule: next });
    setPending(true);

    doPost(
      updateScheduleUrl,
      {
        uuid: exerciseUuid,
        schedule: next.map(v => (v ? "true" : "false")).join(","),
      },
      response => {
        const info = response.data?.info;
        if (info) {
          // Merge server-authoritative fields (newly-set started, is_active,
          // schedule_days) back into page state. Preserve the rest_period we
          // already had if the server omits it.
          onActivityInfoChange({
            ...activityInfo,
            ...info,
            schedule: info.schedule || next,
          });
        }
        setPending(false);
      },
      "",
      "Error updating schedule"
    );

    // Failsafe: release the pending lock if the callback never fires.
    window.setTimeout(() => setPending(false), 4000);
  }

  function handleDeactivate() {
    if (pending) return;
    if (!window.confirm("Deactivate this exercise? Your workout history is preserved.")) {
      return;
    }
    setPending(true);
    doPost(
      changeActiveStatusUrl,
      { uuid: exerciseUuid, remove: "true" },
      () => {
        onActivityInfoChange({
          schedule: EMPTY_SCHEDULE.slice(),
          schedule_days: "",
          is_active: false,
          rest_period: activityInfo.rest_period,
        });
        setPending(false);
      },
      "",
      "Error deactivating exercise"
    );
    window.setTimeout(() => setPending(false), 4000);
  }

  return (
    <div className="ex-card accent glow">
      <h3>
        <span>activity</span>
        {isActive && (
          <button
            type="button"
            className="ex-btn ghost sm"
            onClick={handleDeactivate}
            disabled={pending}
            title="remove this exercise from your active schedule"
          >
            deactivate
          </button>
        )}
      </h3>
      {isActive ? (
        <>
          <div className="ex-meta-row">
            <span className="k">started</span>
            <span className="v accent">{started}</span>
          </div>
          <div className="ex-meta-row">
            <span className="k">elapsed</span>
            <span className="v">{elapsed}</span>
          </div>
          {frequency !== undefined && (
            <div className="ex-meta-row">
              <span className="k">frequency</span>
              <span className="v">every {frequency}d</span>
            </div>
          )}
          <div className="ex-hair" />
        </>
      ) : (
        <p className="ex-activity-inactive">inactive — click any day to activate.</p>
      )}
      <div className="ex-schedule-label">schedule</div>
      <div className="ex-schedule">
        {WEEKDAY_LETTERS.map((letter, i) => {
          const on = !!schedule[i];
          return (
            <button
              key={i}
              type="button"
              className={`dot ${on ? "on" : ""}`}
              onClick={() => toggleDay(i)}
              disabled={pending}
              aria-pressed={on}
              aria-label={`${on ? "remove" : "add"} ${WEEKDAY_NAMES[i]}`}
              title={`${on ? "remove" : "add"} ${WEEKDAY_NAMES[i].toLowerCase()}`}
            >
              {letter}
            </button>
          );
        })}
      </div>
      {scheduleDays && (
        <div className="ex-next-session">
          active days <span className="when">{scheduleDays.toLowerCase()}</span>
        </div>
      )}
    </div>
  );
}
