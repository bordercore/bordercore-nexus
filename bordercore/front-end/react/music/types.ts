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
  playlists: string[];  // UUIDs of playlists containing this song
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
  playlists: string[];  // UUIDs of playlists containing this song
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
