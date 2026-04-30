import React from "react";
import { doGet, EventBus } from "../utils/reactUtils";
import LibrarySidebar from "./LibrarySidebar";
import StatStrip, { NowPlayingTrack } from "./StatStrip";
import PageHead from "./PageHead";
import AlbumGridCard from "./AlbumGridCard";
import SongTable from "./SongTable";
import FeaturedAlbumCard from "./FeaturedAlbumCard";
import RecentPlaysCard from "./RecentPlaysCard";
import CreatePlaylistModal, { CreatePlaylistModalHandle } from "./CreatePlaylistModal";
import type {
  MusicDashboardProps,
  RecentAlbum,
  RecentAddedSong,
  PlaylistSidebarItem,
} from "./types";

interface PlaylistFetchResponse {
  data?: {
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
  urls,
  dashboardStats,
}: MusicDashboardProps) {
  const [recentAlbums] = React.useState<RecentAlbum[]>(initialRecentAlbums);
  const [songList, setSongList] = React.useState<RecentAddedSong[]>([]);
  const [search, setSearch] = React.useState("");
  const [activePlaylistId, setActivePlaylistId] = React.useState<string | null>(null);
  const [playlistSongs, setPlaylistSongs] = React.useState<RecentAddedSong[] | null>(null);
  const [currentUuid, setCurrentUuid] = React.useState<string | null>(null);
  const [nowPlayingTrack] = React.useState<NowPlayingTrack | null>(null);

  const createPlaylistRef = React.useRef<CreatePlaylistModalHandle>(null);

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

  const activePlaylistName = playlists.find(p => p.uuid === activePlaylistId)?.name ?? null;

  const meta = `${recentAlbums.length} albums · ${songList.length} recent songs · ${dashboardStats.plays_today} plays today`;

  const handlePlayAlbum = (album: RecentAlbum) => {
    EventBus.$emit("play-track", {
      track: { uuid: album.uuid, title: album.title },
      trackList: [],
      songUrl: urls.songMedia,
      markListenedToUrl: urls.markListened,
    });
  };

  const handleShuffleAll = () => {
    if (songList.length === 0) return;
    const shuffled = [...songList].sort(() => Math.random() - 0.5);
    EventBus.$emit("play-track", {
      track: { uuid: shuffled[0].uuid, title: shuffled[0].title },
      trackList: shuffled,
      songUrl: urls.songMedia,
      markListenedToUrl: urls.markListened,
    });
  };

  return (
    <div className="music-library-os">
      <PageHead
        searchValue={search}
        onSearchChange={setSearch}
        onShuffleAll={handleShuffleAll}
        onAddSong={() => createPlaylistRef.current?.openModal()}
        meta={meta}
        activePlaylistName={activePlaylistName}
      />

      <LibrarySidebar
        playlists={playlists as PlaylistSidebarItem[]}
        activePlaylistId={activePlaylistId}
        onSelectPlaylist={handleSelectPlaylist}
        onPlayPlaylist={handlePlayPlaylist}
        navUrls={{
          albums: urls.albumList,
          songs: "/music/",
          artists: urls.albumList,
          tags: urls.tagSearch,
        }}
        totalSongs={songList.length}
      />

      <main className="mlo-main">
        <StatStrip stats={dashboardStats} initialTrack={nowPlayingTrack} />

        <div className="mlo-body">
          <div className="mlo-body-left">
            {!activePlaylistId && (
              <section className="mlo-section">
                <div className="mlo-section-head">
                  Recently Added <span className="mlo-section-head-hint">// last 30 days</span>
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
                {activePlaylistId ? activePlaylistName : "Recently Added Songs"}
              </div>
              <SongTable
                songs={filteredSongs}
                currentUuid={currentUuid}
                setRatingUrl={urls.setSongRating}
                songMediaUrl={urls.songMedia}
                markListenedUrl={urls.markListened}
              />
            </section>
          </div>

          <aside className="mlo-body-right">
            {randomAlbum && (
              <FeaturedAlbumCard
                album={randomAlbum}
                onPlay={() =>
                  EventBus.$emit("play-track", {
                    track: { uuid: randomAlbum.uuid, title: randomAlbum.title },
                    trackList: [],
                    songUrl: urls.songMedia,
                    markListenedToUrl: urls.markListened,
                  })
                }
                onShuffle={handleShuffleAll}
              />
            )}
            {recentPlayedSongs.length > 0 && (
              <RecentPlaysCard songs={recentPlayedSongs} playsToday={dashboardStats.plays_today} />
            )}
          </aside>
        </div>
      </main>

      <CreatePlaylistModal
        ref={createPlaylistRef}
        createPlaylistUrl={urls.createPlaylist}
        tagSearchUrl={urls.tagSearch}
      />
    </div>
  );
}

export default MusicDashboardPage;
