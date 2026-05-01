import React from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faVolumeHigh, faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { EventBus } from "../utils/reactUtils";
import type { SearchResults, SearchSong } from "./types";

interface Props {
  query: string;
  searchUrl: string;
  songMediaUrl: string;
  markListenedUrl: string;
  currentUuid: string | null;
  onBack: () => void;
}

const PAGE_SIZE = 50;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const SearchResultsView: React.FC<Props> = ({
  query,
  searchUrl,
  songMediaUrl,
  markListenedUrl,
  currentUuid,
  onBack,
}) => {
  const [songs, setSongs] = React.useState<SearchSong[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const requestSeqRef = React.useRef(0);

  React.useEffect(() => {
    setPage(0);
  }, [query]);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSongs([]);
      setTotal(0);
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoading(true);
    axios
      .get(searchUrl, {
        params: {
          q: trimmed,
          song_limit: PAGE_SIZE,
          song_offset: page * PAGE_SIZE,
          album_limit: 0,
        },
      })
      .then(response => {
        if (seq !== requestSeqRef.current) return;
        const data = response.data as SearchResults;
        setSongs(data.songs);
        setTotal(data.totals.songs);
        setLoading(false);
      })
      .catch(error => {
        if (seq !== requestSeqRef.current) return;
        setLoading(false);
        console.error("Music search page failed:", error);
      });
  }, [query, searchUrl, page]);

  const playSong = (idx: number) => {
    const s = songs[idx];
    if (!s) return;
    EventBus.$emit("play-track", {
      track: { uuid: s.uuid, title: s.title, artist: s.artist },
      trackList: songs,
      songUrl: songMediaUrl,
      markListenedToUrl: markListenedUrl,
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromIdx = page * PAGE_SIZE;

  return (
    <section className="mlo-section">
      <div className="mlo-section-head">
        <button type="button" className="mlo-search-back" onClick={onBack}>
          <FontAwesomeIcon icon={faChevronLeft} /> back
        </button>
        <span>Search results for &ldquo;{query.trim()}&rdquo;</span>
      </div>

      {total > 0 && (
        <div className="mlo-playlist-stats">
          {total} {total === 1 ? "song" : "songs"} · page {page + 1} of {totalPages}
        </div>
      )}

      <div className="mlo-song-table">
        <div className="mlo-song-row mlo-song-row-head">
          <span>#</span>
          <span>title</span>
          <span>artist</span>
          <span>year</span>
          <span>length</span>
        </div>
        {songs.map((song, idx) => {
          const isPlaying = currentUuid === song.uuid;
          return (
            <div
              role="button"
              tabIndex={0}
              key={song.uuid}
              onClick={() => playSong(idx)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  playSong(idx);
                }
              }}
              className={`mlo-song-row${isPlaying ? " mlo-song-row-playing" : ""}`}
            >
              <span className="mlo-song-row-num">
                {isPlaying ? (
                  <FontAwesomeIcon icon={faVolumeHigh} />
                ) : (
                  <span className="mlo-song-row-num-text">{pad2(fromIdx + idx + 1)}</span>
                )}
                <FontAwesomeIcon icon={faPlay} className="mlo-song-row-play-icon" />
              </span>
              <span className="mlo-song-row-title">{song.title}</span>
              <span className="mlo-song-row-artist">{song.artist}</span>
              <span className="mlo-song-row-year">{song.year ?? ""}</span>
              <span className="mlo-song-row-length">{song.length}</span>
            </div>
          );
        })}
      </div>

      {!loading && total === 0 && <div className="mlo-playlist-stats">No matches.</div>}

      {totalPages > 1 && (
        <div className="mlo-search-pager">
          <button
            type="button"
            className="mlo-btn"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            previous
          </button>
          <span className="mlo-search-pager-info">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="mlo-btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          >
            next
          </button>
        </div>
      )}
    </section>
  );
};

export default SearchResultsView;
