import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import type { PlaylistDetail, PlaylistParameters } from "./types";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";

interface EditPlaylistModalProps {
  playlist: PlaylistDetail;
  updatePlaylistUrl: string;
  tagSearchUrl: string;
  csrfToken: string;
  onPlaylistUpdated?: () => void;
}

export interface EditPlaylistModalHandle {
  openModal: () => void;
  closeModal: () => void;
}

const EXCLUDE_RECENT_OPTIONS = [
  { value: "", display: "No limit" },
  { value: 1, display: "Past Day" },
  { value: 2, display: "Past Two Days" },
  { value: 3, display: "Past Three Days" },
  { value: 7, display: "Past Week" },
  { value: 30, display: "Past Month" },
  { value: 90, display: "Past 3 Months" },
];

const SIZE_OPTIONS = [
  { value: "", display: "Unlimited" },
  { value: 5, display: "5" },
  { value: 10, display: "10" },
  { value: 20, display: "20" },
  { value: 50, display: "50" },
  { value: 100, display: "100" },
];

export const EditPlaylistModal = forwardRef<EditPlaylistModalHandle, EditPlaylistModalProps>(
  function EditPlaylistModal(
    { playlist, updatePlaylistUrl, tagSearchUrl, csrfToken, onPlaylistUpdated },
    ref
  ) {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState(playlist.name);
    const [note, setNote] = useState(playlist.note || "");
    const [rating, setRating] = useState<number | undefined>(playlist.parameters.rating);
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [startYear, setStartYear] = useState<string>(
      playlist.parameters.start_year?.toString() || ""
    );
    const [endYear, setEndYear] = useState<string>(
      playlist.parameters.end_year?.toString() || ""
    );
    const [excludeRecent, setExcludeRecent] = useState<string>(
      playlist.parameters.exclude_recent?.toString() || ""
    );
    const [excludeAlbums, setExcludeAlbums] = useState(
      playlist.parameters.exclude_albums || false
    );
    const [sortBy, setSortBy] = useState(playlist.parameters.sort_by || "recent");
    const [size, setSize] = useState<string>(playlist.parameters.size?.toString() || "20");
    const [refreshSongList, setRefreshSongList] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const tagsInputRef = useRef<TagsInputHandle>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const isSmartPlaylist = playlist.type === "smart";

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

    useImperativeHandle(ref, () => ({
      openModal: () => {
        setIsOpen(true);
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
      },
      closeModal: () => setIsOpen(false),
    }));

    // Handle escape key
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isOpen) {
          setIsOpen(false);
        }
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen]);

    // Handle click outside modal
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

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
            "X-CSRFToken": csrfToken,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          withCredentials: true,
        });

        setIsOpen(false);
        onPlaylistUpdated?.();
        // Reload page to reflect changes
        window.location.reload();
      } catch (error) {
        console.error("Error updating playlist:", error);
      } finally {
        setSubmitting(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-backdrop fade show" />
        <div className="modal-dialog" role="document" ref={modalRef}>
          <div className="modal-content">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h4 className="modal-title">Edit Playlist</h4>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                {/* Name */}
                <div className="row mb-3">
                  <label className="col-lg-4 col-form-label" htmlFor="id_name">
                    Name
                  </label>
                  <div className="col-lg-8">
                    <input
                      ref={nameInputRef}
                      id="id_name"
                      type="text"
                      name="name"
                      className="form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="off"
                      maxLength={200}
                      required
                    />
                  </div>
                </div>

                {/* Note */}
                <div className="row mb-3">
                  <label className="col-lg-4 col-form-label" htmlFor="id_note">
                    Note
                  </label>
                  <div className="col-lg-8">
                    <textarea
                      id="id_note"
                      name="note"
                      className="form-control"
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>

                {/* Smart playlist options */}
                {isSmartPlaylist && (
                  <>
                    <hr className="mb-1" />
                    <div className="form-section">Options</div>

                    {/* Tag */}
                    <div className="row mt-3">
                      <label className="col-lg-4 form-check-label">Tag</label>
                      <div className="col-lg-8">
                        <TagsInput
                          ref={tagsInputRef}
                          id="smart-list-tag"
                          name="tag"
                          searchUrl={`${tagSearchUrl}&query=`}
                          initialTags={playlist.parameters.tag ? [playlist.parameters.tag] : []}
                          placeholder="Tag name"
                          maxTags={1}
                        />
                      </div>
                    </div>

                    {/* Time Period */}
                    <div className="row mt-3">
                      <label className="col-lg-4 form-check-label text-nowrap">
                        Time Period
                      </label>
                      <div className="col-lg-8 d-flex">
                        <input
                          type="number"
                          name="start_year"
                          className="form-control me-1"
                          placeholder="Start Year"
                          value={startYear}
                          onChange={(e) => setStartYear(e.target.value)}
                          autoComplete="off"
                        />
                        <input
                          type="number"
                          name="end_year"
                          className="form-control ms-1"
                          placeholder="End Year"
                          value={endYear}
                          onChange={(e) => setEndYear(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="row mt-3">
                      <label className="col-lg-4 form-check-label">Rating</label>
                      <div className="col-lg-8">
                        <div
                          className="rating-container d-flex"
                          onMouseLeave={() => setHoverRating(null)}
                        >
                          {[0, 1, 2, 3, 4].map((starIndex) => (
                            <span
                              key={starIndex}
                              className={`rating me-1 ${displayRating > starIndex ? "rating-star-selected" : ""}`}
                              onClick={() => handleRatingClick(starIndex)}
                              onMouseOver={() => setHoverRating(starIndex + 1)}
                              className="cursor-pointer"
                            >
                              <FontAwesomeIcon icon={faStar} />
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Exclude Recent Listens */}
                    <div className="row mt-3">
                      <label className="col-lg-4 col-form-label">
                        Exclude Recent Listens
                      </label>
                      <div className="col-lg-8">
                        <select
                          className="form-control form-select"
                          name="exclude_recent"
                          value={excludeRecent}
                          onChange={(e) => setExcludeRecent(e.target.value)}
                        >
                          {EXCLUDE_RECENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.display}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Exclude Albums */}
                    <div className="row mt-3">
                      <label className="col-lg-4 col-form-label">Exclude Albums</label>
                      <div className="col-lg-8 d-flex align-items-center">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={excludeAlbums}
                            onChange={(e) => setExcludeAlbums(e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sort By */}
                    <div className="row mt-3">
                      <label className="col-lg-4 col-form-label">Sort By</label>
                      <div className="col-lg-8">
                        <select
                          className="form-control form-select"
                          name="sort_by"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                        >
                          <option value="recent">Recently Added</option>
                          <option value="random">Random</option>
                        </select>
                      </div>
                    </div>

                    {/* Size */}
                    <div className="row mt-3">
                      <label className="col-lg-4 col-form-label">Size</label>
                      <div className="col-lg-8">
                        <select
                          className="form-control form-select"
                          name="size"
                          value={size}
                          onChange={(e) => setSize(e.target.value)}
                        >
                          {SIZE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.display}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Refresh Song List */}
                    <div className="row mt-3">
                      <label className="col-lg-4 col-form-label">Refresh Song List</label>
                      <div className="col-lg-8 d-flex align-items-center">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={refreshSongList}
                            onChange={(e) => setRefreshSongList(e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer justify-content-end">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!isValid() || submitting}
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
);

export default EditPlaylistModal;
