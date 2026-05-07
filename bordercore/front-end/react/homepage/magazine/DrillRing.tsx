import React, { useMemo } from "react";

interface DrillRingProps {
  percent: number;
  size?: number;
  stroke?: number;
}

export function DrillRing({ percent, size = 170, stroke = 12 }: DrillRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const offset = useMemo(
    () => circumference - (safePercent / 100) * circumference,
    [circumference, safePercent]
  );

  const pctFontSize = Math.round(size * 0.28);
  const unitFontSize = Math.round(size * 0.14);

  return (
    <div
      className="mag-ring"
      style={{ width: size, height: size }} // must remain inline
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="magRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="50%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--accent-4)" />
          </linearGradient>
        </defs>
        <circle
          className="mag-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="mag-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="mag-ring-center">
        <div>
          <div
            className="mag-ring-pct"
            style={{ fontSize: pctFontSize }} // must remain inline
          >
            {safePercent}
            <span
              className="unit"
              style={{ fontSize: unitFontSize }} // must remain inline
            >
              %
            </span>
          </div>
          <div className="mag-ring-label">mastered</div>
        </div>
      </div>
    </div>
  );
}
