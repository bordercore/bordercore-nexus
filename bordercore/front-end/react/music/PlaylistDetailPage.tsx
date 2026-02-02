import React, { useState, useRef, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilAlt, faTimes } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import type { PlaylistDetail, PlaylistSong, PlaylistDetailUrls } from "./types";
import PlaylistSongTable from "./PlaylistSongTable";
import EditPlaylistModal, { type EditPlaylistModalHandle } from "./EditPlaylistModal";
import DropDownMenu from "../common/DropDownMenu";
import { EventBus } from "../utils/reactUtils";

interface PlaylistDetailPageProps {
  playlist: PlaylistDetail;
  urls: PlaylistDetailUrls;
  staticUrl: string;
  csrfToken: string;
}

// Helper to pluralize "song"
function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

export function PlaylistDetailPage({
  playlist,
  urls,
  staticUrl,
  csrfToken,
}: PlaylistDetailPageProps) {
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [totalTime, setTotalTime] = useState<string>("");
  const [currentSongUuid, setCurrentSongUuid] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const editPlaylistRef = useRef<EditPlaylistModalHandle>(null);

  // Fetch playlist songs
  const fetchPlaylist = useCallback(async () => {
    try {
      const response = await axios.get(urls.getPlaylist);
      setSongs(response.data.playlistitems || []);
      setTotalTime(response.data.totalTime || "");
    } catch (error) {
      console.error("Error fetching playlist:", error);
    }
  }, [urls.getPlaylist]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  const handleCurrentSong = (songIndex: number) => {
    if (songIndex === -1) {
      setCurrentSongUuid(null);
    } else if (songs[songIndex]) {
      setCurrentSongUuid(songs[songIndex].uuid);
    }
  };

  const handleIsPlaying = (playing: boolean) => {
    setIsPlaying(playing);
  };

  useEffect(() => {
    const onPlay = (data: { uuid: string }) => {
      setIsPlaying(true);
      setCurrentSongUuid(data.uuid);
    };
    const onPause = () => {
      setIsPlaying(false);
    };

    EventBus.$on("audio-play", onPlay);
    EventBus.$on("audio-pause", onPause);

    return () => {
      EventBus.$off("audio-play", onPlay);
      EventBus.$off("audio-pause", onPause);
    };
  }, []);

  const handleSongClick = (song: PlaylistSong) => {
    EventBus.$emit("play-track", {
      track: song,
      trackList: songs,
      songUrl: urls.songMedia,
      markListenedToUrl: urls.markListenedTo,
      csrfToken: csrfToken,
    });
    setCurrentSongUuid(song.uuid);
  };

  const handleRemoveSong = async (playlistItemUuid: string) => {
    try {
      const deleteUrl = urls.deletePlaylistItem.replace(
        /00000000-0000-0000-0000-000000000000/,
        playlistItemUuid
      );
      await axios.delete(deleteUrl, {
        headers: {
          "X-CSRFToken": csrfToken,
        },
        withCredentials: true,
      });

      EventBus.$emit("toast", {
        body: "Song removed from playlist",
        variant: "success",
      });

      fetchPlaylist();
    } catch (error) {
      console.error("Error removing song from playlist:", error);
      EventBus.$emit("toast", {
        body: "Failed to remove song from playlist",
        variant: "danger",
      });
    }
  };

  const handleReorder = async (playlistItemUuid: string, newPosition: number) => {
    try {
      const formData = new URLSearchParams();
      formData.append("playlistitem_uuid", playlistItemUuid);
      formData.append("position", newPosition.toString());

      await axios.post(urls.sortPlaylist, formData, {
        headers: {
          "X-CSRFToken": csrfToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });

      fetchPlaylist();
    } catch (error) {
      console.error("Error reordering playlist:", error);
    }
  };

  const handleEditPlaylist = () => {
    editPlaylistRef.current?.openModal();
  };

  const handleDeletePlaylist = async () => {
    try {
      const formData = new URLSearchParams();
      formData.append("Go", "Confirm");

      await axios.post(urls.deletePlaylist, formData, {
        headers: {
          "X-CSRFToken": csrfToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });

      window.location.href = urls.musicList;
    } catch (error) {
      console.error("Error deleting playlist:", error);
    }
  };

  const songCount = songs.length;

  return (
    <div className="row g-0 h-100 align-items-start mx-2">
      {/* Left sidebar - Playlist info and audio player */}
      <div className="sticky-top col-lg-3 d-flex flex-column">
        <div className="card-grid ms-4 d-flex flex-column">
          <div className="card-body mb-0">
            Songs
            <ul>
              {playlist.parameters.tag && (
                <li>
                  with tag <strong className="text-primary">{playlist.parameters.tag}</strong>
                </li>
              )}
              {playlist.parameters.start_year && (
                <li>
                  from the years{" "}
                  <strong className="text-primary">{playlist.parameters.start_year}</strong> to{" "}
                  <strong className="text-primary">{playlist.parameters.end_year}</strong>
                </li>
              )}
              {playlist.type === "manual" && <li>Manually created playlist</li>}
              {playlist.parameters.rating && (
                <li>
                  with a <strong className="text-primary">{playlist.parameters.rating} star</strong>{" "}
                  rating
                </li>
              )}
              {playlist.parameters.exclude_recent && (
                <li>
                  not listened to within the past{" "}
                  <strong className="text-primary">{playlist.parameters.exclude_recent}</strong> day
                  {playlist.parameters.exclude_recent > 1 ? "s" : ""}
                </li>
              )}
              {playlist.parameters.exclude_albums && <li>not on an album</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="col-lg-9 h-100 me-0">
        <div className="card-grid h-100 ms-4">
          <div className="d-flex flex-column h-100 me-2">
            {/* Playlist header card */}
            <div className="card backdrop-filter hover-target me-0">
              <div className="card-body">
                <div className="d-flex">
                  <h2 className="text-secondary">{playlist.name}</h2>
                  <div className="ms-auto">
                    <DropDownMenu
                      showOnHover={false}
                      dropdownSlot={
                        <ul className="dropdown-menu-list">
                          <li>
                            <button className="dropdown-menu-item" onClick={handleEditPlaylist}>
                              <span className="dropdown-menu-icon">
                                <FontAwesomeIcon icon={faPencilAlt} />
                              </span>
                              <span className="dropdown-menu-text">Edit</span>
                            </button>
                          </li>
                          <li>
                            <button
                              className="dropdown-menu-item"
                              onClick={() => setShowDeleteModal(true)}
                            >
                              <span className="dropdown-menu-icon">
                                <FontAwesomeIcon icon={faTimes} />
                              </span>
                              <span className="dropdown-menu-text">Delete</span>
                            </button>
                          </li>
                        </ul>
                      }
                    />
                  </div>
                </div>

                {playlist.note && <h6>{playlist.note}</h6>}

                {songCount > 0 && (
                  <small className="text-primary ms-2">
                    <strong>{songCount}</strong> {pluralize("song", songCount)},{" "}
                    <strong>{totalTime}</strong>
                  </small>
                )}
              </div>
            </div>

            {/* Song table card */}
            <div className="card backdrop-filter flex-grow-1 me-0 mt-3 mb-3" id="album-song-list">
              <PlaylistSongTable
                songs={songs}
                currentSongUuid={currentSongUuid}
                isPlaying={isPlaying}
                isManualPlaylist={playlist.type === "manual"}
                staticUrl={staticUrl}
                editSongUrlTemplate={urls.editSong}
                onSongClick={handleSongClick}
                onRemoveSong={handleRemoveSong}
                onReorder={handleReorder}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="modal fade show d-block" tabIndex={-1} role="dialog">
          <div className="modal-backdrop fade show" />
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Delete Playlist</h4>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowDeleteModal(false)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <div>Are you sure you want to delete this playlist?</div>
                <div className="mt-3">
                  <button className="btn btn-primary" onClick={handleDeletePlaylist}>
                    Confirm
                  </button>
                  <a
                    href="#"
                    className="ms-3"
                    onClick={e => {
                      e.preventDefault();
                      setShowDeleteModal(false);
                    }}
                  >
                    Cancel
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit playlist modal */}
      <EditPlaylistModal
        ref={editPlaylistRef}
        playlist={playlist}
        updatePlaylistUrl={urls.updatePlaylist}
        tagSearchUrl={urls.tagSearch}
        csrfToken={csrfToken}
      />
    </div>
  );
}

export default PlaylistDetailPage;
