import React from "react";
import { createRoot } from "react-dom/client";
import MusicDashboardPage from "../react/music/MusicDashboardPage";
import GlobalAudioPlayer from "../react/music/GlobalAudioPlayer";
import type {
  FeaturedAlbum,
  PlaylistSidebarItem,
  RecentPlayedSong,
  RecentAlbum,
  PaginatorInfo,
  MusicDashboardUrls,
  DashboardStats,
  LibraryCounts,
} from "../react/music/types";

const container = document.getElementById("react-root");

if (container) {
  const randomAlbum: FeaturedAlbum | null = JSON.parse(container.dataset.randomAlbum || "null");
  const playlists: PlaylistSidebarItem[] = JSON.parse(container.dataset.playlists || "[]");
  const recentPlayedSongs: RecentPlayedSong[] = JSON.parse(container.dataset.recentPlayedSongs || "[]");
  const initialRecentAlbums: RecentAlbum[] = JSON.parse(container.dataset.initialRecentAlbums || "[]");
  const initialPaginator: PaginatorInfo = JSON.parse(container.dataset.initialPaginator || "{}");
  const collectionIsNotEmpty: boolean = container.dataset.collectionIsNotEmpty === "true";

  const dashboardStats: DashboardStats = JSON.parse(container.dataset.dashboardStats || "null") ?? {
    plays_this_week: 0,
    top_tag_7d: null,
    added_this_month: 0,
    longest_streak: 0,
    plays_today: 0,
  };

  const libraryCounts: LibraryCounts = JSON.parse(container.dataset.libraryCounts || "null") ?? {
    albums: 0,
    songs: 0,
    artists: 0,
    tags: 0,
  };

  const urls: MusicDashboardUrls = {
    recentAlbums: container.dataset.recentAlbumsUrl || "",
    recentSongs: container.dataset.recentSongsUrl || "",
    shuffleSongs: container.dataset.shuffleSongsUrl || "",
    search: container.dataset.searchUrl || "",
    createPlaylist: container.dataset.createPlaylistUrl || "",
    tagSearch: container.dataset.tagSearchUrl || "",
    createSong: container.dataset.createSongUrl || "",
    createAlbum: container.dataset.createAlbumUrl || "",
    artistList: container.dataset.artistListUrl || "",
    albumList: container.dataset.albumListUrl || "",
    setSongRating: container.dataset.setSongRatingUrl || "",
    songMedia: container.dataset.songMediaUrl || "",
    markListened: container.dataset.markListenedUrl || "",
    getPlaylist: container.dataset.getPlaylistUrl || "",
  };
  const imagesUrl = container.dataset.imagesUrl || "";

  if (collectionIsNotEmpty) {
    const root = createRoot(container);
    root.render(
      <>
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
          libraryCounts={libraryCounts}
        />
        <GlobalAudioPlayer />
      </>
    );
  }
}
