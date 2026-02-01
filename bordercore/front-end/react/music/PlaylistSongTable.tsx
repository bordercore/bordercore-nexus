import React, { useState, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilAlt, faTrashAlt, faAngleUp, faAngleDown } from "@fortawesome/free-solid-svg-icons";
import type { PlaylistSong } from "./types";
import DropDownMenu from "../common/DropDownMenu";

type SortField = "title" | "artist" | "year" | "length";
type SortDirection = "asc" | "desc";

interface PlaylistSongTableProps {
  songs: PlaylistSong[];
  currentSongUuid: string | null;
  isPlaying: boolean;
  isManualPlaylist: boolean;
  staticUrl: string;
  editSongUrlTemplate: string;
  onSongClick: (song: PlaylistSong) => void;
  onRemoveSong: (playlistItemUuid: string) => void;
  onReorder: (playlistItemUuid: string, newPosition: number) => void;
}

export function PlaylistSongTable({
  songs,
  currentSongUuid,
  isPlaying,
  isManualPlaylist,
  staticUrl,
  editSongUrlTemplate,
  onSongClick,
  onRemoveSong,
  onReorder,
}: PlaylistSongTableProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Sort songs for non-manual playlists
  const sortedSongs = useMemo(() => {
    if (isManualPlaylist || !sortField) {
      return songs;
    }

    return [...songs].sort((a, b) => {
      let aVal: string | number | null = a[sortField];
      let bVal: string | number | null = b[sortField];

      // Handle null values
      if (aVal === null) aVal = sortField === "year" ? 0 : "";
      if (bVal === null) bVal = sortField === "year" ? 0 : "";

      // Compare
      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [songs, sortField, sortDirection, isManualPlaylist]);

  const handleSort = (field: SortField) => {
    if (isManualPlaylist) return;

    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (isManualPlaylist || sortField !== field) return null;
    return (
      <FontAwesomeIcon
        icon={sortDirection === "asc" ? faAngleUp : faAngleDown}
        className="ms-1 sort-icon"
      />
    );
  };

  const handleRowClick = (song: PlaylistSong, columnField: string) => {
    // Don't play the song if we've clicked on the actions column
    if (columnField !== "actions") {
      onSongClick(song);
    }
  };

  const getEditUrl = (songUuid: string) => {
    return (
      editSongUrlTemplate.replace(/00000000-0000-0000-0000-000000000000/, songUuid) +
      "?return_url=" +
      encodeURIComponent(window.location.pathname)
    );
  };

  // Get the appropriate equalizer image based on playing state
  const equalizerImage = isPlaying
    ? `${staticUrl}img/equaliser-animated-green.gif`
    : `${staticUrl}img/equaliser-animated-green-frozen.gif`;

  // Drag and drop handlers for manual playlists
  const handleDragStart = useCallback((e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.currentTarget.classList.add("dragging");
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLTableRowElement>) => {
    e.currentTarget.classList.remove("dragging");
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
      e.preventDefault();
      if (draggingIndex !== null && draggingIndex !== dropIndex) {
        const song = songs[draggingIndex];
        // Position is 1-indexed
        onReorder(song.playlistitem_uuid, dropIndex + 1);
      }
      setDraggingIndex(null);
      setDragOverIndex(null);
    },
    [draggingIndex, songs, onReorder]
  );

  // Helper to get header class for sortable columns
  const getHeaderClass = (field: SortField, baseClass: string = "") => {
    if (isManualPlaylist) return baseClass;
    return `${baseClass} cursor-pointer`.trim();
  };

  return (
    <div className="table-responsive">
      <table className="table table-hover playlist-song-table">
        <thead>
          <tr>
            {isManualPlaylist && <th className="text-center table-col-number">#</th>}
            <th className={getHeaderClass("title")} onClick={() => handleSort("title")}>
              Title{renderSortIcon("title")}
            </th>
            <th className={getHeaderClass("artist")} onClick={() => handleSort("artist")}>
              Artist{renderSortIcon("artist")}
            </th>
            <th
              className={getHeaderClass("year", "text-center")}
              onClick={() => handleSort("year")}
            >
              Year{renderSortIcon("year")}
            </th>
            <th
              className={getHeaderClass("length", "text-center")}
              onClick={() => handleSort("length")}
            >
              Length{renderSortIcon("length")}
            </th>
            <th className="text-center table-col-action"></th>
          </tr>
        </thead>
        <tbody>
          {sortedSongs.length === 0 ? (
            <tr>
              <td colSpan={isManualPlaylist ? 6 : 5} className="text-center">
                No songs in the playlist
              </td>
            </tr>
          ) : (
            sortedSongs.map((song, index) => (
              <tr
                key={song.playlistitem_uuid}
                className={`song hover-target cursor-pointer ${dragOverIndex === index ? "drag-over" : ""}`}
                draggable={isManualPlaylist}
                onDragStart={isManualPlaylist ? e => handleDragStart(e, index) : undefined}
                onDragEnd={isManualPlaylist ? handleDragEnd : undefined}
                onDragOver={isManualPlaylist ? e => handleDragOver(e, index) : undefined}
                onDragLeave={isManualPlaylist ? handleDragLeave : undefined}
                onDrop={isManualPlaylist ? e => handleDrop(e, index) : undefined}
              >
                {isManualPlaylist && (
                  <td
                    className="text-center align-middle cursor-grab"
                    onClick={() => handleRowClick(song, "sort_order")}
                  >
                    {currentSongUuid === song.uuid ? (
                      <img
                        id="isPlaying"
                        src={equalizerImage}
                        width={20}
                        height={20}
                        alt="Playing"
                      />
                    ) : (
                      song.sort_order
                    )}
                  </td>
                )}
                <td className="align-middle" onClick={() => handleRowClick(song, "title")}>
                  {song.title}
                </td>
                <td
                  className="align-middle cursor-grab"
                  onClick={() => handleRowClick(song, "artist")}
                >
                  {song.artist}
                </td>
                <td
                  className="text-center align-middle cursor-grab"
                  onClick={() => handleRowClick(song, "year")}
                >
                  {song.year}
                </td>
                <td
                  className="text-center align-middle cursor-grab"
                  onClick={() => handleRowClick(song, "length")}
                >
                  {song.length}
                </td>
                <td
                  className="col-action text-center align-middle"
                  onClick={e => e.stopPropagation()}
                >
                  <DropDownMenu
                    showOnHover={true}
                    dropdownSlot={
                      <ul className="dropdown-menu-list">
                        <li>
                          <button
                            className="dropdown-menu-item"
                            onClick={() => onRemoveSong(song.playlistitem_uuid)}
                          >
                            <span className="dropdown-menu-icon">
                              <FontAwesomeIcon icon={faTrashAlt} />
                            </span>
                            <span className="dropdown-menu-text">Remove from playlist</span>
                          </button>
                        </li>
                        <li>
                          <a className="dropdown-menu-item" href={getEditUrl(song.uuid)}>
                            <span className="dropdown-menu-icon">
                              <FontAwesomeIcon icon={faPencilAlt} />
                            </span>
                            <span className="dropdown-menu-text">Edit</span>
                          </a>
                        </li>
                      </ul>
                    }
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default PlaylistSongTable;
