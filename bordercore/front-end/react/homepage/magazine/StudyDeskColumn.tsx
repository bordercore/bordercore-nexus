import React from "react";
import { DrillRing } from "./DrillRing";
import { CalendarMini } from "./CalendarMini";
import type { DrillProgress } from "../types";

interface StudyDeskColumnProps {
  drillProgress: DrillProgress;
  drillListUrl: string;
  getCalendarEventsUrl: string;
}

export function StudyDeskColumn({
  drillProgress,
  drillListUrl,
  getCalendarEventsUrl,
}: StudyDeskColumnProps) {
  return (
    <section className="mag-section">
      <div className="mag-ucase is-cyan">study desk</div>

      <div className="mag-study">
        <DrillRing percent={drillProgress.percentage} />
        <div>
          <div className="mag-study-summary">
            <a href={drillListUrl}>{drillProgress.count} questions tracked</a>
          </div>
          <p className="mag-study-detail">
            mastered across all tags · {Math.round(drillProgress.percentage)}% complete
          </p>
        </div>
      </div>

      <div className="mag-block">
        <div className="mag-ucase">on the calendar</div>
        <div className="mag-tasks-list">
          <CalendarMini getCalendarEventsUrl={getCalendarEventsUrl} />
        </div>
      </div>
    </section>
  );
}
