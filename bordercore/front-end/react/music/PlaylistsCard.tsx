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
        <div className="d-flex">
          <div className="card-title">Playlists</div>
          <div className="ms-auto">
            <DropDownMenu
              showOnHover={true}
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
                        <FontAwesomeIcon icon={faPlus} className="text-primary" />
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
          <li key={playlist.uuid} className="list-with-counts d-flex ps-2 py-1 pe-2">
            <a href={playlist.url} className="d-flex w-100">
              <div>{playlist.name}</div>
              <div className="ms-auto">
                <span className="px-2 badge rounded-pill">{playlist.num_songs}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default PlaylistsCard;
