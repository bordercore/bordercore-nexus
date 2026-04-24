import React from "react";

interface Props {
  counts: number[];
}

// Relative scale: `max` always maps to lv-4 so the heatmap gives useful
// signal even for low-volume users. Thresholds are ratio-based, not absolute.
const level = (n: number, max: number): 0 | 1 | 2 | 3 | 4 => {
  if (n === 0) return 0;
  const ratio = n / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
};

export default function ActivityHeatmap({ counts }: Props) {
  const max = Math.max(1, ...counts);
  return (
    <div>
      <h3>activity · 28d</h3>
      <div className="drill-heatmap">
        {counts.map((n, i) => (
          <span key={i} className={`cell lv-${level(n, max)}`} title={`day ${i + 1} · ${n}q`} />
        ))}
      </div>
      <div className="drill-heatmap-legend">
        <span>less</span>
        {[0, 1, 2, 3, 4].map(l => (
          <span key={l} className={`cell lv-${l}`} />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}
