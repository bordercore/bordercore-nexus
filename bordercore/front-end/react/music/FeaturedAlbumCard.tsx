import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faShuffle } from "@fortawesome/free-solid-svg-icons";
import type { FeaturedAlbum } from "./types";

interface Props {
  album: FeaturedAlbum;
  onPlay: () => void;
  onShuffle: () => void;
}

const FeaturedAlbumCard: React.FC<Props> = ({ album, onPlay, onShuffle }) => {
  return (
    <section className="mlo-featured">
      <div className="mlo-section-head">
        Featured <span className="mlo-section-head-hint">// album of the week</span>
      </div>
      <a href={album.album_url} className="mlo-featured-cover-link">
        <img src={album.artwork_url} alt={album.title} className="mlo-featured-cover" />
      </a>
      <a href={album.album_url} className="mlo-featured-title">
        {album.title}
      </a>
      <a href={album.artist_url} className="mlo-featured-artist">
        {album.artist_name}
      </a>
      <div className="mlo-featured-actions">
        <button type="button" className="mlo-btn mlo-btn-primary" onClick={onPlay}>
          <FontAwesomeIcon icon={faPlay} /> play
        </button>
        <button
          type="button"
          className="mlo-btn mlo-btn-icon"
          aria-label="shuffle"
          onClick={onShuffle}
        >
          <FontAwesomeIcon icon={faShuffle} />
        </button>
      </div>
    </section>
  );
};

export default FeaturedAlbumCard;
