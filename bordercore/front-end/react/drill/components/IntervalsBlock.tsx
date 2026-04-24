import React from "react";

interface Props {
  intervals: number[];
}

export default function IntervalsBlock({ intervals }: Props) {
  if (!intervals.length) return null;
  const last = intervals[intervals.length - 1];
  return (
    <div>
      <h3>intervals</h3>
      <div className="drill-intervals">
        <span className="comment">// spaced-repetition</span>
        <div className="ladder">
          {intervals.map((d, i) => (
            <React.Fragment key={i}>
              <span className={d === last && i === intervals.length - 1 ? "accent" : ""}>{d}d</span>
              {i < intervals.length - 1 && <span className="arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
