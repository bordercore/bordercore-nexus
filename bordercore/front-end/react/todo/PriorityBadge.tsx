import React from "react";
import { getPriorityClass } from "./types";

interface PriorityBadgeProps {
  priority: number;
  label: string;
}

export function PriorityBadge({ priority, label }: PriorityBadgeProps) {
  return (
    <span className={`priority-badge ${getPriorityClass(priority)}`}>{label.toUpperCase()}</span>
  );
}

export default PriorityBadge;
