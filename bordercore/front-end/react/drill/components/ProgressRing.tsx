import React from "react";

interface Props {
  pct: number;
  variant?: "purple" | "cyan";
  suffix?: string;
}

export default function ProgressRing({ pct, variant = "purple", suffix = "reviewed" }: Props) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const offset = C - (clampedPct / 100) * C;
  return (
    <div className="drill-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="track" cx="50" cy="50" r={R} fill="none" strokeWidth="8" />
        <circle
          className={`fill ${variant === "cyan" ? "cyan" : ""}`}
          cx="50"
          cy="50"
          r={R}
          fill="none"
          strokeWidth="8"
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="label">
        <span className="pct">
          {pct}
          <span className="sign">%</span>
        </span>
        <span className="suffix">{suffix}</span>
      </div>
    </div>
  );
}
