import React from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilAlt, faInfo, faTimes } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import type {
  ArtistSong,
  ArtistDetail,
  ArtistDetailAlbum,
  ArtistDetailUrls,
  Playlist,
} from "./types";
import ArtistSongTable from "./ArtistSongTable";
import AlbumGrid from "./AlbumGrid";
import EditArtistImageModal from "./EditArtistImageModal";
import DropDownMenu from "../common/DropDownMenu";
import { EventBus } from "../utils/reactUtils";

interface ArtistDetailPageProps {
  artist: ArtistDetail;
  albums: ArtistDetailAlbum[];
  compilationAlbums: ArtistDetailAlbum[];
  songs: ArtistSong[];
  playlists: Playlist[];
  urls: ArtistDetailUrls;
  imagesUrl: string;
  staticUrl: string;
  defaultPlaylist: string;
  hasArtistImage: boolean;
}

export function ArtistDetailPage({
  artist,
  albums,
  compilationAlbums,
  songs: initialSongs,
  playlists,
  urls,
  imagesUrl,
  staticUrl,
  defaultPlaylist,
  hasArtistImage,
}: ArtistDetailPageProps) {
  const [songs, setSongs] = React.useState<ArtistSong[]>(initialSongs);
  const [currentSongUuid, setCurrentSongUuid] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [artistImageKey, setArtistImageKey] = React.useState(Date.now());
  const [editImageOpen, setEditImageOpen] = React.useState(false);
  const [imageOpen, setImageOpen] = React.useState(false);

  React.useEffect(() => {
    if (!imageOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImageOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [imageOpen]);

  const artistImageUrl = `${imagesUrl}artist_images/${artist.uuid}`;

  const handleCurrentSong = (songIndex: number) => {
    if (songIndex === -1) {
      setCurrentSongUuid(null);
    } else if (songs[songIndex]) {
      setCurrentSongUuid(songs[songIndex].uuid);
    }
  };

  const handleIsPlaying = (playing: boolean) => {
    setIsPlaying(playing);
  };

  React.useEffect(() => {
    const onPlay = (data: { uuid: string }) => {
      setIsPlaying(true);
      setCurrentSongUuid(data.uuid);
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentSongUuid(null);
    };

    EventBus.$on("audio-play", onPlay);
    EventBus.$on("audio-pause", onPause);
    EventBus.$on("audio-ended", onEnded);

    return () => {
      EventBus.$off("audio-play", onPlay);
      EventBus.$off("audio-pause", onPause);
      EventBus.$off("audio-ended", onEnded);
    };
  }, []);

  const handleSongClick = (song: ArtistSong) => {
    EventBus.$emit("play-track", {
      track: song,
      trackList: songs,
      songUrl: urls.songMedia,
      markListenedToUrl: urls.markListenedTo,
    });
    setCurrentSongUuid(song.uuid);
  };

  const handleRatingChange = (songUuid: string, newRating: number | null) => {
    setSongs(prevSongs =>
      prevSongs.map(song => (song.uuid === songUuid ? { ...song, rating: newRating } : song))
    );
  };

  const handlePlaylistToggle = (
    songUuid: string,
    playlistUuid: string,
    action: "added" | "removed"
  ) => {
    setSongs(prevSongs =>
      prevSongs.map(song => {
        if (song.uuid !== songUuid) return song;
        if (action === "added") {
          return { ...song, playlists: [...song.playlists, playlistUuid] };
        } else {
          return { ...song, playlists: song.playlists.filter(p => p !== playlistUuid) };
        }
      })
    );
  };

  const handleArtistInfo = () => {
    EventBus.$emit("chat", {
      content: `Tell me about the artist or band ${artist.name}`,
    });
  };

  const handleEditArtistImage = () => {
    setEditImageOpen(true);
  };

  const handleImageUpdated = () => {
    // Force image reload by updating the key
    setArtistImageKey(Date.now());
  };

  const uploadArtistImage = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("artist_uuid", artist.uuid);
      formData.append("image", file);

      await axios.post(urls.updateArtistImage, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      });

      handleImageUpdated();
    } catch (error) {
      console.error("Error uploading artist image:", error);
    }
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      uploadArtistImage(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const albumCount = albums.length;
  const compilationCount = compilationAlbums.length;
  const songCount = songs.length;

  const dropdownMenu = (
    <DropDownMenu
      dropdownSlot={
        <ul className="dropdown-menu-list">
          <li>
            <button className="dropdown-menu-item" onClick={handleArtistInfo}>
              <span className="dropdown-menu-icon">
                <FontAwesomeIcon icon={faInfo} />
              </span>
              <span className="dropdown-menu-text">Artist Info</span>
            </button>
          </li>
          <li>
            <button className="dropdown-menu-item" onClick={handleEditArtistImage}>
              <span className="dropdown-menu-icon">
                <FontAwesomeIcon icon={faPencilAlt} />
              </span>
              <span className="dropdown-menu-text">Edit Artist Image</span>
            </button>
          </li>
        </ul>
      }
    />
  );

  return (
    <div className="row g-0 h-full items-start">
      {/* Sidebar - Artist image and player */}
      <div className="sticky-top col-lg-3 flex flex-col pt-0">
        <div className="card-grid ms-6">
          <div className="card backdrop-filter hover-target me-0 mb-4">
            <div className="card-body flex flex-col items-center">
              {hasArtistImage && (
                <div
                  className={isDragOver ? "drag-over" : ""}
                  onDrop={handleImageDrop}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <img
                    src={`${artistImageUrl}?t=${artistImageKey}`}
                    className="max-w-full h-auto cursor-pointer"
                    alt={artist.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => setImageOpen(true)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setImageOpen(true);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="col-lg-9 h-full me-0">
        <div className="card-grid h-full ms-6">
          <div className="flex flex-col h-full me-2">
            <div className="flex items-baseline gap-4 mb-4">
              <h1 className="bc-page-title mb-0">{artist.name}</h1>
              {albumCount > 0 && (
                <span className="text-xl text-ink-3">
                  {albumCount} album{albumCount !== 1 ? "s" : ""}
                </span>
              )}
              <div className="ms-auto align-self-center">{dropdownMenu}</div>
            </div>

            {/* Albums grid */}
            {albumCount > 0 && (
              <AlbumGrid
                albums={albums}
                imagesUrl={imagesUrl}
                albumDetailUrlTemplate={urls.albumDetail}
              />
            )}

            {/* Compilation albums grid */}
            {compilationCount > 0 && (
              <AlbumGrid
                albums={compilationAlbums}
                imagesUrl={imagesUrl}
                albumDetailUrlTemplate={urls.albumDetail}
                title={`Songs from ${compilationCount} compilation album${compilationCount !== 1 ? "s" : ""}`}
              />
            )}

            {/* Songs list */}
            {songCount > 0 && (
              <div className="me-0 mb-4" id="album-song-list">
                <h4 className="font-bold mb-4">
                  {songCount} song{songCount !== 1 ? "s" : ""}
                </h4>
                <ArtistSongTable
                  songs={songs}
                  currentSongUuid={currentSongUuid}
                  isPlaying={isPlaying}
                  staticUrl={staticUrl}
                  setSongRatingUrl={urls.setSongRating}
                  editSongUrlTemplate={urls.editSong}
                  addToPlaylistUrl={urls.addToPlaylist}
                  playlists={playlists}
                  onSongClick={handleSongClick}
                  onRatingChange={handleRatingChange}
                  onPlaylistToggle={handlePlaylistToggle}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Artist Image Modal */}
      <EditArtistImageModal
        open={editImageOpen}
        onClose={() => setEditImageOpen(false)}
        artistUuid={artist.uuid}
        updateArtistImageUrl={urls.updateArtistImage}
        onImageUpdated={handleImageUpdated}
      />

      {/* Full-size Artist Image Modal */}
      {hasArtistImage &&
        imageOpen &&
        createPortal(
          <>
            <div
              className="refined-modal-scrim refined-modal-scrim--viewer"
              onClick={() => setImageOpen(false)}
            />
            <div
              className="refined-modal refined-modal--viewer"
              role="dialog"
              aria-label={`${artist.name} image`}
            >
              <button
                type="button"
                className="refined-modal-close"
                onClick={() => setImageOpen(false)}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <img src={`${artistImageUrl}?t=${artistImageKey}`} alt={artist.name} />
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export default ArtistDetailPage;
