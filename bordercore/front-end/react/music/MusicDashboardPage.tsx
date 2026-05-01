import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { doGet, EventBus } from "../utils/reactUtils";
import LibrarySidebar from "./LibrarySidebar";
import StatStrip from "./StatStrip";
import PageHead from "./PageHead";
import AlbumGridCard from "./AlbumGridCard";
import SongTable from "./SongTable";
import FeaturedAlbumCard from "./FeaturedAlbumCard";
import RecentPlaysCard from "./RecentPlaysCard";
import CreatePlaylistModal from "./CreatePlaylistModal";
import SearchPalette from "./SearchPalette";
import SearchResultsView from "./SearchResultsView";
import type {
  MusicDashboardProps,
  PaginatorInfo,
  RecentAlbum,
  RecentAddedSong,
  PlaylistSidebarItem,
} from "./types";

const ALBUMS_PER_PAGE = 9;

interface PlaylistFetchResponse {
  data?: {
    totalTime?: string;
    playlistitems: Array<{
      uuid: string;
      title: string;
      artist: string;
      year: number | null;
      length: string;
    }>;
  };
}

export function MusicDashboardPage({
  randomAlbum,
  playlists,
  recentPlayedSongs,
  initialRecentAlbums,
  initialPaginator,
  urls,
  dashboardStats,
  libraryCounts,
}: MusicDashboardProps) {
  const [recentAlbums, setRecentAlbums] = React.useState<RecentAlbum[]>(initialRecentAlbums);
  const [paginator, setPaginator] = React.useState<PaginatorInfo>(initialPaginator);
  const [albumsLoading, setAlbumsLoading] = React.useState(false);
  const [songList, setSongList] = React.useState<RecentAddedSong[]>([]);
  const [search, setSearch] = React.useState("");
  const [activePlaylistId, setActivePlaylistId] = React.useState<string | null>(null);
  const [playlistSongs, setPlaylistSongs] = React.useState<RecentAddedSong[] | null>(null);
  const [playlistTotalTime, setPlaylistTotalTime] = React.useState<string | null>(null);
  const [currentUuid, setCurrentUuid] = React.useState<string | null>(null);

  const [createPlaylistOpen, setCreatePlaylistOpen] = React.useState(false);
  const [searchExpanded, setSearchExpanded] = React.useState(false);

  React.useEffect(() => {
    doGet(
      urls.recentSongs,
      (response: { data: { song_list: RecentAddedSong[] } }) => {
        setSongList(response.data.song_list);
      },
      "Error getting recent songs"
    );
  }, [urls.recentSongs]);

  React.useEffect(() => {
    const onPlay = (data: { uuid: string }) => setCurrentUuid(data.uuid);
    EventBus.$on("audio-play", onPlay);
    return () => EventBus.$off("audio-play", onPlay);
  }, []);

  const fetchPlaylistSongs = React.useCallback(
    (playlistUuid: string, then: (songs: RecentAddedSong[]) => void) => {
      const url = urls.getPlaylist.replace(/00000000-0000-0000-0000-000000000000/, playlistUuid);
      doGet(
        url,
        (response: PlaylistFetchResponse) => {
          const items = response.data?.playlistitems || [];
          setPlaylistTotalTime(response.data?.totalTime ?? null);
          const mapped: RecentAddedSong[] = items.map(it => ({
            uuid: it.uuid,
            title: it.title,
            artist: it.artist,
            year: it.year,
            length: it.length,
            artist_url: "",
            album_title: null,
            rating: null,
            plays: 0,
          }));
          then(mapped);
        },
        "Error fetching playlist"
      );
    },
    [urls.getPlaylist]
  );

  const handleSelectPlaylist = (uuid: string) => {
    setActivePlaylistId(uuid);
    fetchPlaylistSongs(uuid, songs => setPlaylistSongs(songs));
  };

  const handlePlayPlaylist = (uuid: string) => {
    setActivePlaylistId(uuid);
    fetchPlaylistSongs(uuid, songs => {
      setPlaylistSongs(songs);
      if (songs.length > 0) {
        const first = songs[0];
        EventBus.$emit("play-track", {
          track: { uuid: first.uuid, title: first.title },
          trackList: songs,
          songUrl: urls.songMedia,
          markListenedToUrl: urls.markListened,
        });
      }
    });
  };

  const filteredAlbums = React.useMemo<RecentAlbum[]>(() => {
    if (!search) return recentAlbums;
    const q = search.toLowerCase();
    return recentAlbums.filter(
      a =>
        a.title.toLowerCase().includes(q) ||
        a.artist_name.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [recentAlbums, search]);

  const baseSongs = playlistSongs ?? songList;
  const filteredSongs = React.useMemo<RecentAddedSong[]>(() => {
    if (!search) return baseSongs;
    const q = search.toLowerCase();
    return baseSongs.filter(
      s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.album_title || "").toLowerCase().includes(q)
    );
  }, [baseSongs, search]);

  const activePlaylist = playlists.find(p => p.uuid === activePlaylistId) ?? null;
  const activePlaylistName = activePlaylist?.name ?? null;

  const handlePlayAlbum = (album: RecentAlbum) => {
    EventBus.$emit("play-track", {
      track: { uuid: album.uuid, title: album.title },
      trackList: [],
      songUrl: urls.songMedia,
      markListenedToUrl: urls.markListened,
    });
  };

  const handlePaginateAlbums = React.useCallback(
    (direction: "prev" | "next") => {
      const target =
        direction === "prev" ? paginator.previous_page_number : paginator.next_page_number;
      if (target == null) return;
      const url = urls.recentAlbums.replace(/666/, String(target));
      setAlbumsLoading(true);
      doGet(
        url,
        (response: { data: { album_list: RecentAlbum[]; paginator: PaginatorInfo } }) => {
          setRecentAlbums(response.data.album_list);
          setPaginator(response.data.paginator);
          setAlbumsLoading(false);
        },
        "Error fetching recent albums"
      );
    },
    [paginator.previous_page_number, paginator.next_page_number, urls.recentAlbums]
  );

  const totalAlbumPages = Math.max(1, Math.ceil(paginator.count / ALBUMS_PER_PAGE));

  const handleShuffleAll = () => {
    interface ShuffleSong {
      uuid: string;
      title: string;
      artist: string;
      length: string;
      artist_url: string;
    }
    doGet(
      urls.shuffleSongs,
      (response: { data: { song_list: ShuffleSong[] } }) => {
        const shuffled = response.data.song_list;
        if (shuffled.length === 0) return;
        EventBus.$emit("play-track", {
          track: { uuid: shuffled[0].uuid, title: shuffled[0].title },
          trackList: shuffled,
          songUrl: urls.songMedia,
          markListenedToUrl: urls.markListened,
        });
      },
      "Error fetching shuffle list"
    );
  };

  const closeSearch = React.useCallback(() => {
    setSearch("");
    setSearchExpanded(false);
  }, []);

  React.useEffect(() => {
    if (!search) setSearchExpanded(false);
  }, [search]);

  const showPalette = !searchExpanded && search.trim().length >= 2;

  return (
    <div className="music-library-os">
      <PageHead
        searchValue={search}
        onSearchChange={setSearch}
        onShuffleAll={handleShuffleAll}
        createSongUrl={urls.createSong}
        createAlbumUrl={urls.createAlbum}
        onCreatePlaylist={() => setCreatePlaylistOpen(true)}
        activePlaylistName={activePlaylistName}
        paletteSlot={
          showPalette ? (
            <SearchPalette
              query={search}
              searchUrl={urls.search}
              songMediaUrl={urls.songMedia}
              markListenedUrl={urls.markListened}
              onSeeAllSongs={() => setSearchExpanded(true)}
              onClose={closeSearch}
            />
          ) : null
        }
      />

      <LibrarySidebar
        playlists={playlists as PlaylistSidebarItem[]}
        activePlaylistId={activePlaylistId}
        onSelectPlaylist={handleSelectPlaylist}
        onPlayPlaylist={handlePlayPlaylist}
        navUrls={{
          albums: urls.albumList,
          songs: "/music/",
          artists: urls.artistList,
          tags: urls.tagSearch,
        }}
        counts={libraryCounts}
      />

      <main className="mlo-main">
        <StatStrip stats={dashboardStats} />

        <div className="mlo-body">
          <div className="mlo-body-left">
            {searchExpanded ? (
              <SearchResultsView
                query={search}
                searchUrl={urls.search}
                songMediaUrl={urls.songMedia}
                markListenedUrl={urls.markListened}
                currentUuid={currentUuid}
                onBack={closeSearch}
              />
            ) : (
              <>
                {!activePlaylistId && (
                  <section className="mlo-section">
                    <div className="mlo-section-head">
                      Recently Added Albums
                      <span className="mlo-section-head-hint mlo-recent-pager-info">
                        page {paginator.page_number} of {totalAlbumPages}
                      </span>
                      <div className="mlo-recent-pager">
                        <button
                          type="button"
                          className="mlo-recent-pager-btn"
                          aria-label="Previous page"
                          disabled={!paginator.has_previous || albumsLoading}
                          onClick={() => handlePaginateAlbums("prev")}
                        >
                          <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <button
                          type="button"
                          className="mlo-recent-pager-btn"
                          aria-label="Next page"
                          disabled={!paginator.has_next || albumsLoading}
                          onClick={() => handlePaginateAlbums("next")}
                        >
                          <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                      </div>
                    </div>
                    <div className="mlo-album-grid">
                      {filteredAlbums.map(a => (
                        <AlbumGridCard key={a.uuid} album={a} onPlay={handlePlayAlbum} />
                      ))}
                    </div>
                  </section>
                )}
                <section className="mlo-section">
                  <div className="mlo-section-head">
                    {activePlaylist ? (
                      <a className="mlo-playlist-link" href={activePlaylist.url}>
                        {activePlaylist.name}
                      </a>
                    ) : (
                      "Recently Added Songs"
                    )}
                  </div>
                  {activePlaylistId && playlistSongs && (
                    <div className="mlo-playlist-stats">
                      {playlistSongs.length} {playlistSongs.length === 1 ? "song" : "songs"}
                      {playlistTotalTime && <> · {playlistTotalTime}</>}
                    </div>
                  )}
                  <SongTable
                    songs={filteredSongs}
                    currentUuid={currentUuid}
                    songMediaUrl={urls.songMedia}
                    markListenedUrl={urls.markListened}
                  />
                </section>
              </>
            )}
          </div>

          <aside className="mlo-body-right">
            {randomAlbum && <FeaturedAlbumCard album={randomAlbum} />}
            {recentPlayedSongs.length > 0 && <RecentPlaysCard songs={recentPlayedSongs} />}
          </aside>
        </div>
      </main>

      <CreatePlaylistModal
        open={createPlaylistOpen}
        onClose={() => setCreatePlaylistOpen(false)}
        createPlaylistUrl={urls.createPlaylist}
        tagSearchUrl={urls.tagSearch}
      />
    </div>
  );
}

export default MusicDashboardPage;
