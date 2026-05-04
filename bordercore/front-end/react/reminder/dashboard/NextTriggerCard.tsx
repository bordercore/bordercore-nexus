import React from "react";
import type { Reminder } from "../types";
import { countdownProgress, formatCountdown } from "../grouping";

interface NextTriggerCardProps {
  reminder: Reminder | null;
  now: Date;
}

function deltaMs(reminder: Reminder, now: Date): number | null {
  if (reminder.next_trigger_at_unix == null) return null;
  return reminder.next_trigger_at_unix * 1000 - now.getTime();
}

function summaryLine(reminder: Reminder, now: Date): string {
  if (reminder.next_trigger_at_unix == null) return reminder.schedule_description;
  const trigger = new Date(reminder.next_trigger_at_unix * 1000);
  const today =
    trigger.toDateString() === now.toDateString()
      ? "today"
      : trigger.toDateString() === new Date(now.getTime() + 24 * 3600 * 1000).toDateString()
        ? "tomorrow"
        : trigger
            .toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
            .toLowerCase();
  const time = trigger
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
  const cadence = reminder.schedule_type.toLowerCase();
  return `${today} · ${time} · ${cadence}`;
}

function metaLabel(reminder: Reminder | null, now: Date): string {
  if (!reminder) return "queue empty";
  const delta = deltaMs(reminder, now);
  if (delta == null) return "no schedule";
  const seconds = Math.max(0, Math.floor(delta / 1000));
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

export function NextTriggerCard({ reminder, now }: NextTriggerCardProps) {
  if (!reminder) {
    return (
      <article className="rm-rail-card rm-nextup-card">
        <header className="rm-rail-card-head">
          <span className="rm-rail-card-title">⌁ next trigger</span>
          <span className="rm-rail-card-meta">{metaLabel(null, now)}</span>
        </header>
        <p className="rm-rail-empty">No upcoming reminders.</p>
      </article>
    );
  }

  const delta = deltaMs(reminder, now);
  const countdown = formatCountdown(delta ?? 0);
  const progress = countdownProgress(delta ?? 0);
  const progressStep = Math.max(0, Math.min(20, Math.round(progress * 20)));
  const progressClass = `rm-nextup-progress-bar rm-nextup-progress-${progressStep}`;

  return (
    <article className="rm-rail-card rm-nextup-card">
      <header className="rm-rail-card-head">
        <span className="rm-rail-card-title">⌁ next trigger</span>
        <span className="rm-rail-card-meta">{metaLabel(reminder, now)}</span>
      </header>
      <div className="rm-nextup-name">{reminder.name}</div>
      <div className="rm-nextup-sub">{summaryLine(reminder, now)}</div>
      <div className="rm-nextup-countdown" aria-label="time until trigger">
        <span className="rm-nextup-num">{countdown.hh}</span>
        <span className="rm-nextup-unit">H</span>
        <span className="rm-nextup-num">{countdown.mm}</span>
        <span className="rm-nextup-unit">M</span>
        <span className="rm-nextup-num">{countdown.ss}</span>
        <span className="rm-nextup-unit">S</span>
      </div>
      <div className="rm-nextup-progress" aria-hidden="true">
        <span className={progressClass} />
      </div>
      <div className="rm-nextup-actions">
        <a className="rm-ghost-btn" href={reminder.detail_url}>
          open
        </a>
      </div>
    </article>
  );
}

export default NextTriggerCard;
