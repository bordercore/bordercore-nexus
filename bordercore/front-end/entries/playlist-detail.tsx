import React from "react";
import { createRoot } from "react-dom/client";
import PlaylistDetailPage from "../react/music/PlaylistDetailPage";
import type { PlaylistDetail, PlaylistDetailUrls } from "../react/music/types";

// Get data from data attributes on #react-root
const container = document.getElementById("react-root");

if (container) {
  // Parse JSON data from data attributes
  const playlist: PlaylistDetail = JSON.parse(container.dataset.playlist || "{}");

  // Build URLs object from data attributes
  const urls: PlaylistDetailUrls = {
    getPlaylist: container.dataset.getPlaylistUrl || "",
    sortPlaylist: container.dataset.sortPlaylistUrl || "",
    deletePlaylistItem: container.dataset.deletePlaylistItemUrlTemplate || "",
    deletePlaylist: container.dataset.deletePlaylistUrl || "",
    updatePlaylist: container.dataset.updatePlaylistUrl || "",
    editSong: container.dataset.editSongUrlTemplate || "",
    markListenedTo: container.dataset.markListenedToUrlTemplate || "",
    songMedia: container.dataset.songMediaUrl || "",
    musicList: container.dataset.musicListUrl || "",
    tagSearch: container.dataset.tagSearchUrl || "",
  };

  const staticUrl = container.dataset.staticUrl || "";
  const csrfToken = container.dataset.csrfToken || "";

  // Validate required data
  if (playlist.uuid && urls.getPlaylist) {
    const root = createRoot(container);
    root.render(
      <PlaylistDetailPage
        playlist={playlist}
        urls={urls}
        staticUrl={staticUrl}
        csrfToken={csrfToken}
      />
    );
  } else {
    console.error(
      "PlaylistDetailPage: Missing required data. playlist:",
      playlist,
      "urls:",
      urls
    );
  }
}
