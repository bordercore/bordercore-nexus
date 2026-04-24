import React from "react";
import { pluralize } from "../utils";

interface Props {
  nextDue: string | null;
  streak: number;
  reviewedToday: number;
  reviewedWeek: number;
}

export default function SessionMeta({ nextDue, streak, reviewedToday, reviewedWeek }: Props) {
  return (
    <div>
      <h3>session</h3>
      <div className="drill-sidebar-meta">
        {nextDue && (
          <div className="meta-row">
            <span className="k">next due</span>
            <span className="accent">{nextDue}</span>
          </div>
        )}
        <div className="meta-row">
          <span className="k">streak</span>
          <span className="ok">
            {streak} {pluralize("day", streak)} ✓
          </span>
        </div>
        <div className="meta-row">
          <span className="k">today</span>
          <span className="v">{reviewedToday}q reviewed</span>
        </div>
        <div className="meta-row">
          <span className="k">7d</span>
          <span className="v">{reviewedWeek}q reviewed</span>
        </div>
      </div>
    </div>
  );
}
