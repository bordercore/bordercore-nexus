import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStickyNote,
  faPencilAlt,
  faPlus,
  faChevronRight,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import type { Song, Playlist } from "./types";
import StarRating from "./StarRating";
import DropDownMenu from "../common/DropDownMenu";
import { playStats } from "./playStats";

interface AlbumTrackListProps {
  songs: Song[];
  currentSongUuid: string | null;
  isPlaying: boolean;
  setSongRatingUrl: string;
  editSongUrlTemplate: string;
  addToPlaylistUrl: string;
  playlists: Playlist[];
  onSongClick: (song: Song) => void;
  onRatingChange: (songUuid: string, newRating: number | null) => void;
  onPlaylistToggle: (songUuid: string, playlistUuid: string, action: "added" | "removed") => void;
}

export function AlbumTrackList({
  songs,
  currentSongUuid,
  isPlaying,
  setSongRatingUrl,
  editSongUrlTemplate,
  addToPlaylistUrl,
  playlists,
  onSongClick,
  onRatingChange,
  onPlaylistToggle,
}: AlbumTrackListProps) {
  const getEditUrl = (songUuid: string) => {
    return (
      editSongUrlTemplate.replace(/00000000-0000-0000-0000-000000000000/, songUuid) +
      "?return_url=" +
      encodeURIComponent(window.location.pathname)
    );
  };

  const handlePlaylistToggle = async (songUuid: string, playlistUuid: string) => {
    try {
      const params = new URLSearchParams();
      params.append("playlist_uuid", playlistUuid);
      params.append("song_uuid", songUuid);

      const response = await axios.post(addToPlaylistUrl, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });
      const action = response.data.action as "added" | "removed";
      onPlaylistToggle(songUuid, playlistUuid, action);

      const playlist = playlists.find(p => p.uuid === playlistUuid);
      const playlistName = playlist?.name || "playlist";
      if (window.EventBus) {
        window.EventBus.$emit("toast", {
          body: action === "added" ? `Added to ${playlistName}` : `Removed from ${playlistName}`,
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Error toggling playlist:", error);
      if (window.EventBus) {
        window.EventBus.$emit("toast", {
          body: "Failed to update playlist",
          variant: "danger",
        });
      }
    }
  };

  if (songs.length === 0) {
    return <div className="adp-track-empty">no tracks on this album yet.</div>;
  }

  // Tracks read down the left column (1..ceil(n/2)) then down the right,
  // preserving album order when the columns stack on narrow screens.
  const splitIndex = Math.ceil(songs.length / 2);
  const columns = [songs.slice(0, splitIndex), songs.slice(splitIndex)];

  const renderRow = (song: Song, index: number) => {
    const isCurrent = currentSongUuid === song.uuid;
    return (
      <div
        key={song.uuid}
        className={`adp-track-row play-stats-anchor ${isCurrent ? "adp-track-row-current" : ""}`}
        onClick={() => onSongClick(song)}
      >
        <span className="play-stats-pop">{playStats(song)}</span>
        <span className="adp-track-num">
          {isCurrent ? (
            <span className={`adp-eq ${isPlaying ? "" : "adp-eq-paused"}`}>
              <span className="adp-eq-bar" />
              <span className="adp-eq-bar" />
              <span className="adp-eq-bar" />
            </span>
          ) : (
            String(song.track ?? index + 1).padStart(2, "0")
          )}
        </span>
        <span className="adp-track-title">{song.title}</span>
        {song.note && (
          <span className="adp-track-note" title={song.note}>
            <FontAwesomeIcon icon={faStickyNote} />
          </span>
        )}
        <div className="adp-track-rating" onClick={e => e.stopPropagation()}>
          <StarRating
            songUuid={song.uuid}
            rating={song.rating}
            setSongRatingUrl={setSongRatingUrl}
            onRatingChange={onRatingChange}
            compact
          />
        </div>
        <span className="adp-track-len">{song.length}</span>
        <div className="adp-track-menu" onClick={e => e.stopPropagation()}>
          <DropDownMenu
            dropdownSlot={
              <ul className="dropdown-menu-list">
                <li>
                  <a className="dropdown-menu-item" href={getEditUrl(song.uuid)}>
                    <span className="dropdown-menu-icon">
                      <FontAwesomeIcon icon={faPencilAlt} />
                    </span>
                    <span className="dropdown-menu-text">Edit</span>
                  </a>
                </li>
                <li>
                  <DropDownMenu
                    showTarget={false}
                    direction="dropend"
                    iconSlot={
                      <span className="dropdown-menu-item">
                        <span className="dropdown-menu-icon">
                          <FontAwesomeIcon icon={faPlus} />
                        </span>
                        <span className="dropdown-menu-text">Add to playlist</span>
                        <span className="dropdown-menu-arrow">
                          <FontAwesomeIcon icon={faChevronRight} />
                        </span>
                      </span>
                    }
                    dropdownSlot={
                      <ul className="dropdown-menu-list">
                        {playlists.map(playlist => (
                          <li key={playlist.uuid}>
                            <button
                              className="dropdown-menu-item"
                              onClick={() => handlePlaylistToggle(song.uuid, playlist.uuid)}
                            >
                              <span className="dropdown-menu-text">{playlist.name}</span>
                              {song.playlists.includes(playlist.uuid) && (
                                <span className="dropdown-menu-check">
                                  <FontAwesomeIcon icon={faCheck} className="text-ok" />
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    }
                  />
                </li>
              </ul>
            }
          />
        </div>
      </div>
    );
  };

  return (
    <div className="adp-tracklist">
      {columns.map((column, colIndex) => (
        <div key={colIndex} className="adp-tracklist-col">
          {column.map((song, i) => renderRow(song, colIndex * splitIndex + i))}
        </div>
      ))}
    </div>
  );
}

export default AlbumTrackList;
