import React from "react";

export type RatingKey = "easy" | "good" | "hard" | "reset";

interface IntervalEntry {
  description: string;
  days: number;
  interval_index: number;
}

interface RatingBarProps {
  intervals: Record<string, IntervalEntry>;
  currentIntervalDays: number;
  currentIntervalIndex: number;
  revealed: boolean;
  onRate: (key: RatingKey) => void;
}

const RATINGS: Array<{
  key: RatingKey;
  name: string;
  kbd: string;
  sub: string;
}> = [
  { key: "easy", name: "easy", kbd: "1", sub: "knew it instantly" },
  { key: "good", name: "good", kbd: "2", sub: "got it normally" },
  { key: "hard", name: "hard", kbd: "3", sub: "barely got it" },
  { key: "reset", name: "reset", kbd: "4", sub: "blanked completely" },
];

function arrowPhrase(key: RatingKey, currentIdx: number, newIdx: number): string {
  if (key === "reset") return "back to day 1";
  if (key === "easy") return "skip 2 ahead";
  if (key === "good") return "next interval";
  // key === "hard"
  if (newIdx === 0 && currentIdx === 0) return "stay at day 1";
  return "step back 2";
}

export function RatingBar({
  intervals,
  currentIntervalDays,
  currentIntervalIndex,
  revealed,
  onRate,
}: RatingBarProps) {
  return (
    <div className="rating-bar">
      {RATINGS.map(r => {
        const i = intervals[r.key];
        const newDays = i?.days ?? 0;
        const newIdx = i?.interval_index ?? 0;
        return (
          <button
            key={r.key}
            type="button"
            className={`rate-btn ${r.key}${revealed ? "" : " is-locked"}`}
            disabled={!revealed}
            onClick={() => onRate(r.key)}
          >
            <div className="rate-head">
              <span className="rate-name">{r.name}</span>
              <span className="rate-kbd">{r.kbd}</span>
            </div>
            <span className="rate-sub">{r.sub}</span>
            <span className="rate-arrow">
              <span>{currentIntervalDays}d</span>
              {" → "}
              <span className="new">{newDays}d</span>
              <span className="rate-arrow-phrase">
                · {arrowPhrase(r.key, currentIntervalIndex, newIdx)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default RatingBar;
