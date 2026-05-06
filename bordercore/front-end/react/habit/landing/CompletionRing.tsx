import React from "react";

interface CompletionRingProps {
  /** 0–1; clamped before rendering. */
  pct: number;
  /** Outer ring diameter in px. */
  size?: number;
  /** Stroke width in px. */
  stroke?: number;
}

/**
 * Cyan completion ring with optional center label rendered by the parent.
 * Pure SVG; visual treatment (glow, palette) lives in `_habit-dashboard.scss`.
 */
export function CompletionRing({ pct, size = 88, stroke = 8 }: CompletionRingProps) {
  const clamped = Math.max(0, Math.min(1, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);

  return (
    <svg
      className="hb-ring-svg"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--hb-card-border)"
        strokeWidth={stroke}
      />
      <circle
        className="hb-ring-progress"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--hb-cyan)"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
