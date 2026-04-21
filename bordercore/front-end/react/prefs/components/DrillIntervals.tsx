import React, { useEffect, useState } from "react";

interface DrillIntervalsProps {
  value: number[];
  onChange: (value: number[]) => void;
}

function parseIntervals(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map(s => parseInt(s, 10))
    .filter(n => Number.isFinite(n) && n > 0);
}

export function DrillIntervals({ value, onChange }: DrillIntervalsProps) {
  const joined = value.join(",");
  const [text, setText] = useState(joined);

  useEffect(() => {
    setText(joined);
  }, [joined]);

  const nums = parseIntervals(text);
  const max = Math.max(...nums, 1);

  const commit = () => {
    onChange(nums);
  };

  return (
    <div className="prefs-drill">
      <div className="drill-head">
        <span>
          // spaced-repetition intervals <code>(days)</code>
        </span>
        <span>
          {nums.length} steps · up to <code>{max}d</code>
        </span>
      </div>
      <div className="drill-chart">
        {nums.map((n, i) => {
          const pct = Math.round((n / max) * 100);
          const h = Math.max(8, pct);
          const inside = pct >= 30;
          return (
            <div
              key={`${i}-${n}`}
              className={`drill-bar${inside ? "" : " short"}`}
              // must remain inline — bar height reflects the current interval
              style={{ height: `${h}%` }}
              title={`day ${n}`}
            >
              <span className="d-num">{n}</span>
              <span className="d-label">#{i + 1}</span>
            </div>
          );
        })}
      </div>
      <div className="drill-foot">
        <input
          className="prefs-input"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          aria-label="Drill intervals (comma-separated)"
        />
        <div className="seq">
          {nums.map((n, i) => (
            <React.Fragment key={i}>
              <span>{n}d</span>
              {i < nums.length - 1 && <span className="sep">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DrillIntervals;
