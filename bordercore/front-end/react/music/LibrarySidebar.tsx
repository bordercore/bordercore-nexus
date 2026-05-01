import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faRecordVinyl,
  faMusic,
  faMicrophone,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { describeSmartPlaylist } from "./describeSmartPlaylist";
import type { LibraryCounts, PlaylistSidebarItem } from "./types";

interface NavUrls {
  albums: string;
  songs: string;
  artists: string;
  tags: string;
}

interface Props {
  playlists: PlaylistSidebarItem[];
  activePlaylistId: string | null;
  onSelectPlaylist: (uuid: string) => void;
  onPlayPlaylist: (uuid: string) => void;
  navUrls: NavUrls;
  counts: LibraryCounts;
}

function colorForUuid(uuid: string): string {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash << 5) - hash + uuid.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

const LibrarySidebar: React.FC<Props> = ({
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onPlayPlaylist,
  navUrls,
  counts,
}) => {
  return (
    <aside className="mlo-sidebar">
      <div className="mlo-section-head">library</div>
      <nav className="mlo-nav">
        <a className="mlo-nav-item mlo-nav-item-active" href="#">
          <FontAwesomeIcon icon={faHouse} /> <span>overview</span>
        </a>
        <a className="mlo-nav-item" href={navUrls.albums}>
          <FontAwesomeIcon icon={faRecordVinyl} /> <span>albums</span>
          <span className="mlo-nav-count">{counts.albums}</span>
        </a>
        <a className="mlo-nav-item" href={navUrls.songs}>
          <FontAwesomeIcon icon={faMusic} /> <span>songs</span>
          <span className="mlo-nav-count">{counts.songs}</span>
        </a>
        <a className="mlo-nav-item" href={navUrls.artists}>
          <FontAwesomeIcon icon={faMicrophone} /> <span>artists</span>
          <span className="mlo-nav-count">{counts.artists}</span>
        </a>
        <a className="mlo-nav-item" href={navUrls.tags}>
          <FontAwesomeIcon icon={faTag} /> <span>tags</span>
          <span className="mlo-nav-count">{counts.tags}</span>
        </a>
      </nav>

      <div className="mlo-section-head">playlists</div>
      <ul className="mlo-playlists">
        {playlists.map(p => {
          const isActive = activePlaylistId === p.uuid;
          const queryLine = p.type === "smart" ? describeSmartPlaylist(p.parameters) : "";
          const dotStyle = {
            ["--mlo-dot-color" as string]: colorForUuid(p.uuid),
          } as React.CSSProperties;
          return (
            <li key={p.uuid} className="mlo-playlist">
              <button
                type="button"
                className={`mlo-playlist-row${isActive ? " mlo-playlist-row-active" : ""}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelectPlaylist(p.uuid)}
                onDoubleClick={() => onPlayPlaylist(p.uuid)}
              >
                <span
                  className="mlo-playlist-dot"
                  // must remain inline (per-playlist --mlo-dot-color variable)
                  style={dotStyle}
                  aria-hidden="true"
                />
                <span className="mlo-playlist-name">{p.name}</span>
                <span className="mlo-playlist-count">{p.num_songs}</span>
              </button>
              {queryLine && <div className="mlo-playlist-query">{queryLine}</div>}
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default LibrarySidebar;
