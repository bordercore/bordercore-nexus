// TypeScript interfaces for Music Album Detail page

// Base track interface for audio player compatibility
export interface BaseTrack {
  uuid: string;
  title: string;
}

export interface Song extends BaseTrack {
  uuid: string;
  track: number | null;
  title: string;
  raw_title: string;
  note: string;
  rating: number | null;
  length_seconds: number | null;
  length: string;
  playlists: string[]; // UUIDs of playlists containing this song
}

export interface Album {
  uuid: string;
  title: string;
  artist_name: string;
  artist_uuid: string;
  year: number | null;
  original_release_year: number | null;
  playtime: string;
  cover_url: string;
  note: string;
  tags: string[];
  has_songs: boolean;
}

export interface Playlist {
  uuid: string;
  name: string;
}

export interface Artist {
  name: string;
  uuid: string;
}

export interface AlbumDetailUrls {
  setSongRating: string;
  getPlaylists: string;
  addToPlaylist: string;
  markListenedTo: string;
  updateAlbum: string;
  searchArtists: string;
  searchTags: string;
  editSong: string;
  songMedia: string;
  deleteAlbum: string;
  musicList: string;
  artistDetail: string;
}

export interface AlbumDetailProps {
  album: Album;
  songs: Song[];
  initialTags: string[];
  playlists: Playlist[];
  urls: AlbumDetailUrls;
  staticUrl: string;
  csrfToken: string;
  defaultPlaylist: string;
}

// Artist Detail Page Types

export interface ArtistSong extends BaseTrack {
  note: string;
  rating: number | null;
  length: string;
  year_effective: number | null;
  artist: string;
  playlists: string[]; // UUIDs of playlists containing this song
}

export interface ArtistDetailAlbum {
  uuid: string;
  title: string;
  year: number | null;
}

export interface ArtistDetail {
  uuid: string;
  name: string;
}

export interface ArtistDetailUrls {
  setSongRating: string;
  getPlaylists: string;
  addToPlaylist: string;
  markListenedTo: string;
  updateArtistImage: string;
  editSong: string;
  albumDetail: string;
  songMedia: string;
}

export interface ArtistDetailProps {
  artist: ArtistDetail;
  albums: ArtistDetailAlbum[];
  compilationAlbums: ArtistDetailAlbum[];
  songs: ArtistSong[];
  playlists: Playlist[];
  urls: ArtistDetailUrls;
  imagesUrl: string;
  staticUrl: string;
  csrfToken: string;
  defaultPlaylist: string;
  hasArtistImage: boolean;
}

// Music Dashboard Page Types

export interface RecentAlbum {
  uuid: string;
  title: string;
  artist_uuid: string;
  artist_name: string;
  created: string;
  album_url: string;
  artwork_url: string;
  artist_url: string;
}

export interface FeaturedAlbum {
  uuid: string;
  title: string;
  artist_name: string;
  artist_uuid: string;
  album_url: string;
  artist_url: string;
  artwork_url: string;
}

export interface PlaylistItem {
  uuid: string;
  name: string;
  num_songs: number;
  url: string;
}

export interface RecentPlayedSong {
  uuid: string;
  title: string;
  artist_name: string;
  artist_url: string;
}

export interface RecentAddedSong {
  uuid: string;
  title: string;
  artist: string;
  year: number | null;
  length: string;
  note?: string;
  artist_url: string;
}

export interface PaginatorInfo {
  page_number: number;
  has_next: boolean;
  has_previous: boolean;
  next_page_number: number | null;
  previous_page_number: number | null;
  count: number;
}

export interface MusicDashboardUrls {
  recentAlbums: string;
  recentSongs: string;
  createPlaylist: string;
  tagSearch: string;
  createSong: string;
  createAlbum: string;
  albumList: string;
}

export interface MusicDashboardProps {
  randomAlbum: FeaturedAlbum | null;
  playlists: PlaylistItem[];
  recentPlayedSongs: RecentPlayedSong[];
  initialRecentAlbums: RecentAlbum[];
  initialPaginator: PaginatorInfo;
  collectionIsNotEmpty: boolean;
  urls: MusicDashboardUrls;
  imagesUrl: string;
  csrfToken: string;
}

// Playlist Detail Page Types

export interface PlaylistSong extends BaseTrack {
  uuid: string;
  title: string;
  artist: string;
  year: number | null;
  length: string;
  sort_order: number;
  playlistitem_uuid: string;
}

export interface PlaylistParameters {
  tag?: string;
  start_year?: number;
  end_year?: number;
  rating?: number;
  exclude_recent?: number;
  exclude_albums?: boolean;
  sort_by?: string;
  size?: number;
}

export interface PlaylistDetail {
  uuid: string;
  name: string;
  note: string;
  type: "manual" | "smart";
  parameters: PlaylistParameters;
}

export interface PlaylistDetailUrls {
  getPlaylist: string;
  sortPlaylist: string;
  deletePlaylistItem: string;
  deletePlaylist: string;
  updatePlaylist: string;
  editSong: string;
  markListenedTo: string;
  songMedia: string;
  musicList: string;
  tagSearch: string;
}

export interface PlaylistDetailProps {
  playlist: PlaylistDetail;
  urls: PlaylistDetailUrls;
  staticUrl: string;
  csrfToken: string;
}

// Tag Search Page Types

export interface TagSearchSong extends BaseTrack {
  uuid: string;
  title: string;
  artist__name: string;
  year: number | null;
  length: string;
}

export interface TagSearchAlbum {
  uuid: string;
  title: string;
  artist_name: string;
  artist_uuid: string;
  year: number | null;
}

export interface TagSearchUrls {
  songMedia: string;
  markListenedTo: string;
  albumDetail: string;
  artistDetail: string;
  imagesUrl: string;
  musicList: string;
}

export interface TagSearchProps {
  tagName: string;
  songs: TagSearchSong[];
  albums: TagSearchAlbum[];
  urls: TagSearchUrls;
  staticUrl: string;
}

// Album List Page Types

export interface AlbumListArtist {
  uuid: string;
  name: string;
  album_count: number;
  song_count: number;
}

export interface AlbumListUrls {
  albumListBase: string;
  artistDetail: string;
}

export interface AlbumListProps {
  artists: AlbumListArtist[];
  nav: string[];
  selectedLetter: string;
  uniqueArtistLetters: string[];
  urls: AlbumListUrls;
  imagesUrl: string;
}
