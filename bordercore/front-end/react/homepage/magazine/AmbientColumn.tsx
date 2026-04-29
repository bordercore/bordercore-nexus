import React from "react";
import { MagSection } from "./MagSection";
import { CalendarMini } from "./CalendarMini";
import { MusicSetlist } from "./MusicSetlist";
import { RemindersList } from "./RemindersList";
import type { Reminder, Song } from "../types";

interface AmbientColumnProps {
  music: Song[];
  artistDetailUrlTemplate: string;
  musicListUrl: string;
  getCalendarEventsUrl: string;
  reminders: Reminder[];
  reminderAppUrl: string;
}

export function AmbientColumn({
  music,
  artistDetailUrlTemplate,
  musicListUrl,
  getCalendarEventsUrl,
  reminders,
  reminderAppUrl,
}: AmbientColumnProps) {
  return (
    <div className="mag-column">
      <MagSection accent="purple" kicker="on the calendar">
        <CalendarMini getCalendarEventsUrl={getCalendarEventsUrl} />
      </MagSection>

      <MagSection accent="cyan" kicker={<a href={reminderAppUrl}>reminders</a>}>
        <RemindersList reminders={reminders} />
      </MagSection>

      <MagSection accent="purple" kicker={<a href={musicListUrl}>now spinning</a>}>
        <MusicSetlist music={music} artistDetailUrlTemplate={artistDetailUrlTemplate} />
      </MagSection>
    </div>
  );
}
