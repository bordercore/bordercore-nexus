import React from "react";
import Card from "../common/Card";
import type { FeaturedAlbum } from "./types";

interface FeaturedAlbumCardProps {
  album: FeaturedAlbum;
  className?: string;
}

export function FeaturedAlbumCard({ album, className }: FeaturedAlbumCardProps) {
  return (
    <Card title="Featured Album" className={className}>
      <hr className="divider" />
      <div className="zoomable">
        <a href={album.album_url}>
          <img src={album.artwork_url} height={150} width={150} alt={album.title} />
        </a>
      </div>
      <div className="mt-1 fw-bold">{album.title}</div>
      <div className="text-light">
        <a href={album.artist_url}>{album.artist_name}</a>
      </div>
    </Card>
  );
}

export default FeaturedAlbumCard;
