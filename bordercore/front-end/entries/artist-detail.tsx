import React from "react";
import { createRoot } from "react-dom/client";
import ArtistDetailPage from "../react/music/ArtistDetailPage";
import type { ArtistDetail, ArtistDetailAlbum, ArtistSong, ArtistDetailUrls, Playlist } from "../react/music/types";

// Get data from data attributes on #react-root
const container = document.getElementById("react-root");

if (container) {
  // Parse JSON data from data attributes
  const artist: ArtistDetail = JSON.parse(container.dataset.artist || "{}");
  const albums: ArtistDetailAlbum[] = JSON.parse(container.dataset.albums || "[]");
  const compilationAlbums: ArtistDetailAlbum[] = JSON.parse(container.dataset.compilationAlbums || "[]");
  const songs: ArtistSong[] = JSON.parse(container.dataset.songs || "[]");
  const playlists: Playlist[] = JSON.parse(container.dataset.playlists || "[]");

  // Build URLs object from data attributes
  const urls: ArtistDetailUrls = {
    setSongRating: container.dataset.setSongRatingUrl || "",
    getPlaylists: container.dataset.getPlaylistsUrl || "",
    addToPlaylist: container.dataset.addToPlaylistUrl || "",
    markListenedTo: container.dataset.markListenedToUrlTemplate || "",
    updateArtistImage: container.dataset.updateArtistImageUrl || "",
    editSong: container.dataset.editSongUrlTemplate || "",
    albumDetail: container.dataset.albumDetailUrlTemplate || "",
    songMedia: container.dataset.songMediaUrl || "",
  };

  const imagesUrl = container.dataset.imagesUrl || "";
  const staticUrl = container.dataset.staticUrl || "";
  const csrfToken = container.dataset.csrfToken || "";
  const defaultPlaylist = container.dataset.defaultPlaylist || "";
  const hasArtistImage = container.dataset.hasArtistImage === "true";

  // Validate required data
  if (artist.uuid && urls.songMedia) {
    const root = createRoot(container);
    root.render(
      <ArtistDetailPage
        artist={artist}
        albums={albums}
        compilationAlbums={compilationAlbums}
        songs={songs}
        playlists={playlists}
        urls={urls}
        imagesUrl={imagesUrl}
        staticUrl={staticUrl}
        csrfToken={csrfToken}
        defaultPlaylist={defaultPlaylist}
        hasArtistImage={hasArtistImage}
      />
    );
  } else {
    console.error(
      "ArtistDetailPage: Missing required data. artist:",
      artist,
      "urls:",
      urls
    );
  }
}
