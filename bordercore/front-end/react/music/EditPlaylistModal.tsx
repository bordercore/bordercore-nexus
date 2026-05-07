import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faTimes } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import type { PlaylistDetail } from "./types";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { ToggleSwitch } from "../common/ToggleSwitch";

interface EditPlaylistModalProps {
  open: boolean;
  onClose: () => void;
  playlist: PlaylistDetail;
  updatePlaylistUrl: string;
  tagSearchUrl: string;
  onPlaylistUpdated?: () => void;
}

const EXCLUDE_RECENT_OPTIONS = [
  { value: "", display: "No limit" },
  { value: "1", display: "Past Day" },
  { value: "2", display: "Past Two Days" },
  { value: "3", display: "Past Three Days" },
  { value: "7", display: "Past Week" },
  { value: "30", display: "Past Month" },
  { value: "90", display: "Past 3 Months" },
];

const SIZE_OPTIONS = [
  { value: "", display: "Unlimited" },
  { value: "5", display: "5" },
  { value: "10", display: "10" },
  { value: "20", display: "20" },
  { value: "50", display: "50" },
  { value: "100", display: "100" },
];

export function EditPlaylistModal({
  open,
  onClose,
  playlist,
  updatePlaylistUrl,
  tagSearchUrl,
  onPlaylistUpdated,
}: EditPlaylistModalProps) {
  const [name, setName] = useState(playlist.name);
  const [note, setNote] = useState(playlist.note || "");
  const [rating, setRating] = useState<number | undefined>(playlist.parameters.rating);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [startYear, setStartYear] = useState<string>(
    playlist.parameters.start_year?.toString() || ""
  );
  const [endYear, setEndYear] = useState<string>(playlist.parameters.end_year?.toString() || "");
  const [excludeRecent, setExcludeRecent] = useState<string>(
    playlist.parameters.exclude_recent?.toString() || ""
  );
  const [excludeAlbums, setExcludeAlbums] = useState(playlist.parameters.exclude_albums || false);
  const [sortBy, setSortBy] = useState(playlist.parameters.sort_by || "recent");
  const [size, setSize] = useState<string>(playlist.parameters.size?.toString() || "20");
  const [refreshSongList, setRefreshSongList] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tagsInputRef = useRef<TagsInputHandle>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isSmartPlaylist = playlist.type === "smart";

  // Reset state when the modal opens; mirror playlist values.
  useEffect(() => {
    if (!open) return;
    setName(playlist.name);
    setNote(playlist.note || "");
    setRating(playlist.parameters.rating);
    setHoverRating(null);
    setStartYear(playlist.parameters.start_year?.toString() || "");
    setEndYear(playlist.parameters.end_year?.toString() || "");
    setExcludeRecent(playlist.parameters.exclude_recent?.toString() || "");
    setExcludeAlbums(playlist.parameters.exclude_albums || false);
    setSortBy(playlist.parameters.sort_by || "recent");
    setSize(playlist.parameters.size?.toString() || "20");
    setRefreshSongList(false);
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, playlist]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Validation: start/end year must both be set or both empty, and end >= start
  const isValid = () => {
    if ((startYear && !endYear) || (!startYear && endYear)) {
      return false;
    }
    if (startYear && endYear && parseInt(endYear) < parseInt(startYear)) {
      return false;
    }
    return true;
  };

  const handleRatingClick = (starIndex: number) => {
    const clickedRating = starIndex + 1;
    if (clickedRating === rating) {
      setRating(undefined);
    } else {
      setRating(clickedRating);
    }
  };

  const displayRating = hoverRating ?? rating ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid()) return;

    setSubmitting(true);

    try {
      const formData = new URLSearchParams();
      formData.append("name", name);
      formData.append("note", note);
      formData.append("type", playlist.type);

      if (isSmartPlaylist) {
        const tag = tagsInputRef.current?.getTags()[0] || "";
        if (tag) formData.append("tag", tag);
        if (startYear) formData.append("start_year", startYear);
        if (endYear) formData.append("end_year", endYear);
        if (rating) formData.append("rating", rating.toString());
        if (excludeRecent) formData.append("exclude_recent", excludeRecent);
        formData.append("exclude_albums", excludeAlbums ? "true" : "false");
        formData.append("sort_by", sortBy);
        if (size) formData.append("size", size);
        formData.append("refresh_song_list", refreshSongList ? "true" : "false");
      }

      await axios.post(updatePlaylistUrl, formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });

      onClose();
      onPlaylistUpdated?.();
      // Reload page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error("Error updating playlist:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label="edit playlist"
        onSubmit={handleSubmit}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Edit playlist</h2>

        <div className="refined-field">
          <label htmlFor="playlist-edit-name">name</label>
          <input
            ref={nameInputRef}
            id="playlist-edit-name"
            type="text"
            name="name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="off"
            maxLength={200}
            required
          />
        </div>

        <div className="refined-field">
          <label htmlFor="playlist-edit-note">
            note <span className="optional">· optional</span>
          </label>
          <textarea
            id="playlist-edit-note"
            name="note"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
          />
        </div>

        {isSmartPlaylist && (
          <>
            <div className="refined-field">
              <label htmlFor="playlist-edit-tag">
                tag <span className="optional">· optional</span>
              </label>
              <TagsInput
                ref={tagsInputRef}
                id="playlist-edit-tag"
                name="tag"
                searchUrl={`${tagSearchUrl}&query=`}
                initialTags={playlist.parameters.tag ? [playlist.parameters.tag] : []}
                placeholder="Tag name"
                maxTags={1}
              />
            </div>

            <div className="refined-row-2">
              <div className="refined-field">
                <label htmlFor="playlist-edit-start-year">start year</label>
                <input
                  id="playlist-edit-start-year"
                  type="number"
                  name="start_year"
                  value={startYear}
                  onChange={e => setStartYear(e.target.value)}
                  placeholder="e.g. 1980"
                  autoComplete="off"
                />
              </div>
              <div className="refined-field">
                <label htmlFor="playlist-edit-end-year">end year</label>
                <input
                  id="playlist-edit-end-year"
                  type="number"
                  name="end_year"
                  value={endYear}
                  onChange={e => setEndYear(e.target.value)}
                  placeholder="e.g. 1989"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="refined-field">
              <label>rating</label>
              <div className="playlist-rating-row" onMouseLeave={() => setHoverRating(null)}>
                {[0, 1, 2, 3, 4].map(starIndex => (
                  <span
                    key={starIndex}
                    className={`rating ${displayRating > starIndex ? "rating-star-selected" : ""}`}
                    onClick={() => handleRatingClick(starIndex)}
                    onMouseOver={() => setHoverRating(starIndex + 1)}
                    role="button"
                    tabIndex={0}
                    aria-label={`set rating ${starIndex + 1}`}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRatingClick(starIndex);
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faStar} />
                  </span>
                ))}
              </div>
            </div>

            <div className="refined-row-2">
              <div className="refined-field">
                <label htmlFor="playlist-edit-exclude-recent">exclude recent</label>
                <select
                  id="playlist-edit-exclude-recent"
                  name="exclude_recent"
                  value={excludeRecent}
                  onChange={e => setExcludeRecent(e.target.value)}
                >
                  {EXCLUDE_RECENT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </div>
              <div className="refined-field">
                <label htmlFor="playlist-edit-sort-by">sort by</label>
                <select
                  id="playlist-edit-sort-by"
                  name="sort_by"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="recent">Recently Added</option>
                  <option value="random">Random</option>
                </select>
              </div>
            </div>

            <div className="refined-row-2">
              <div className="refined-field">
                <label htmlFor="playlist-edit-size">size</label>
                <select
                  id="playlist-edit-size"
                  name="size"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                >
                  {SIZE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </div>
              <div className="refined-field playlist-toggle-field">
                <label htmlFor="playlist-edit-exclude-albums">exclude albums</label>
                <ToggleSwitch
                  id="playlist-edit-exclude-albums"
                  name="exclude_albums"
                  checked={excludeAlbums}
                  onChange={setExcludeAlbums}
                />
              </div>
            </div>

            <div className="refined-field playlist-toggle-field">
              <label htmlFor="playlist-edit-refresh-song-list">refresh song list</label>
              <ToggleSwitch
                id="playlist-edit-refresh-song-list"
                name="refresh_song_list"
                checked={refreshSongList}
                onChange={setRefreshSongList}
              />
            </div>
          </>
        )}

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!isValid() || submitting}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default EditPlaylistModal;
