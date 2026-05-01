import React from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMusic, faRecordVinyl, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { EventBus } from "../utils/reactUtils";
import type { SearchResults, SearchSong, SearchAlbum } from "./types";

interface Props {
  query: string;
  searchUrl: string;
  songMediaUrl: string;
  markListenedUrl: string;
  onSeeAllSongs: () => void;
  onClose: () => void;
}

type Selection =
  | { kind: "song"; index: number }
  | { kind: "album"; index: number }
  | { kind: "see-all-songs" }
  | null;

const DEBOUNCE_MS = 150;
const MIN_QUERY_LEN = 2;

const SearchPalette: React.FC<Props> = ({
  query,
  searchUrl,
  songMediaUrl,
  markListenedUrl,
  onSeeAllSongs,
  onClose,
}) => {
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selection, setSelection] = React.useState<Selection>(null);
  const requestSeqRef = React.useRef(0);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setResults(null);
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      axios
        .get(searchUrl, { params: { q: trimmed } })
        .then(response => {
          if (seq !== requestSeqRef.current) return;
          setResults(response.data as SearchResults);
          setLoading(false);
        })
        .catch(error => {
          if (seq !== requestSeqRef.current) return;
          setLoading(false);
          console.error("Music search failed:", error);
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, searchUrl]);

  const songs = results?.songs ?? [];
  const albums = results?.albums ?? [];
  const totalSongs = results?.totals.songs ?? 0;
  const totalAlbums = results?.totals.albums ?? 0;
  const hasMoreSongs = totalSongs > songs.length;

  const flatItems = React.useMemo<Selection[]>(() => {
    const list: Selection[] = [];
    songs.forEach((_s, i) => list.push({ kind: "song", index: i }));
    if (hasMoreSongs) list.push({ kind: "see-all-songs" });
    albums.forEach((_a, i) => list.push({ kind: "album", index: i }));
    return list;
  }, [songs, albums, hasMoreSongs]);

  React.useEffect(() => {
    setSelection(flatItems.length > 0 ? flatItems[0] : null);
  }, [flatItems]);

  const playSong = React.useCallback(
    (idx: number) => {
      const s = songs[idx];
      if (!s) return;
      EventBus.$emit("play-track", {
        track: { uuid: s.uuid, title: s.title, artist: s.artist },
        trackList: songs,
        songUrl: songMediaUrl,
        markListenedToUrl: markListenedUrl,
      });
      onClose();
    },
    [songs, songMediaUrl, markListenedUrl, onClose]
  );

  const activate = React.useCallback(
    (sel: Selection) => {
      if (!sel) return;
      if (sel.kind === "song") {
        playSong(sel.index);
      } else if (sel.kind === "album") {
        const a = albums[sel.index];
        if (a) window.location.href = a.album_url;
      } else if (sel.kind === "see-all-songs") {
        onSeeAllSongs();
      }
    },
    [albums, playSong, onSeeAllSongs]
  );

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (flatItems.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = flatItems.findIndex(item => sameSelection(item, selection));
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const next =
          (currentIdx === -1 ? 0 : currentIdx + delta + flatItems.length) % flatItems.length;
        setSelection(flatItems[next]);
      } else if (e.key === "Enter") {
        e.preventDefault();
        activate(selection);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flatItems, selection, activate, onClose]);

  if (query.trim().length < MIN_QUERY_LEN) return null;

  const showEmpty = !loading && results !== null && songs.length === 0 && albums.length === 0;

  return (
    <div className="mlo-palette" role="listbox" aria-label="search results">
      {loading && songs.length === 0 && albums.length === 0 && (
        <div className="mlo-palette-status">searching…</div>
      )}

      {showEmpty && (
        <div className="mlo-palette-status">No matches for &ldquo;{query.trim()}&rdquo;.</div>
      )}

      {songs.length > 0 && (
        <div className="mlo-palette-group">
          <div className="mlo-palette-group-head">
            <FontAwesomeIcon icon={faMusic} />
            <span>songs</span>
            <span className="mlo-palette-group-count">{totalSongs}</span>
          </div>
          {songs.map((s, idx) => {
            const active = isSelected(selection, "song", idx);
            return (
              <button
                key={s.uuid}
                type="button"
                role="option"
                aria-selected={active}
                className={`mlo-palette-item${active ? " mlo-palette-item-active" : ""}`}
                onMouseEnter={() => setSelection({ kind: "song", index: idx })}
                onClick={() => playSong(idx)}
              >
                <span className="mlo-palette-song-title">{s.title}</span>
                <span className="mlo-palette-song-artist">{s.artist}</span>
                <span className="mlo-palette-song-meta">
                  {[s.year ?? null, s.length].filter(Boolean).join(" · ")}
                </span>
              </button>
            );
          })}
          {hasMoreSongs && (
            <button
              type="button"
              role="option"
              aria-selected={selection?.kind === "see-all-songs"}
              className={`mlo-palette-see-all${selection?.kind === "see-all-songs" ? " mlo-palette-item-active" : ""}`}
              onMouseEnter={() => setSelection({ kind: "see-all-songs" })}
              onClick={onSeeAllSongs}
            >
              <span>See all {totalSongs} songs</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          )}
        </div>
      )}

      {albums.length > 0 && (
        <div className="mlo-palette-group">
          <div className="mlo-palette-group-head">
            <FontAwesomeIcon icon={faRecordVinyl} />
            <span>albums</span>
            <span className="mlo-palette-group-count">{totalAlbums}</span>
          </div>
          {albums.map((a, idx) => {
            const active = isSelected(selection, "album", idx);
            return (
              <button
                key={a.uuid}
                type="button"
                role="option"
                aria-selected={active}
                className={`mlo-palette-item mlo-palette-album${active ? " mlo-palette-item-active" : ""}`}
                onMouseEnter={() => setSelection({ kind: "album", index: idx })}
                onClick={() => activate({ kind: "album", index: idx })}
              >
                <img
                  className="mlo-palette-album-cover"
                  src={a.artwork_url}
                  alt=""
                  loading="lazy"
                />
                <span className="mlo-palette-song-title">{a.title}</span>
                <span className="mlo-palette-song-artist">{a.artist_name}</span>
                <span className="mlo-palette-song-meta">{a.year ?? ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

function isSelected(sel: Selection, kind: "song" | "album", index: number): boolean {
  return sel?.kind === kind && (sel as { index: number }).index === index;
}

function sameSelection(a: Selection, b: Selection): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "see-all-songs" || b.kind === "see-all-songs") return a.kind === b.kind;
  return (a as { index: number }).index === (b as { index: number }).index;
}

export type { SearchSong, SearchAlbum };
export default SearchPalette;
