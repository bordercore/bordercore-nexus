import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarAlt,
  faClock,
  faPencilAlt,
  faRedo,
  faSync,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import type { Reminder } from "../types";
import { StatusBadge } from "./StatusBadge";
import { WeekChips } from "./WeekChips";

interface ReminderRowProps {
  reminder: Reminder;
  isImminent: boolean;
  now: Date;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}

function getScheduleIcon(scheduleType: string) {
  const t = scheduleType.toLowerCase();
  if (t === "daily") return faClock;
  if (t === "weekly") return faSync;
  if (t === "monthly") return faCalendarAlt;
  return faRedo;
}

function formatCountdown(reminder: Reminder, now: Date): string | null {
  if (reminder.next_trigger_at_unix == null) return null;
  const seconds = Math.max(
    0,
    Math.floor((reminder.next_trigger_at_unix * 1000 - now.getTime()) / 1000)
  );
  if (seconds <= 0) return "now";
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

export function ReminderRow({ reminder, isImminent, now, onEdit, onDelete }: ReminderRowProps) {
  const classes = ["rm-row"];
  if (isImminent) classes.push("is-imminent");
  if (!reminder.is_active) classes.push("is-inactive");

  const showCountdown = isImminent;
  const countdownText = showCountdown ? formatCountdown(reminder, now) : null;

  return (
    <div className={classes.join(" ")}>
      <div className="rm-cell-name">
        <a href={reminder.detail_url} className="rm-name-link">
          {reminder.name}
        </a>
        {reminder.note && <span className="rm-name-note">{reminder.note}</span>}
      </div>

      <div className="rm-cell-schedule">
        <FontAwesomeIcon
          icon={getScheduleIcon(reminder.schedule_type)}
          className="rm-schedule-icon"
        />
        <span className="rm-schedule-text">{reminder.schedule_description}</span>
        {reminder.schedule_type === "weekly" && <WeekChips days={reminder.days_of_week} />}
      </div>

      <div>
        <StatusBadge reminder={reminder} now={now} />
      </div>

      <div className="rm-cell-next">
        {reminder.next_trigger_at ? (
          <>
            <span>{reminder.next_trigger_at}</span>
            {countdownText && <span className="rm-next-countdown">{countdownText}</span>}
          </>
        ) : (
          <span className="rm-next-empty">—</span>
        )}
      </div>

      <div className="rm-cell-actions">
        <button
          type="button"
          className="rm-row-action"
          onClick={() => onEdit(reminder)}
          aria-label={`edit ${reminder.name}`}
          title="edit"
        >
          <FontAwesomeIcon icon={faPencilAlt} />
        </button>
        <button
          type="button"
          className="rm-row-action rm-row-action-danger"
          onClick={() => onDelete(reminder)}
          aria-label={`delete ${reminder.name}`}
          title="delete"
        >
          <FontAwesomeIcon icon={faTrashAlt} />
        </button>
      </div>
    </div>
  );
}

export default ReminderRow;
