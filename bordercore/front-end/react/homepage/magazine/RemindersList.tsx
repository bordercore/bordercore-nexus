import React from "react";
import type { Reminder } from "../types";

interface RemindersListProps {
  reminders: Reminder[];
}

const WEEKDAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "";

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 0) return "overdue";
  if (diffMin < 60) return `in ${diffMin}m`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `in ${diffHr}h`;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((target.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 7) return WEEKDAY[target.getDay()];

  return target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "";
  return target.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function RemindersList({ reminders }: RemindersListProps) {
  if (reminders.length === 0) {
    return <div className="mag-empty">No upcoming reminders.</div>;
  }

  return (
    <div className="mag-reminders">
      {reminders.map(reminder => (
        <div key={reminder.uuid} className="mag-reminder-row">
          <div className="mag-reminder-when">
            <span className="mag-reminder-rel">{formatRelative(reminder.next_trigger_at)}</span>
            <span className="mag-reminder-time">{formatTime(reminder.next_trigger_at)}</span>
          </div>
          <span className="mag-reminder-name" title={reminder.schedule}>
            {reminder.name}
          </span>
        </div>
      ))}
    </div>
  );
}
