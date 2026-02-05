import React, { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faPencilAlt,
  faTrashAlt,
  faAngleUp,
  faAngleDown,
} from "@fortawesome/free-solid-svg-icons";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
}: PlaylistSongTableProps) {
  const [localSongs, setLocalSongs] = useState<PlaylistSong[]>(songs);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    setLocalSongs(songs);
  }, [songs]);

  // Sort songs for non-manual playlists
  const sortedSongs = useMemo(() => {
    if (isManualPlaylist || !sortField) {
      return localSongs;
    }

    return [...localSongs].sort((a, b) => {
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
  }, [localSongs, sortField, sortDirection, isManualPlaylist]);

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

  // Helper to get header class for sortable columns
  const getHeaderClass = (field: SortField, baseClass: string = "") => {
    if (isManualPlaylist) return baseClass;
    return `${baseClass} cursor-pointer`.trim();
  };

  return (
    <div className="data-grid-container playlist-grid-container">
      <div className="data-grid playlist-grid" role="table">
        <div
          className={`data-grid-header playlist-grid-header ${isManualPlaylist ? "manual" : ""}`}
          role="row"
        >
          <div role="columnheader" className="playlist-col-drag"></div>
          {isManualPlaylist && (
            <div
              role="columnheader"
              className="playlist-col-number cursor-pointer"
              onClick={() => handleSort("sort_order" as SortField)}
            >
              #
            </div>
          )}
          <div
            role="columnheader"
            className={getHeaderClass("title", "playlist-col-title")}
            onClick={() => handleSort("title")}
          >
            Title{renderSortIcon("title")}
          </div>
          <div
            role="columnheader"
            className={getHeaderClass("artist", "playlist-col-artist")}
            onClick={() => handleSort("artist")}
          >
            Artist{renderSortIcon("artist")}
          </div>
          <div
            role="columnheader"
            className={getHeaderClass("year", "playlist-col-year")}
            onClick={() => handleSort("year")}
          >
            Year{renderSortIcon("year")}
          </div>
          <div
            role="columnheader"
            className={getHeaderClass("length", "playlist-col-length")}
            onClick={() => handleSort("length")}
          >
            Length{renderSortIcon("length")}
          </div>
          <div role="columnheader" className="playlist-col-actions"></div>
        </div>
        <div className="data-grid-body playlist-grid-body" role="rowgroup">
          {sortedSongs.length === 0 ? (
            <div role="row" className="data-grid-row playlist-grid-row no-songs">
              <div role="cell" className="text-center w-100 p-3">
                No songs in the playlist
              </div>
            </div>
          ) : (
            <SortableContext
              items={sortedSongs.map(song => song.playlistitem_uuid)}
              strategy={verticalListSortingStrategy}
            >
              {sortedSongs.map((song, index) => (
                <SortableSongRow
                  key={song.playlistitem_uuid}
                  song={song}
                  index={index}
                  isManualPlaylist={isManualPlaylist}
                  currentSongUuid={currentSongUuid}
                  equalizerImage={equalizerImage}
                  handleRowClick={handleRowClick}
                  onRemoveSong={onRemoveSong}
                  getEditUrl={getEditUrl}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlaylistSongTable;

interface SortableSongRowProps {
  song: PlaylistSong;
  index: number;
  isManualPlaylist: boolean;
  currentSongUuid: string | null;
  equalizerImage: string;
  handleRowClick: (song: PlaylistSong, columnField: string) => void;
  onRemoveSong: (playlistItemUuid: string) => void;
  getEditUrl: (songUuid: string) => string;
}

function SortableSongRow({
  song,
  isManualPlaylist,
  currentSongUuid,
  equalizerImage,
  handleRowClick,
  onRemoveSong,
  getEditUrl,
}: SortableSongRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: song.playlistitem_uuid,
    disabled: !isManualPlaylist,
  });
  const elRef = useRef<HTMLDivElement | null>(null);

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      elRef.current = el;
    },
    [setNodeRef]
  );

  useLayoutEffect(() => {
    const el = elRef.current;
    if (el) {
      el.style.setProperty(
        "--sortable-transform",
        transform ? CSS.Transform.toString(transform) : "none"
      );
      el.style.setProperty("--sortable-transition", transition ?? "none");
    }
  }, [transform, transition]);

  return (
    <div
      ref={refCallback}
      role="row"
      className={`data-grid-row playlist-grid-row sortable-row hover-target hover-reveal-target cursor-pointer sortable-song-row ${isDragging ? "dragging" : ""} ${isManualPlaylist ? "manual" : "no-drag"}`}
    >
      <div
        role="cell"
        className="playlist-col-drag drag-handle-cell"
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
      >
        <div className="hover-reveal-object">
          <FontAwesomeIcon icon={faBars} />
        </div>
      </div>
      {isManualPlaylist && (
        <div
          role="cell"
          className="playlist-col-number"
          onClick={() => handleRowClick(song, "sort_order")}
        >
          {currentSongUuid === song.uuid ? (
            <img id="isPlaying" src={equalizerImage} width={20} height={20} alt="Playing" />
          ) : (
            song.sort_order
          )}
        </div>
      )}
      <div role="cell" className="playlist-col-title" onClick={() => handleRowClick(song, "title")}>
        {!isManualPlaylist && currentSongUuid === song.uuid && (
          <span className="me-2">
            <img id="isPlaying" src={equalizerImage} width={20} height={20} alt="Playing" />
          </span>
        )}
        {song.title}
      </div>
      <div
        role="cell"
        className="playlist-col-artist cursor-grab"
        onClick={() => handleRowClick(song, "artist")}
      >
        {song.artist}
      </div>
      <div
        role="cell"
        className="playlist-col-year cursor-grab"
        onClick={() => handleRowClick(song, "year")}
      >
        {song.year}
      </div>
      <div
        role="cell"
        className="playlist-col-length cursor-grab"
        onClick={() => handleRowClick(song, "length")}
      >
        {song.length}
      </div>
      <div role="cell" className="playlist-col-actions" onClick={e => e.stopPropagation()}>
        <DropDownMenu
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
      </div>
    </div>
  );
}
