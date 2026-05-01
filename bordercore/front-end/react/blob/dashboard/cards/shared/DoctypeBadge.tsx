import React from "react";
import type { Doctype } from "../../types";

interface DoctypeBadgeProps {
  doctype: Doctype;
  label?: string;
}

export function DoctypeBadge({ doctype, label }: DoctypeBadgeProps) {
  return (
    <span className="rb-dt-badge">
      <span className={`rb-dt-dot rb-dt-${doctype}`} aria-hidden="true" />
      <span>{label ?? doctype}</span>
    </span>
  );
}

export default DoctypeBadge;
