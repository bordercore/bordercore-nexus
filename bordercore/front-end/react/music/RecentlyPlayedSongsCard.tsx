import React from "react";
import Card from "../common/Card";
import type { RecentPlayedSong } from "./types";

interface RecentlyPlayedSongsCardProps {
  songs: RecentPlayedSong[];
  className?: string;
}

export function RecentlyPlayedSongsCard({ songs, className }: RecentlyPlayedSongsCardProps) {
  if (songs.length === 0) {
    return null;
  }

  return (
    <Card title="Recently Played Songs" className={className}>
      <hr className="divider" />
      <ul className="list-group interior-borders">
        {songs.map((song) => (
          <li key={song.uuid} className="list-group-item list-group-item-secondary">
            <span className="item-name">{song.title}</span>
            <a className="item-value ms-2" href={song.artist_url}>
              {song.artist_name}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default RecentlyPlayedSongsCard;
