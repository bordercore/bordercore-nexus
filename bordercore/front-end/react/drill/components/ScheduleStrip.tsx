import React from "react";
import type { ScheduleDay } from "../types";
import { pluralize } from "../utils";

interface Props {
  days: ScheduleDay[];
  overdueDays: number;
  weekLabel: string;
}

const stateLabel = (d: ScheduleDay) =>
  d.state === "empty"
    ? "—"
    : d.state === "today" || d.state === "over"
      ? `${d.due} due`
      : `${d.due} est`;

export default function ScheduleStrip({ days, overdueDays, weekLabel }: Props) {
  return (
    <section className="drill-card">
      <div className="head">
        <div className="title">
          <h2>Review Schedule</h2>
          {overdueDays > 0 && (
            <span className="count-chip hot">
              {overdueDays} {pluralize("day", overdueDays)} overdue
            </span>
          )}
        </div>
        <span className="week-meta">{weekLabel}</span>
      </div>
      <div className="drill-schedule">
        {days.map(d => (
          <div key={d.dow + d.date} className={`day ${d.state}`}>
            <div className="dow">{d.dow}</div>
            <div className="date">{d.date}</div>
            <div className="n">{stateLabel(d)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
