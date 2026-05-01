import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay } from "@fortawesome/free-solid-svg-icons";
import type { RecentAlbum } from "./types";

interface Props {
  album: RecentAlbum;
  onPlay: (album: RecentAlbum) => void;
}

function ratingStars(rating: number | null): string {
  if (rating == null) return "";
  return "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
}

const AlbumGridCard: React.FC<Props> = ({ album, onPlay }) => {
  return (
    <div className="mlo-album-card">
      <div className="mlo-album-card-cover">
        <a href={album.album_url} className="mlo-album-card-cover-link">
          <img src={album.artwork_url} alt={album.title} loading="lazy" />
        </a>
        <button
          type="button"
          className="mlo-album-card-play"
          aria-label="play album"
          onClick={() => onPlay(album)}
        >
          <FontAwesomeIcon icon={faPlay} />
        </button>
      </div>
      <a className="mlo-album-card-title" href={album.album_url}>
        {album.title}
      </a>
      <a className="mlo-album-card-artist" href={album.artist_url}>
        {album.artist_name}
      </a>
      <div className="mlo-album-card-meta">
        {album.year != null && <span>{album.year}</span>}
        {album.rating != null && (
          <>
            <span aria-hidden="true">·</span>
            <span aria-label={`rating ${album.rating} out of 5`}>{ratingStars(album.rating)}</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span className="mlo-album-card-plays">♪{album.plays}</span>
      </div>
      {album.tags.length > 0 && (
        <div className="mlo-album-card-tags">
          {album.tags.map(t => (
            <span key={t} className="mlo-tag-chip">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlbumGridCard;
