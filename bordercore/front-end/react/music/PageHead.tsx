import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faShuffle,
  faPlus,
  faMusic,
  faRecordVinyl,
  faList,
} from "@fortawesome/free-solid-svg-icons";
import DropDownMenu from "../common/DropDownMenu";

interface Props {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onShuffleAll: () => void;
  createSongUrl: string;
  createAlbumUrl: string;
  onCreatePlaylist: () => void;
  paletteSlot?: React.ReactNode;
}

const PageHead: React.FC<Props> = ({
  searchValue,
  onSearchChange,
  onShuffleAll,
  createSongUrl,
  createAlbumUrl,
  onCreatePlaylist,
  paletteSlot,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isMac = React.useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ||
      navigator.platform ||
      navigator.userAgent;
    return /Mac|iPhone|iPod|iPad/i.test(platform);
  }, []);

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

  const addLinks = [
    {
      id: "new-song",
      title: "New Song",
      url: createSongUrl,
      icon: faMusic,
    },
    {
      id: "new-album",
      title: "New Album",
      url: createAlbumUrl,
      icon: faRecordVinyl,
    },
    {
      id: "new-playlist",
      title: "New Playlist",
      url: "#",
      icon: faList,
      clickHandler: onCreatePlaylist,
    },
  ];

  return (
    <>
      <div className="mlo-pagebar">
        <div className="mlo-search">
          <FontAwesomeIcon icon={faSearch} />
          <input
            ref={inputRef}
            type="search"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="search artists, albums, songs…"
          />
          {!searchValue && (
            <span className="mlo-search-hint">
              <kbd>{isMac ? "⌘" : "Ctrl"}</kbd>
              <kbd>K</kbd>
            </span>
          )}
          {paletteSlot}
        </div>
      </div>

      <div className="mlo-pagehead">
        <div>
          <h1 className="mlo-pagehead-title">
            <span className="bc-page-title">Music Library</span>
          </h1>
        </div>
        <div className="mlo-pagehead-actions">
          <button type="button" className="mlo-btn mlo-btn-secondary" onClick={onShuffleAll}>
            <FontAwesomeIcon icon={faShuffle} /> shuffle all
          </button>
          <DropDownMenu
            links={addLinks}
            showTarget={false}
            iconSlot={
              <span className="mlo-btn mlo-btn-primary">
                <FontAwesomeIcon icon={faPlus} /> add
              </span>
            }
          />
        </div>
      </div>
    </>
  );
};

export default PageHead;
