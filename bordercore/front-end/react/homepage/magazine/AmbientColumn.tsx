import React from "react";
import { MagSection } from "./MagSection";
import { CalendarMini } from "./CalendarMini";
import { MusicSetlist } from "./MusicSetlist";
import type { Song } from "../types";

interface AmbientColumnProps {
  music: Song[];
  artistDetailUrlTemplate: string;
  getCalendarEventsUrl: string;
}

export function AmbientColumn({
  music,
  artistDetailUrlTemplate,
  getCalendarEventsUrl,
}: AmbientColumnProps) {
  return (
    <div className="mag-column">
      <MagSection accent="purple" kicker="on the calendar">
        <CalendarMini getCalendarEventsUrl={getCalendarEventsUrl} />
      </MagSection>

      <MagSection accent="purple" kicker="now spinning">
        <MusicSetlist music={music} artistDetailUrlTemplate={artistDetailUrlTemplate} />
      </MagSection>
    </div>
  );
}
