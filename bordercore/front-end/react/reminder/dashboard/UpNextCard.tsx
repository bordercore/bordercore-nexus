import React from "react";
import type { Reminder } from "../types";

interface UpNextCardProps {
  reminders: Reminder[];
  now: Date;
}

function shortCountdown(reminder: Reminder, now: Date): string {
  if (reminder.next_trigger_at_unix == null) return "—";
  const seconds = Math.max(
    0,
    Math.floor((reminder.next_trigger_at_unix * 1000 - now.getTime()) / 1000)
  );
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function shortWhen(reminder: Reminder, now: Date): string {
  if (reminder.next_trigger_at_unix == null) return reminder.schedule_description;
  const trigger = new Date(reminder.next_trigger_at_unix * 1000);
  const today = trigger.toDateString() === now.toDateString();
  const tomorrow =
    trigger.toDateString() === new Date(now.getTime() + 24 * 3600 * 1000).toDateString();
  const time = trigger
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
  if (today) return `today · ${time}`;
  if (tomorrow) return `tomorrow · ${time}`;
  const day = trigger
    .toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    .toLowerCase();
  return `${day} · ${time}`;
}

export function UpNextCard({ reminders, now }: UpNextCardProps) {
  return (
    <article className="rm-rail-card rm-upnext-card">
      <header className="rm-rail-card-head">
        <span className="rm-rail-card-title">up next</span>
        <span className="rm-rail-card-meta">queue · {reminders.length}</span>
      </header>
      {reminders.length === 0 ? (
        <p className="rm-rail-empty">Nothing else queued.</p>
      ) : (
        <div className="rm-upnext-list">
          {reminders.map(reminder => (
            <div key={reminder.uuid} className="rm-upnext-row">
              <span className="rm-upnext-dot" aria-hidden="true" />
              <div>
                <div className="rm-upnext-name">{reminder.name}</div>
                <div className="rm-upnext-sub">{shortWhen(reminder, now)}</div>
              </div>
              <span className="rm-upnext-countdown">{shortCountdown(reminder, now)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default UpNextCard;
