import React from "react";
import { createRoot } from "react-dom/client";
import MusicDashboardPage from "../react/music/MusicDashboardPage";
import type {
  FeaturedAlbum,
  PlaylistItem,
  RecentPlayedSong,
  RecentAlbum,
  PaginatorInfo,
  MusicDashboardUrls,
  DashboardStats,
} from "../react/music/types";

// Get data from data attributes on #react-root
const container = document.getElementById("react-root");

if (container) {
  // Parse JSON data from data attributes
  const randomAlbum: FeaturedAlbum | null = JSON.parse(
    container.dataset.randomAlbum || "null"
  );
  const playlists: PlaylistItem[] = JSON.parse(
    container.dataset.playlists || "[]"
  );
  const recentPlayedSongs: RecentPlayedSong[] = JSON.parse(
    container.dataset.recentPlayedSongs || "[]"
  );
  const initialRecentAlbums: RecentAlbum[] = JSON.parse(
    container.dataset.initialRecentAlbums || "[]"
  );
  const initialPaginator: PaginatorInfo = JSON.parse(
    container.dataset.initialPaginator || "{}"
  );
  const collectionIsNotEmpty: boolean =
    container.dataset.collectionIsNotEmpty === "true";

  // Build URLs object from data attributes
  const urls: MusicDashboardUrls = {
    recentAlbums: container.dataset.recentAlbumsUrl || "",
    recentSongs: container.dataset.recentSongsUrl || "",
    createPlaylist: container.dataset.createPlaylistUrl || "",
    tagSearch: container.dataset.tagSearchUrl || "",
    createSong: container.dataset.createSongUrl || "",
    createAlbum: container.dataset.createAlbumUrl || "",
    albumList: container.dataset.albumListUrl || "",
  };

  const imagesUrl = container.dataset.imagesUrl || "";
  const dashboardStats: DashboardStats = JSON.parse(
    container.dataset.dashboardStats || "null"
  ) ?? {
    plays_this_week: 0,
    top_tag_7d: null,
    added_this_month: 0,
    longest_streak: 0,
    plays_today: 0,
  };

  // Validate required data
  if (collectionIsNotEmpty) {
    const root = createRoot(container);
    root.render(
      <MusicDashboardPage
        randomAlbum={randomAlbum}
        playlists={playlists}
        recentPlayedSongs={recentPlayedSongs}
        initialRecentAlbums={initialRecentAlbums}
        initialPaginator={initialPaginator}
        collectionIsNotEmpty={collectionIsNotEmpty}
        urls={urls}
        imagesUrl={imagesUrl}
        dashboardStats={dashboardStats}
      />
    );
  }
}
