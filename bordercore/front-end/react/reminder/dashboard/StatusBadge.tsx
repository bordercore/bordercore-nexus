import React from "react";
import type { Reminder } from "../types";
import { isImminent } from "../grouping";

interface StatusBadgeProps {
  reminder: Reminder;
  now: Date;
}

export function StatusBadge({ reminder, now }: StatusBadgeProps) {
  if (!reminder.is_active) {
    return <span className="refined-badge is-muted">inactive</span>;
  }
  if (isImminent(reminder, now)) {
    return <span className="refined-badge is-warn is-pulse-urgent">imminent</span>;
  }
  return <span className="refined-badge is-cyan is-pulse">active</span>;
}

export default StatusBadge;
