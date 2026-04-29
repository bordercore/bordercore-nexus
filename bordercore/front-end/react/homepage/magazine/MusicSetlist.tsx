import React from "react";
import { fillUrlTemplate } from "./utils";
import type { Song } from "../types";

interface MusicSetlistProps {
  music: Song[];
  artistDetailUrlTemplate: string;
  limit?: number;
}

export function MusicSetlist({ music, artistDetailUrlTemplate, limit = 5 }: MusicSetlistProps) {
  const visible = music.slice(0, limit);

  if (visible.length === 0) {
    return <div className="mag-empty">No music played yet.</div>;
  }

  return (
    <div className="mag-setlist">
      {visible.map((song, index) => (
        <div key={`${song.artist.uuid}-${index}`} className="mag-setlist-row">
          <span className="mag-setlist-num">{String(index + 1).padStart(2, "0")}</span>
          <span className="mag-setlist-title">{song.title}</span>
          <span className="mag-setlist-artist">
            <a href={fillUrlTemplate(artistDetailUrlTemplate, song.artist.uuid)}>
              {song.artist.name}
            </a>
          </span>
        </div>
      ))}
    </div>
  );
}
