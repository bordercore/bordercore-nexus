import React from "react";

interface PriorityBadgeProps {
  priority: number;
  label: string;
}

function priorityColor(priority: number): string {
  switch (priority) {
    case 1:
      return "is-danger";
    case 2:
      return "is-warn";
    default:
      return "is-accent";
  }
}

export function PriorityBadge({ priority, label }: PriorityBadgeProps) {
  return <span className={`refined-badge ${priorityColor(priority)}`}>{label.toUpperCase()}</span>;
}

export default PriorityBadge;
