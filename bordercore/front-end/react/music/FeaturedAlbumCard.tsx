import React from "react";
import type { FeaturedAlbum } from "./types";

interface Props {
  album: FeaturedAlbum;
}

const FeaturedAlbumCard: React.FC<Props> = ({ album }) => {
  return (
    <section className="mlo-featured">
      <div className="mlo-section-head">Featured Album</div>
      <a href={album.album_url} className="mlo-featured-cover-link">
        <img src={album.artwork_url} alt={album.title} className="mlo-featured-cover" />
      </a>
      <a href={album.album_url} className="mlo-featured-title">
        {album.title}
      </a>
      <a href={album.artist_url} className="mlo-featured-artist">
        {album.artist_name}
      </a>
    </section>
  );
};

export default FeaturedAlbumCard;
