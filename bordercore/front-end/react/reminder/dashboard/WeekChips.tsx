import React from "react";

interface WeekChipsProps {
  days: number[];
}

const LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function WeekChips({ days }: WeekChipsProps) {
  const lit = new Set(days);
  return (
    <span className="rm-weekchips" aria-label="weekly schedule days">
      {LABELS.map((label, idx) => (
        <span
          key={idx}
          className={`rm-weekchip${lit.has(idx) ? " is-lit" : ""}`}
          aria-hidden="true"
        >
          {label}
        </span>
      ))}
    </span>
  );
}

export default WeekChips;
