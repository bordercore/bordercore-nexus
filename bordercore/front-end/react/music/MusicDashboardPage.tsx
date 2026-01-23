import React from "react";
import { doGet } from "../utils/reactUtils";
import Card from "../common/Card";
import FeaturedAlbumCard from "./FeaturedAlbumCard";
import PlaylistsCard from "./PlaylistsCard";
import RecentlyPlayedSongsCard from "./RecentlyPlayedSongsCard";
import RecentAlbumsCard from "./RecentAlbumsCard";
import RecentSongsTable from "./RecentSongsTable";
import CreatePlaylistModal, { CreatePlaylistModalHandle } from "./CreatePlaylistModal";
import type {
  MusicDashboardProps,
  RecentAlbum,
  RecentAddedSong,
  PaginatorInfo,
} from "./types";

export function MusicDashboardPage({
  randomAlbum,
  playlists,
  recentPlayedSongs,
  initialRecentAlbums,
  initialPaginator,
  urls,
  imagesUrl,
  csrfToken,
}: MusicDashboardProps) {
  const [recentAlbums, setRecentAlbums] = React.useState<RecentAlbum[]>(initialRecentAlbums);
  const [paginator, setPaginator] = React.useState<PaginatorInfo>(initialPaginator);
  const [songList, setSongList] = React.useState<RecentAddedSong[]>([]);

  const createPlaylistModalRef = React.useRef<CreatePlaylistModalHandle>(null);

  // Fetch recently added songs on mount
  React.useEffect(() => {
    doGet(
      urls.recentSongs,
      (response: { data: { song_list: RecentAddedSong[] } }) => {
        setSongList(response.data.song_list);
      },
      "Error getting recent songs"
    );
  }, [urls.recentSongs]);

  const handlePaginate = React.useCallback(
    (direction: "prev" | "next") => {
      const pageNumber =
        direction === "prev"
          ? paginator.previous_page_number
          : paginator.next_page_number;

      if (pageNumber === null) return;

      const url = urls.recentAlbums.replace(/666/, String(pageNumber));

      doGet(
        url,
        (response: { data: { album_list: RecentAlbum[]; paginator: PaginatorInfo } }) => {
          setRecentAlbums(response.data.album_list);
          setPaginator(response.data.paginator);
        },
        "Error getting recent albums"
      );
    },
    [paginator, urls.recentAlbums]
  );

  const handleClickCreate = React.useCallback(() => {
    createPlaylistModalRef.current?.openModal();
  }, []);

  return (
    <div className="row g-0 h-100 mx-2 music-dashboard">
      {/* Left sidebar */}
      <div className="flex-grow-last col-lg-3 d-flex flex-column pe-gutter">
        {randomAlbum && (
          <FeaturedAlbumCard album={randomAlbum} className="flex-grow-0 backdrop-filter" />
        )}

        <PlaylistsCard
          playlists={playlists}
          onClickCreate={handleClickCreate}
          className="flex-grow-0 backdrop-filter hover-target z-index-positive"
        />

        {recentPlayedSongs.length > 0 && (
          <RecentlyPlayedSongsCard songs={recentPlayedSongs} className="backdrop-filter" />
        )}
      </div>

      {/* Main content */}
      <div className="col-lg-9">
        <RecentAlbumsCard
          albums={recentAlbums}
          paginator={paginator}
          urls={urls}
          onPaginate={handlePaginate}
          className="backdrop-filter hover-target"
        />

        <Card title="Recently Added Songs" className="backdrop-filter">
          <hr className="divider" />
          <div className="card-grid ms-2">
            <RecentSongsTable songs={songList} />
          </div>
        </Card>
      </div>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        ref={createPlaylistModalRef}
        createPlaylistUrl={urls.createPlaylist}
        tagSearchUrl={urls.tagSearch}
        csrfToken={csrfToken}
      />
    </div>
  );
}

export default MusicDashboardPage;
