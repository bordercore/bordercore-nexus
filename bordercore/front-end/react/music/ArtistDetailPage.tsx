import React from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilAlt, faInfo } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import type { ArtistSong, ArtistDetail, ArtistDetailAlbum, ArtistDetailUrls, Playlist } from "./types";
import ArtistSongTable from "./ArtistSongTable";
import AlbumGrid from "./AlbumGrid";
import AudioPlayer, { type AudioPlayerHandle } from "./AudioPlayer";
import EditArtistImageModal, { type EditArtistImageModalHandle } from "./EditArtistImageModal";
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
  csrfToken: string;
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
  csrfToken,
  defaultPlaylist,
  hasArtistImage,
}: ArtistDetailPageProps) {
  const [songs, setSongs] = React.useState<ArtistSong[]>(initialSongs);
  const [currentSongUuid, setCurrentSongUuid] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [artistImageKey, setArtistImageKey] = React.useState(Date.now());
  const [dropdownContainer, setDropdownContainer] = React.useState<HTMLElement | null>(null);

  const audioPlayerRef = React.useRef<AudioPlayerHandle>(null);
  const editImageRef = React.useRef<EditArtistImageModalHandle>(null);

  React.useEffect(() => {
    const container = document.getElementById("artist-detail-dropdown");
    setDropdownContainer(container);
  }, []);

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

  const handleSongClick = (song: ArtistSong) => {
    audioPlayerRef.current?.playTrack(song.uuid);
    setCurrentSongUuid(song.uuid);
  };

  const handleRatingChange = (songUuid: string, newRating: number | null) => {
    setSongs((prevSongs) =>
      prevSongs.map((song) =>
        song.uuid === songUuid ? { ...song, rating: newRating } : song
      )
    );
  };

  const handlePlaylistToggle = (songUuid: string, playlistUuid: string, action: "added" | "removed") => {
    setSongs((prevSongs) =>
      prevSongs.map((song) => {
        if (song.uuid !== songUuid) return song;
        if (action === "added") {
          return { ...song, playlists: [...song.playlists, playlistUuid] };
        } else {
          return { ...song, playlists: song.playlists.filter((p) => p !== playlistUuid) };
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
    editImageRef.current?.openModal();
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
          "X-CSRFToken": csrfToken,
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
      showOnHover={false}
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
    <div className="row g-0 h-100 align-items-start">
      {/* Sidebar - Artist image and player */}
      <div className="sticky-top col-lg-3 d-flex flex-column pt-0">
        <div className="card-grid ms-4">
          <div className="card backdrop-filter hover-target me-0 mb-3">
            <div className="card-body d-flex flex-column align-items-center">
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
                    className="mw-100"
                    alt={artist.name}
                    data-bs-toggle="modal"
                    data-bs-target="#artistImageModal"
                    style={{ cursor: "pointer" }}
                  />
                </div>
              )}

              {songs.length > 0 && (
                <AudioPlayer
                  ref={audioPlayerRef}
                  trackList={songs}
                  songUrl={urls.songMedia}
                  markListenedToUrl={urls.markListenedTo}
                  csrfToken={csrfToken}
                  onCurrentSong={handleCurrentSong}
                  onIsPlaying={handleIsPlaying}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="col-lg-9 h-100 me-0">
        <div className="card-grid h-100 ms-4">
          <div className="d-flex flex-column h-100 me-2">
            {/* Albums grid */}
            {albumCount > 0 && (
              <AlbumGrid
                albums={albums}
                imagesUrl={imagesUrl}
                albumDetailUrlTemplate={urls.albumDetail}
                title={`${albumCount} album${albumCount !== 1 ? "s" : ""}`}
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
              <div className="card backdrop-filter hover-target me-0 mb-3" id="album-song-list">
                <div className="card-body">
                  <h4 className="fw-bold">
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
                    csrfToken={csrfToken}
                    playlists={playlists}
                    onSongClick={handleSongClick}
                    onRatingChange={handleRatingChange}
                    onPlaylistToggle={handlePlaylistToggle}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Artist Image Modal */}
      <EditArtistImageModal
        ref={editImageRef}
        artistUuid={artist.uuid}
        updateArtistImageUrl={urls.updateArtistImage}
        csrfToken={csrfToken}
        onImageUpdated={handleImageUpdated}
      />

      {/* Full-size Artist Image Modal */}
      {hasArtistImage && (
        <div className="modal fade" id="artistImageModal" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-dialog-centered w-75 mw-100" role="document">
            <div className="modal-content">
              <div className="modal-body">
                <img
                  src={`${artistImageUrl}?t=${artistImageKey}`}
                  className="w-100"
                  alt={artist.name}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {dropdownContainer && createPortal(dropdownMenu, dropdownContainer)}
    </div>
  );
}

export default ArtistDetailPage;
