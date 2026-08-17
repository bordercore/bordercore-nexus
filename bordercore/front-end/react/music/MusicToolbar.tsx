import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { useFocusOnCtrlK } from "../common/hooks/useFocusOnCtrlK";

interface Props {
  searchValue: string;
  onSearchChange: (value: string) => void;
  paletteSlot?: React.ReactNode;
}

/**
 * Main-column toolbar for the music dashboard — holds the library search and
 * the command-palette slot. Mirrors the toolbar position on /todo/, /bookmark/,
 * and /collection/: the search lives at the top of the main column, while the
 * page head keeps only the title and action buttons. The Ctrl-K focus binding
 * is documented in the topbar help popup, via this page's {% block help_page %}.
 */
const MusicToolbar: React.FC<Props> = ({ searchValue, onSearchChange, paletteSlot }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  useFocusOnCtrlK(inputRef);

  return (
    <div className="mlo-toolbar">
      <div className="mlo-search" role="search">
        <FontAwesomeIcon icon={faSearch} />
        <input
          ref={inputRef}
          type="search"
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search artists, albums, songs…"
        />
        {paletteSlot}
      </div>
    </div>
  );
};

export default MusicToolbar;
