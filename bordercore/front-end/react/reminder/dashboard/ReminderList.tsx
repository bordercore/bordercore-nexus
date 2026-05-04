import React from "react";
import type { Reminder, ReminderGroup as ReminderGroupT } from "../types";
import { ReminderGroup } from "./ReminderGroup";

interface ReminderListProps {
  groups: ReminderGroupT[];
  imminentUuid: string | null;
  now: Date;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
  emptyMessage?: string;
}

export function ReminderList({
  groups,
  imminentUuid,
  now,
  onEdit,
  onDelete,
  emptyMessage,
}: ReminderListProps) {
  if (groups.length === 0) {
    return (
      <div className="rm-empty" role="status">
        <h5>No reminders to show</h5>
        <p>{emptyMessage ?? "Create one to get started."}</p>
      </div>
    );
  }

  return (
    <div className="rm-list">
      <div className="rm-list-head" aria-hidden="true">
        <span>name</span>
        <span>schedule</span>
        <span>status</span>
        <span>next trigger</span>
        <span className="rm-list-head-actions">actions</span>
      </div>
      {groups.map(group => (
        <ReminderGroup
          key={group.key}
          group={group}
          imminentUuid={imminentUuid}
          now={now}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default ReminderList;
