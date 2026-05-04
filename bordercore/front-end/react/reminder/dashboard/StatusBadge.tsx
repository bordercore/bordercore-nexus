import React from "react";
import type { Reminder } from "../types";
import { isImminent } from "../grouping";

interface StatusBadgeProps {
  reminder: Reminder;
  now: Date;
}

export function StatusBadge({ reminder, now }: StatusBadgeProps) {
  if (!reminder.is_active) {
    return (
      <span className="rm-status rm-status-inactive">
        <span className="rm-status-pip" />
        inactive
      </span>
    );
  }
  if (isImminent(reminder, now)) {
    return (
      <span className="rm-status rm-status-imminent">
        <span className="rm-status-pip" />
        imminent
      </span>
    );
  }
  return (
    <span className="rm-status rm-status-active">
      <span className="rm-status-pip" />
      active
    </span>
  );
}

export default StatusBadge;
