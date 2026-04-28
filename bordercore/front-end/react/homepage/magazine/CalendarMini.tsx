import React, { useEffect, useState } from "react";
import { doGet } from "../../utils/reactUtils";
import { splitStartPretty } from "./utils";
import type { CalendarEvent } from "../types";

interface CalendarMiniProps {
  getCalendarEventsUrl: string;
  limit?: number;
}

export function CalendarMini({ getCalendarEventsUrl, limit = 4 }: CalendarMiniProps) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    doGet(
      getCalendarEventsUrl,
      response => setEvents(response.data),
      "Error getting calendar events"
    );
  }, [getCalendarEventsUrl]);

  if (errorMessage) {
    return <div className="mag-cal-state">{errorMessage}</div>;
  }

  if (events === null) {
    return <div className="mag-cal-state">retrieving…</div>;
  }

  if (events.length === 0) {
    return <div className="mag-cal-state">calendar is empty</div>;
  }

  return (
    <div className="mag-cal">
      {events.slice(0, limit).map(event => {
        const { weekday, time } = splitStartPretty(event.start_pretty);
        return (
          <div key={event.count} className="mag-cal-row">
            <div className="mag-cal-weekday">{weekday}</div>
            <div className="mag-cal-time">{time}</div>
            <div className="mag-cal-title">{event.summary}</div>
          </div>
        );
      })}
    </div>
  );
}
