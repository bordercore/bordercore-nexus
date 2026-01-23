import React, { ReactNode, useMemo } from "react";

interface DrillTagProgressProps {
  count: number;
  progress: number;
  titleSlot?: ReactNode;
}

export function DrillTagProgress({ count = 0, progress = 0, titleSlot }: DrillTagProgressProps) {
  const circleRadius = 54;

  const strokeDashArray = useMemo(() => {
    return 2 * Math.PI * circleRadius;
  }, []);

  const dashOffset = useMemo(() => {
    return strokeDashArray * (1 - progress / 100);
  }, [strokeDashArray, progress]);

  const displayProgress = Math.round(progress);

  const pluralize = (word: string, count: number) => {
    return count === 1 ? word : `${word}s`;
  };

  return (
    <div className="me-0 text-center">
      {titleSlot}
      <div className="progress-circle">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle
            className="circle-full"
            cx="60"
            cy="60"
            r={circleRadius}
            fill="none"
            strokeWidth="12"
          />
          <circle
            className="circle-partial"
            cx="60"
            cy="60"
            r={circleRadius}
            fill="none"
            strokeWidth="12"
            strokeDasharray={strokeDashArray}
            strokeDashoffset={dashOffset}
          />
          <text x="50%" y="50%" textAnchor="middle" dy=".3em" fontSize="30px">
            {displayProgress}%
          </text>
        </svg>
      </div>
      <span className="text-primary mt-2">
        {count} {pluralize("question", count)}
      </span>
    </div>
  );
}

export default DrillTagProgress;
