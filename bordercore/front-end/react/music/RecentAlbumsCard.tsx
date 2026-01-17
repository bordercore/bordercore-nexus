import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import Card from "../common/Card";
import DropDownMenu from "../common/DropDownMenu";
import type { RecentAlbum, PaginatorInfo, MusicDashboardUrls } from "./types";

interface RecentAlbumsCardProps {
  albums: RecentAlbum[];
  paginator: PaginatorInfo;
  urls: MusicDashboardUrls;
  onPaginate: (direction: "prev" | "next") => void;
  className?: string;
}

export function RecentAlbumsCard({
  albums,
  paginator,
  urls,
  onPaginate,
  className,
}: RecentAlbumsCardProps) {
  const needsPagination = paginator.has_previous || paginator.has_next;

  return (
    <Card
      className={className ? `hover-target ${className}` : "hover-target"}
      titleSlot={
        <div className="d-flex">
          <div className="card-title">Recently Added Albums</div>
          <div className="ms-auto">
            <DropDownMenu
            showOnHover={true}
            dropdownSlot={
              <ul className="dropdown-menu-list">
                <li>
                  <a className="dropdown-menu-item" href={urls.createSong}>
                    <span className="dropdown-menu-icon">
                      <FontAwesomeIcon icon={faPlus} className="text-primary" />
                    </span>
                    <span className="dropdown-menu-text">New Song</span>
                  </a>
                </li>
                <li>
                  <a className="dropdown-menu-item" href={urls.albumList}>
                    <span className="dropdown-menu-icon">
                      <FontAwesomeIcon icon={faPlus} className="text-primary" />
                    </span>
                    <span className="dropdown-menu-text">Album List</span>
                  </a>
                </li>
                <li>
                  <a className="dropdown-menu-item" href={urls.createAlbum}>
                    <span className="dropdown-menu-icon">
                      <FontAwesomeIcon icon={faPlus} className="text-primary" />
                    </span>
                    <span className="dropdown-menu-text">New Album</span>
                  </a>
                </li>
              </ul>
            }
            />
          </div>
        </div>
      }
    >
      <div className="d-flex ms-2">
        <div id="album-list" className="album-grid flex-grow-1">
          {albums.map((album) => (
            <div
              key={album.uuid}
              className="p-2"
              style={{ width: "12.31rem" }}
              data-bs-toggle="tooltip"
              data-placement="bottom"
              title={`Added ${album.created}`}
            >
              <div className="zoomable">
                <a href={album.album_url}>
                  <img src={album.artwork_url} height={150} width={150} alt={album.title} />
                </a>
              </div>
              <div className="mt-1 fw-bold text-truncate">{album.title}</div>
              <div className="text-light text-truncate">
                <a href={album.artist_url}>{album.artist_name}</a>
              </div>
            </div>
          ))}
        </div>

        {needsPagination && (
          <h5 className="d-flex mb-0 me-1 pt-3 pagination-arrows">
            <div>
              {paginator.has_previous ? (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPaginate("prev");
                  }}
                >
                  <FontAwesomeIcon
                    icon={faChevronLeft}
                    className="text-emphasis"
                  />
                </a>
              ) : (
                <span>
                  <FontAwesomeIcon
                    icon={faChevronLeft}
                    className="text-emphasis icon-disabled"
                  />
                </span>
              )}
            </div>
            <div>
              {paginator.has_next ? (
                <a
                  href="#"
                  className="ms-1"
                  onClick={(e) => {
                    e.preventDefault();
                    onPaginate("next");
                  }}
                >
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    className="text-emphasis"
                  />
                </a>
              ) : (
                <span>
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    className="text-emphasis icon-disabled"
                  />
                </span>
              )}
            </div>
          </h5>
        )}
      </div>
    </Card>
  );
}

export default RecentAlbumsCard;
