import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStickyNote, faPencilAlt, faPlus, faChevronRight, faCheck } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import MarkdownIt from "markdown-it";
import type { ArtistSong, Playlist } from "./types";
import StarRating from "./StarRating";
import DropDownMenu from "../common/DropDownMenu";

// markdown-it sanitizes HTML by default, providing XSS protection
// The note content is from the database and entered by authenticated users
const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

interface ArtistSongTableProps {
  songs: ArtistSong[];
  currentSongUuid: string | null;
  isPlaying: boolean;
  staticUrl: string;
  setSongRatingUrl: string;
  editSongUrlTemplate: string;
  addToPlaylistUrl: string;
  csrfToken: string;
  playlists: Playlist[];
  onSongClick: (song: ArtistSong) => void;
  onRatingChange: (songUuid: string, newRating: number | null) => void;
  onPlaylistToggle: (songUuid: string, playlistUuid: string, action: "added" | "removed") => void;
}

export function ArtistSongTable({
  songs,
  currentSongUuid,
  isPlaying,
  staticUrl,
  setSongRatingUrl,
  editSongUrlTemplate,
  addToPlaylistUrl,
  csrfToken,
  playlists,
  onSongClick,
  onRatingChange,
  onPlaylistToggle,
}: ArtistSongTableProps) {
  const handleRowClick = (song: ArtistSong, columnField: string) => {
    // Don't play the song if we've clicked on the actions, rating, or note columns
    if (columnField !== "actions" && columnField !== "rating" && columnField !== "note") {
      onSongClick(song);
    }
  };

  const getEditUrl = (songUuid: string) => {
    return editSongUrlTemplate.replace(/00000000-0000-0000-0000-000000000000/, songUuid) +
      "?return_url=" + encodeURIComponent(window.location.pathname);
  };

  const handlePlaylistToggle = async (songUuid: string, playlistUuid: string) => {
    try {
      const params = new URLSearchParams();
      params.append("playlist_uuid", playlistUuid);
      params.append("song_uuid", songUuid);

      const response = await axios.post(addToPlaylistUrl, params, {
        headers: {
          "X-CSRFToken": csrfToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });
      const action = response.data.action as "added" | "removed";
      onPlaylistToggle(songUuid, playlistUuid, action);

      // Show toast notification
      const playlist = playlists.find((p) => p.uuid === playlistUuid);
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

  const renderNote = (note: string) => {
    // markdown-it provides sanitization for the rendered HTML
    return { __html: markdown.render(note) };
  };

  // Get the appropriate equalizer image based on playing state
  const equalizerImage = isPlaying
    ? `${staticUrl}img/equaliser-animated-green.gif`
    : `${staticUrl}img/equaliser-animated-green-frozen.gif`;

  return (
    <div className="table-responsive">
      <table className="table table-hover">
        <thead>
          <tr>
            <th>Title</th>
            <th className="table-col-action"></th>
            <th>Year</th>
            <th className="text-end">Rating</th>
            <th>Length</th>
            <th className="text-center table-col-action"></th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song) => (
            <tr
              key={song.uuid}
              className="song hover-target cursor-pointer"
            >
              <td
                className="align-middle"
                onClick={() => handleRowClick(song, "title")}
              >
                {currentSongUuid === song.uuid && (
                  <span className="me-2">
                    <img
                      src={equalizerImage}
                      width={20}
                      height={20}
                      alt="Playing"
                    />
                  </span>
                )}
                {song.title}
              </td>
              <td
                className="align-middle"
                onClick={() => handleRowClick(song, "note")}
              >
                {song.note && (
                  <span
                    className="note-icon"
                    title={song.note}
                    data-bs-toggle="tooltip"
                    data-bs-html="true"
                  >
                    <div
                      className="note-tooltip-content d-none"
                      dangerouslySetInnerHTML={renderNote(song.note)}
                    />
                    <FontAwesomeIcon
                      icon={faStickyNote}
                      className="glow text-primary"
                    />
                  </span>
                )}
              </td>
              <td
                className="align-middle"
                onClick={() => handleRowClick(song, "year")}
              >
                {song.year_effective}
              </td>
              <td className="align-middle">
                <div className="d-flex justify-content-end" onClick={(e) => e.stopPropagation()}>
                  <StarRating
                    songUuid={song.uuid}
                    rating={song.rating}
                    setSongRatingUrl={setSongRatingUrl}
                    csrfToken={csrfToken}
                    onRatingChange={onRatingChange}
                  />
                </div>
              </td>
              <td
                className="align-middle"
                onClick={() => handleRowClick(song, "length")}
              >
                {song.length}
              </td>
              <td className="col-action text-center align-middle" onClick={(e) => e.stopPropagation()}>
                <DropDownMenu
                  showOnHover={false}
                  dropdownSlot={
                    <ul className="dropdown-menu-list">
                      <li>
                        <a
                          className="dropdown-menu-item"
                          href={getEditUrl(song.uuid)}
                        >
                          <span className="dropdown-menu-icon">
                            <FontAwesomeIcon icon={faPencilAlt} />
                          </span>
                          <span className="dropdown-menu-text">Edit</span>
                        </a>
                      </li>
                      <li>
                        <DropDownMenu
                          showOnHover={false}
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
                              {playlists.map((playlist) => (
                                <li key={playlist.uuid}>
                                  <button
                                    className="dropdown-menu-item"
                                    onClick={() => handlePlaylistToggle(song.uuid, playlist.uuid)}
                                  >
                                    <span className="dropdown-menu-text">{playlist.name}</span>
                                    {song.playlists.includes(playlist.uuid) && (
                                      <span className="dropdown-menu-check">
                                        <FontAwesomeIcon icon={faCheck} className="text-success" />
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ArtistSongTable;
