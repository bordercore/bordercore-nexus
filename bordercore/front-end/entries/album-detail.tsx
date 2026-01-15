import React from "react";
import { createRoot } from "react-dom/client";
import AlbumDetailPage from "../react/music/AlbumDetailPage";
import type { Album, Song, AlbumDetailUrls, Playlist } from "../react/music/types";

// Get data from data attributes on #react-root
const container = document.getElementById("react-root");

if (container) {
  // Parse JSON data from data attributes
  const album: Album = JSON.parse(container.dataset.album || "{}");
  const songs: Song[] = JSON.parse(container.dataset.songs || "[]");
  const initialTags: string[] = JSON.parse(container.dataset.initialTags || "[]");
  const playlists: Playlist[] = JSON.parse(container.dataset.playlists || "[]");

  // Build URLs object from data attributes
  const urls: AlbumDetailUrls = {
    setSongRating: container.dataset.setSongRatingUrl || "",
    getPlaylists: container.dataset.getPlaylistsUrl || "",
    addToPlaylist: container.dataset.addToPlaylistUrl || "",
    markListenedTo: container.dataset.markListenedToUrlTemplate || "",
    updateAlbum: container.dataset.updateAlbumUrl || "",
    searchArtists: container.dataset.searchArtistsUrl || "",
    searchTags: container.dataset.searchTagsUrl || "",
    editSong: container.dataset.editSongUrlTemplate || "",
    songMedia: container.dataset.songMediaUrl || "",
    deleteAlbum: container.dataset.deleteAlbumUrl || "",
    musicList: container.dataset.musicListUrl || "",
    artistDetail: container.dataset.artistDetailUrl || "",
  };

  const staticUrl = container.dataset.staticUrl || "";
  const csrfToken = container.dataset.csrfToken || "";
  const defaultPlaylist = container.dataset.defaultPlaylist || "";

  // Validate required data
  if (album.uuid && urls.songMedia) {
    const root = createRoot(container);
    root.render(
      <AlbumDetailPage
        album={album}
        songs={songs}
        initialTags={initialTags}
        playlists={playlists}
        urls={urls}
        staticUrl={staticUrl}
        csrfToken={csrfToken}
        defaultPlaylist={defaultPlaylist}
      />
    );
  } else {
    console.error(
      "AlbumDetailPage: Missing required data. album:",
      album,
      "urls:",
      urls
    );
  }
}
