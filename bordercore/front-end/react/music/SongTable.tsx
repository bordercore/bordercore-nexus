import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faVolumeHigh } from "@fortawesome/free-solid-svg-icons";
import { EventBus } from "../utils/reactUtils";
import type { RecentAddedSong } from "./types";

interface Props {
  songs: RecentAddedSong[];
  currentUuid: string | null;
  songMediaUrl: string;
  markListenedUrl: string;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const SongTable: React.FC<Props> = ({ songs, currentUuid, songMediaUrl, markListenedUrl }) => {
  const handlePlay = (song: RecentAddedSong) => {
    EventBus.$emit("play-track", {
      track: { uuid: song.uuid, title: song.title },
      trackList: songs,
      songUrl: songMediaUrl,
      markListenedToUrl: markListenedUrl,
    });
  };

  return (
    <div className="mlo-song-table">
      <div className="mlo-song-row mlo-song-row-head">
        <span>#</span>
        <span>title</span>
        <span>artist</span>
        <span>year</span>
        <span>length</span>
      </div>
      {songs.map((song, idx) => {
        const isPlaying = currentUuid === song.uuid;
        return (
          <div
            role="button"
            tabIndex={0}
            key={song.uuid}
            onClick={() => handlePlay(song)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handlePlay(song);
              }
            }}
            className={`mlo-song-row${isPlaying ? " mlo-song-row-playing" : ""}`}
          >
            <span className="mlo-song-row-num">
              {isPlaying ? (
                <FontAwesomeIcon icon={faVolumeHigh} />
              ) : (
                <span className="mlo-song-row-num-text">{pad2(idx + 1)}</span>
              )}
              <FontAwesomeIcon icon={faPlay} className="mlo-song-row-play-icon" />
            </span>
            <span className="mlo-song-row-title">{song.title}</span>
            <span className="mlo-song-row-artist">{song.artist}</span>
            <span className="mlo-song-row-year">{song.year ?? ""}</span>
            <span className="mlo-song-row-length">{song.length}</span>
          </div>
        );
      })}
    </div>
  );
};

export default SongTable;
