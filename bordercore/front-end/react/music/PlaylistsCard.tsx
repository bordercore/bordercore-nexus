import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import Card from "../common/Card";
import DropDownMenu from "../common/DropDownMenu";
import type { PlaylistItem } from "./types";

interface PlaylistsCardProps {
  playlists: PlaylistItem[];
  onClickCreate: () => void;
  className?: string;
}

export function PlaylistsCard({ playlists, onClickCreate, className }: PlaylistsCardProps) {
  return (
    <Card
      className={className}
      titleSlot={
        <div className="flex">
          <div className="card-title">Playlists</div>
          <div className="ms-auto">
            <DropDownMenu
              dropdownSlot={
                <ul className="dropdown-menu-list">
                  <li>
                    <a
                      className="dropdown-menu-item"
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        onClickCreate();
                      }}
                    >
                      <span className="dropdown-menu-icon">
                        <FontAwesomeIcon icon={faPlus} className="text-accent" />
                      </span>
                      <span className="dropdown-menu-text">New Playlist</span>
                    </a>
                  </li>
                </ul>
              }
            />
          </div>
        </div>
      }
    >
      <hr className="divider" />
      <ul className="list-group interior-borders">
        {playlists.map(playlist => (
          <li key={playlist.uuid} className="list-with-counts flex ps-2 py-1 pe-2">
            <a href={playlist.url} className="flex w-full">
              <div>{playlist.name}</div>
              <div className="ms-auto">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-surface-3 text-ink-1">
                  {playlist.num_songs}
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default PlaylistsCard;
