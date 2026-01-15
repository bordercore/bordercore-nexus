// TypeScript interfaces for Music Album Detail page

export interface Song {
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
