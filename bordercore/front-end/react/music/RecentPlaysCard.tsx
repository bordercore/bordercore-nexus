import React from "react";
import type { RecentPlayedSong } from "./types";

interface Props {
  songs: RecentPlayedSong[];
}

const RecentPlaysCard: React.FC<Props> = ({ songs }) => {
  return (
    <section className="mlo-recent-plays">
      <div className="mlo-section-head">Recent Plays</div>
      <ul className="mlo-recent-plays-list">
        {songs.map((song, idx) => (
          <li key={song.uuid} className="mlo-recent-plays-row">
            <span className="mlo-recent-plays-idx">{(idx + 1).toString().padStart(2, "0")}</span>
            <div className="mlo-recent-plays-body">
              <div className="mlo-recent-plays-title">{song.title}</div>
              <a className="mlo-recent-plays-artist" href={song.artist_url}>
                {song.artist_name}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RecentPlaysCard;
