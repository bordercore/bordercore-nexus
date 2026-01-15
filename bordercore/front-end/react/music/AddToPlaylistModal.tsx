import React from "react";
import axios from "axios";
import type { Playlist } from "./types";
import { EventBus } from "../utils/reactUtils";

// Bootstrap Modal type
declare const bootstrap: {
  Modal: new (element: string | Element) => {
    show: () => void;
    hide: () => void;
  };
};

interface AddToPlaylistModalProps {
  getPlaylistsUrl: string;
  addToPlaylistUrl: string;
  defaultPlaylist: string;
  csrfToken: string;
}

export interface AddToPlaylistModalHandle {
  openModal: (songUuid: string) => void;
}

interface PlaylistResponse {
  results: Array<{
    uuid: string;
    name: string;
    type: string;
  }>;
}

export const AddToPlaylistModal = React.forwardRef<
  AddToPlaylistModalHandle,
  AddToPlaylistModalProps
>(function AddToPlaylistModal(
  { getPlaylistsUrl, addToPlaylistUrl, defaultPlaylist, csrfToken },
  ref
) {
  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = React.useState(defaultPlaylist || "");
  const [songUuid, setSongUuid] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Fetch playlists on mount
  React.useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const response = await axios.get<PlaylistResponse>(getPlaylistsUrl);
        // Filter to only manual playlists
        const manualPlaylists = response.data.results
          .filter((p) => p.type === "manual")
          .map((p) => ({
            uuid: p.uuid,
            title: p.name,
            playlist_type: p.type,
          }));
        setPlaylists(manualPlaylists);

        // Set default playlist if provided and exists
        if (defaultPlaylist && manualPlaylists.some((p) => p.uuid === defaultPlaylist)) {
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

  const openModal = React.useCallback((songUuidParam: string) => {
    setSongUuid(songUuidParam);
    if (modalRef.current) {
      const modal = new bootstrap.Modal(modalRef.current);
      modal.show();
    }
  }, []);

  // Expose openModal to parent via ref
  React.useImperativeHandle(ref, () => ({
    openModal,
  }));

  const handleAdd = async () => {
    if (!selectedPlaylist || !songUuid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append("playlist_uuid", selectedPlaylist);
      params.append("song_uuid", songUuid);

      await axios.post(addToPlaylistUrl, params, {
        headers: {
          "X-CSRFToken": csrfToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      });

      // Hide modal on success
      if (modalRef.current) {
        const modalInstance = bootstrap.Modal.getInstance(modalRef.current);
        if (modalInstance) {
          modalInstance.hide();
        }
      }

      // Show success toast
      EventBus.$emit("toast", {
        title: "Success",
        body: "Song added to playlist",
        variant: "success",
      });
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
  };

  return (
    <div
      ref={modalRef}
      id="modalAddToPlaylist"
      className="modal fade"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="addToPlaylistModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h4 id="addToPlaylistModalLabel" className="modal-title">
              Add To Playlist
            </h4>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
          </div>
          <div className="modal-body">
            <div className="d-flex align-items-center">
              <div className="text-nowrap">Choose Playlist:</div>
              <select
                className="form-control ms-3"
                value={selectedPlaylist}
                onChange={(e) => setSelectedPlaylist(e.target.value)}
              >
                {playlists.map((playlist) => (
                  <option key={playlist.uuid} value={playlist.uuid}>
                    {playlist.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-footer justify-content-end">
            <button
              id="btn-action"
              className="btn btn-primary"
              type="button"
              onClick={handleAdd}
              disabled={isSubmitting || !selectedPlaylist}
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// Helper to get Modal instance (Bootstrap 5)
declare module bootstrap {
  class Modal {
    static getInstance(element: Element): Modal | null;
  }
}

export default AddToPlaylistModal;
