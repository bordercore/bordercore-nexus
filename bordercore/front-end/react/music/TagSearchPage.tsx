import React from "react";
import type { TagSearchSong, TagSearchAlbum, TagSearchUrls, ArtistDetailAlbum } from "./types";
import AudioPlayer, { type AudioPlayerHandle } from "./AudioPlayer";
import AlbumGrid from "./AlbumGrid";

interface TagSearchPageProps {
  tagName: string;
  songs: TagSearchSong[];
  albums: TagSearchAlbum[];
  urls: TagSearchUrls;
  staticUrl: string;
  csrfToken: string;
}

type SortField = "title" | "artist" | "year" | "length";
type SortDirection = "asc" | "desc";

export function TagSearchPage({
  tagName,
  songs: initialSongs,
  albums,
  urls,
  staticUrl,
  csrfToken,
}: TagSearchPageProps) {
  const [songs, setSongs] = React.useState<TagSearchSong[]>(initialSongs);
  const [currentSongUuid, setCurrentSongUuid] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [sortField, setSortField] = React.useState<SortField>("year");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

  const audioPlayerRef = React.useRef<AudioPlayerHandle>(null);

  const handleCurrentSong = (songIndex: number) => {
    if (songIndex === -1) {
      setCurrentSongUuid(null);
    } else if (sortedSongs[songIndex]) {
      setCurrentSongUuid(sortedSongs[songIndex].uuid);
    }
  };

  const handleIsPlaying = (playing: boolean) => {
    setIsPlaying(playing);
  };

  const handleSongClick = (song: TagSearchSong) => {
    audioPlayerRef.current?.playTrack(song.uuid);
    setCurrentSongUuid(song.uuid);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "year" ? "desc" : "asc");
    }
  };

  const sortedSongs = React.useMemo(() => {
    const sorted = [...songs];
    sorted.sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      switch (sortField) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "artist":
          aValue = a.artist__name.toLowerCase();
          bValue = b.artist__name.toLowerCase();
          break;
        case "year":
          aValue = a.year;
          bValue = b.year;
          break;
        case "length":
          aValue = a.length;
          bValue = b.length;
          break;
        default:
          return 0;
      }

      // Handle null values
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return sortDirection === "asc" ? 1 : -1;
      if (bValue === null) return sortDirection === "asc" ? -1 : 1;

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [songs, sortField, sortDirection]);

  const getArtistDetailUrl = (artistUuid: string) => {
    return urls.artistDetail.replace(/00000000-0000-0000-0000-000000000000/, artistUuid);
  };

  // Convert albums to the format expected by AlbumGrid
  const albumGridItems: ArtistDetailAlbum[] = albums.map(album => ({
    uuid: album.uuid,
    title: album.title,
    year: album.year,
  }));

  // Get the appropriate equalizer image based on playing state
  const equalizerImage = isPlaying
    ? `${staticUrl}img/equaliser-animated-green.gif`
    : `${staticUrl}img/equaliser-animated-green-frozen.gif`;

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const songCount = songs.length;
  const albumCount = albums.length;

  return (
    <div className="row g-0 h-100 align-items-start">
      {/* Sidebar - Player */}
      <div className="sticky-top col-lg-3 d-flex flex-column pt-0">
        <div className="card-grid ms-4">
          <div className="card backdrop-filter hover-target me-0 mb-3">
            <div className="card-body d-flex flex-column align-items-center">
              {songs.length > 0 && (
                <AudioPlayer
                  ref={audioPlayerRef}
                  trackList={sortedSongs}
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
                albums={albumGridItems}
                imagesUrl={urls.imagesUrl}
                albumDetailUrlTemplate={urls.albumDetail}
                title={`${albumCount} album${albumCount !== 1 ? "s" : ""}`}
              />
            )}

            {/* Songs list */}
            {songCount > 0 && (
              <div className="card backdrop-filter hover-target me-0 mb-3">
                <div className="card-body">
                  <h4 className="fw-bold">
                    {songCount} song{songCount !== 1 ? "s" : ""}
                  </h4>
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th className="cursor-pointer" onClick={() => handleSort("title")}>
                            Title{getSortIcon("title")}
                          </th>
                          <th className="cursor-pointer" onClick={() => handleSort("artist")}>
                            Artist{getSortIcon("artist")}
                          </th>
                          <th className="cursor-pointer" onClick={() => handleSort("year")}>
                            Year{getSortIcon("year")}
                          </th>
                          <th className="cursor-pointer" onClick={() => handleSort("length")}>
                            Length{getSortIcon("length")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSongs.map((song, index) => {
                          const isLastRow = index === sortedSongs.length - 1;
                          const cellClass = isLastRow ? "align-middle border-0" : "align-middle";
                          return (
                            <tr
                              key={song.uuid}
                              className="song hover-target cursor-pointer"
                              onClick={() => handleSongClick(song)}
                            >
                              <td className={cellClass}>
                                {currentSongUuid === song.uuid && (
                                  <span className="me-2">
                                    <img
                                      src={equalizerImage}
                                      width={20}
                                      height={20}
                                      alt="Playing"
                                    />
                                  </span>
                                )}
                                {song.title}
                              </td>
                              <td className={cellClass}>{song.artist__name}</td>
                              <td className={cellClass}>{song.year}</td>
                              <td className={cellClass}>{song.length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* No results message */}
            {songCount === 0 && albumCount === 0 && (
              <div className="card backdrop-filter hover-target me-0 mb-3">
                <div className="card-body">
                  <p className="mb-0">No songs or albums found with tag "{tagName}".</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TagSearchPage;
