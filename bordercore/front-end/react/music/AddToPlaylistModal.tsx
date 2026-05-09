import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import type { Playlist } from "./types";
import { EventBus } from "../utils/reactUtils";

interface AddToPlaylistModalProps {
  open: boolean;
  onClose: () => void;
  songUuid: string;
  getPlaylistsUrl: string;
  addToPlaylistUrl: string;
  defaultPlaylist?: string;
  onAdd?: () => void;
}

interface PlaylistResponse {
  results: Array<{
    uuid: string;
    name: string;
    type: string;
  }>;
}

export function AddToPlaylistModal({
  open,
  onClose,
  songUuid,
  getPlaylistsUrl,
  addToPlaylistUrl,
  defaultPlaylist,
  onAdd,
}: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>(defaultPlaylist || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectRef = useRef<HTMLSelectElement>(null);

  // Fetch playlists on mount
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const response = await axios.get<PlaylistResponse>(getPlaylistsUrl);
        // Filter to only manual playlists
        const manualPlaylists = response.data.results
          .filter(p => p.type === "manual")
          .map(p => ({
            uuid: p.uuid,
            name: p.name,
          }));
        setPlaylists(manualPlaylists);

        // Set default playlist if provided and exists
        if (defaultPlaylist && manualPlaylists.some(p => p.uuid === defaultPlaylist)) {
          setSelectedPlaylist(defaultPlaylist);
        } else if (manualPlaylists.length > 0) {
          setSelectedPlaylist(manualPlaylists[0].uuid);
        }
      } catch (error) {
        console.error("Error fetching playlists:", error);
      }
    };

    fetchPlaylists();
  }, [getPlaylistsUrl, defaultPlaylist]);

  // Auto-focus the playlist select on open.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => selectRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape-to-close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const canSubmit = !!selectedPlaylist && !!songUuid && !isSubmitting;

  const submit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append("playlist_uuid", selectedPlaylist);
      params.append("song_uuid", songUuid);

      await axios.post(addToPlaylistUrl, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });

      EventBus.$emit("toast", {
        title: "Success",
        body: "Song added to playlist",
        variant: "success",
      });

      onAdd?.();
      onClose();
    } catch (error) {
      console.error("Error adding to playlist:", error);
      EventBus.$emit("toast", {
        title: "Error",
        body: "Failed to add song to playlist",
        variant: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, addToPlaylistUrl, selectedPlaylist, songUuid, onAdd, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label="add to playlist"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Add to playlist</h2>

        <div className="refined-field">
          <label htmlFor="add-to-playlist-select">playlist</label>
          <select
            ref={selectRef}
            id="add-to-playlist-select"
            value={selectedPlaylist}
            onChange={e => setSelectedPlaylist(e.target.value)}
          >
            {playlists.map(playlist => (
              <option key={playlist.uuid} value={playlist.uuid}>
                {playlist.name}
              </option>
            ))}
          </select>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
            {isSubmitting ? "adding…" : "add"}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default AddToPlaylistModal;
