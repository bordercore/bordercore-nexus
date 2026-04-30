import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faShuffle, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";

interface Props {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onShuffleAll: () => void;
  onAddSong: () => void;
  meta: string;
  activePlaylistName: string | null;
}

const PageHead: React.FC<Props> = ({
  searchValue,
  onSearchChange,
  onShuffleAll,
  onAddSong,
  meta,
  activePlaylistName,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <div className="mlo-pagebar">
        <div className="mlo-breadcrumb">
          <span>/bordercore/music/</span>
          <span className="mlo-breadcrumb-active">library</span>
          {activePlaylistName && (
            <>
              <span> / </span>
              <span className="mlo-breadcrumb-playlist">{activePlaylistName}</span>
            </>
          )}
        </div>
        <div className="mlo-search">
          <FontAwesomeIcon icon={faSearch} />
          <input
            ref={inputRef}
            type="search"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="search artists, albums, songs…"
          />
          {searchValue ? (
            <button
              type="button"
              className="mlo-search-clear"
              onClick={() => onSearchChange("")}
              aria-label="clear search"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          ) : (
            <span className="mlo-search-hint">
              <kbd>⌘</kbd>
              <kbd>K</kbd>
            </span>
          )}
        </div>
      </div>

      <div className="mlo-pagehead">
        <div>
          <h1 className="mlo-pagehead-title">
            Library <span className="mlo-pagehead-title-dim">— overview</span>
          </h1>
          <p className="mlo-pagehead-meta">{meta}</p>
        </div>
        <div className="mlo-pagehead-actions">
          <button type="button" className="mlo-btn mlo-btn-secondary" onClick={onShuffleAll}>
            <FontAwesomeIcon icon={faShuffle} /> shuffle all
          </button>
          <button type="button" className="mlo-btn mlo-btn-primary" onClick={onAddSong}>
            <FontAwesomeIcon icon={faPlus} /> add
          </button>
        </div>
      </div>
    </>
  );
};

export default PageHead;
