import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faPencilAlt, faTimes, faEllipsisV } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { PlaylistDetail, PlaylistSong, PlaylistDetailUrls } from "./types";
import PlaylistSongTable from "./PlaylistSongTable";
import EditPlaylistModal from "./EditPlaylistModal";
import DropDownMenu from "../common/DropDownMenu";
import { EventBus } from "../utils/reactUtils";

interface PlaylistDetailPageProps {
  playlist: PlaylistDetail;
  urls: PlaylistDetailUrls;
  staticUrl: string;
}

// Helper to pluralize "song"
function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

export function PlaylistDetailPage({ playlist, urls, staticUrl }: PlaylistDetailPageProps) {
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [totalTime, setTotalTime] = useState<string>("");
  const [currentSongUuid, setCurrentSongUuid] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the cancel button when the delete confirmation opens. Defaulting
  // focus to the non-destructive option avoids accidental Enter-key deletions.
  useEffect(() => {
    if (!showDeleteModal) return;
    const t = window.setTimeout(() => deleteCancelRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [showDeleteModal]);

  // Escape closes the delete confirmation modal.
  useEffect(() => {
    if (!showDeleteModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDeleteModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showDeleteModal]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeSong = useMemo(() => {
    return activeId ? songs.find(song => song.playlistitem_uuid === activeId) : null;
  }, [activeId, songs]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = songs.findIndex(item => item.playlistitem_uuid === active.id);
        const newIndex = songs.findIndex(item => item.playlistitem_uuid === over.id);

        const newList = arrayMove(songs, oldIndex, newIndex);
        setSongs(newList);

        const song = songs[oldIndex];
        handleReorder(song.playlistitem_uuid, newIndex + 1);
      }
    },
    [songs]
  );

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
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentSongUuid(null);
    };

    EventBus.$on("audio-play", onPlay);
    EventBus.$on("audio-pause", onPause);
    EventBus.$on("audio-ended", onEnded);

    return () => {
      EventBus.$off("audio-play", onPlay);
      EventBus.$off("audio-pause", onPause);
      EventBus.$off("audio-ended", onEnded);
    };
  }, []);

  const handleSongClick = (song: PlaylistSong) => {
    EventBus.$emit("play-track", {
      track: song,
      trackList: songs,
      songUrl: urls.songMedia,
      markListenedToUrl: urls.markListenedTo,
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
    setShowEditModal(true);
  };

  const handleDeletePlaylist = async () => {
    try {
      const formData = new URLSearchParams();
      formData.append("Go", "Confirm");

      await axios.post(urls.deletePlaylist, formData, {
        headers: {
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
                    with a{" "}
                    <strong className="text-primary">{playlist.parameters.rating} star</strong>{" "}
                    rating
                  </li>
                )}
                {playlist.parameters.exclude_recent && (
                  <li>
                    not listened to within the past{" "}
                    <strong className="text-primary">{playlist.parameters.exclude_recent}</strong>{" "}
                    day
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
                />
              </div>
            </div>
          </div>
        </div>

        {/* Edit playlist modal */}
        <EditPlaylistModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          playlist={playlist}
          updatePlaylistUrl={urls.updatePlaylist}
          tagSearchUrl={urls.tagSearch}
        />
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal &&
        createPortal(
          <>
            <div className="refined-modal-scrim" onClick={() => setShowDeleteModal(false)} />
            <div className="refined-modal" role="dialog" aria-label="delete playlist">
              <button
                type="button"
                className="refined-modal-close"
                onClick={() => setShowDeleteModal(false)}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <h2 className="refined-modal-title">Delete playlist</h2>

              <p className="refined-modal-lead">Are you sure you want to delete this playlist?</p>

              <div className="refined-modal-actions">
                <button
                  ref={deleteCancelRef}
                  type="button"
                  className="refined-btn ghost"
                  onClick={() => setShowDeleteModal(false)}
                >
                  cancel
                </button>
                <button type="button" className="refined-btn danger" onClick={handleDeletePlaylist}>
                  delete
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
      <DragOverlay>
        {activeSong ? (
          <div
            className={`data-grid-row playlist-grid-row data-table-drag-overlay ${playlist.type === "manual" ? "manual" : ""}`}
          >
            <div role="cell" className="playlist-col-drag drag-handle-cell">
              <div className="hover-reveal-object">
                <FontAwesomeIcon icon={faBars} />
              </div>
            </div>
            {playlist.type === "manual" && (
              <div role="cell" className="playlist-col-number">
                {activeSong.sort_order}
              </div>
            )}
            <div role="cell" className="playlist-col-title">
              {activeSong.title}
            </div>
            <div role="cell" className="playlist-col-artist">
              {activeSong.artist}
            </div>
            <div role="cell" className="playlist-col-year">
              {activeSong.year}
            </div>
            <div role="cell" className="playlist-col-length">
              {activeSong.length}
            </div>
            <div role="cell" className="playlist-col-actions">
              <div className="dropdown-wrapper">
                <div className="dropdown-trigger dropdownmenu">
                  <div className="d-flex align-items-center justify-content-center h-100 w-100">
                    <FontAwesomeIcon icon={faEllipsisV} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default PlaylistDetailPage;
