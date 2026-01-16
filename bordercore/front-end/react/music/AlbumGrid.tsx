import React from "react";
import type { ArtistDetailAlbum } from "./types";

interface AlbumGridProps {
  albums: ArtistDetailAlbum[];
  imagesUrl: string;
  albumDetailUrlTemplate: string;
  title: string;
}

export function AlbumGrid({
  albums,
  imagesUrl,
  albumDetailUrlTemplate,
  title,
}: AlbumGridProps) {
  const getAlbumDetailUrl = (albumUuid: string) => {
    return albumDetailUrlTemplate.replace(/00000000-0000-0000-0000-000000000000/, albumUuid);
  };

  const getAlbumArtworkUrl = (albumUuid: string) => {
    return `${imagesUrl}album_artwork/${albumUuid}`;
  };

  if (albums.length === 0) {
    return null;
  }

  return (
    <div className="card backdrop-filter hover-target me-0 mb-3">
      <div className="card-body">
        <h4 className="fw-bold">
          {title}
        </h4>
        <div className="d-flex flex-wrap">
          {albums.map((album) => (
            <div key={album.uuid} className="d-flex flex-column w-25 hoverable p-2">
              <div className="mt-3">
                <a href={getAlbumDetailUrl(album.uuid)}>
                  <img
                    src={getAlbumArtworkUrl(album.uuid)}
                    height={150}
                    width={150}
                    alt={album.title}
                  />
                </a>
              </div>
              <div className="mt-2 fw-bold">
                {album.title}
              </div>
              <div>
                {album.year}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AlbumGrid;
