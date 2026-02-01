import React, { useEffect, useState } from "react";
import { Card } from "../common/Card";
import { doGet } from "../utils/reactUtils";
import type { CalendarEvent } from "./types";

interface CalendarCardProps {
  getCalendarEventsUrl: string;
}

export function CalendarCard({ getCalendarEventsUrl }: CalendarCardProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [message, setMessage] = useState("Retrieving...");
  const [waiting, setWaiting] = useState(true);
  const [errorClass, setErrorClass] = useState("");

  useEffect(() => {
    doGet(
      getCalendarEventsUrl,
      response => {
        const data = response.data;
        setEvents(data);

        if (data.length === 0) {
          setMessage("Your calendar is empty");
        } else {
          setWaiting(false);
          setMessage("");
        }
      },
      "Error getting calendar events"
    );
  }, [getCalendarEventsUrl]);

  return (
    <Card title="Calendar" className="backdrop-filter">
      <ul className="list-group interior-borders">
        {waiting && (
          <li className={`list-group-item list-group-item-secondary text-success ${errorClass}`}>
            {message}
          </li>
        )}
        {events.map(event => (
          <li key={event.count} className="list-group-item list-group-item-secondary">
            {event.start_pretty}:{" "}
            <strong className="item-value text-emphasis">{event.summary}</strong>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default CalendarCard;
