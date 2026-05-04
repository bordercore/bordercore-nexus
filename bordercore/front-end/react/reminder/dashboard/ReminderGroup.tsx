import React from "react";
import type { Reminder, ReminderGroup as ReminderGroupT } from "../types";
import { ReminderRow } from "./ReminderRow";

interface ReminderGroupProps {
  group: ReminderGroupT;
  imminentUuid: string | null;
  now: Date;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}

export function ReminderGroup({ group, imminentUuid, now, onEdit, onDelete }: ReminderGroupProps) {
  const headClass = `rm-group-head rm-group-${group.key}`;
  return (
    <section className="rm-group" aria-label={group.label}>
      <header className={headClass}>
        <span className="rm-group-label">{group.label}</span>
        <span className="rm-group-count">{group.reminders.length}</span>
        <span className="rm-group-rule" aria-hidden="true" />
      </header>
      {group.reminders.map(reminder => (
        <ReminderRow
          key={reminder.uuid}
          reminder={reminder}
          isImminent={reminder.uuid === imminentUuid}
          now={now}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}

export default ReminderGroup;
