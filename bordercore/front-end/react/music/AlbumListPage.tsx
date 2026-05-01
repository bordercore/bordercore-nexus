import React from "react";
import type { AlbumListAlbum, AlbumListProps } from "./types";

interface LetterNavProps {
  nav: string[];
  selectedLetter: string;
  uniqueAlbumLetters: string[];
  albumListBaseUrl: string;
}

function LetterNav({ nav, selectedLetter, uniqueAlbumLetters, albumListBaseUrl }: LetterNavProps) {
  return (
    <nav className="mlo-letter-nav">
      {nav.map(letter => {
        const has = uniqueAlbumLetters.includes(letter);
        const isCurrent = letter === selectedLetter;
        const display = letter === "other" ? "#" : letter.toUpperCase();
        const className = letter === "other" ? "mlo-letter-nav-other" : undefined;

        if (isCurrent) {
          return (
            <span key={letter} className={`is-current ${className || ""}`.trim()}>
              {display}
            </span>
          );
        }
        if (!has) {
          return (
            <span key={letter} className={`is-disabled ${className || ""}`.trim()}>
              {display}
            </span>
          );
        }
        return (
          <a key={letter} href={`${albumListBaseUrl}?letter=${letter}`} className={className}>
            {display}
          </a>
        );
      })}
    </nav>
  );
}

interface AlbumCardProps {
  album: AlbumListAlbum;
}

function AlbumCard({ album }: AlbumCardProps) {
  return (
    <article className="mlo-album-card">
      <a href={album.album_url} className="mlo-album-card-cover">
        <img src={album.artwork_url} alt={album.title} />
      </a>
      <a href={album.album_url} className="mlo-album-card-title" title={album.title}>
        {album.title}
      </a>
      <a href={album.artist_url} className="mlo-album-card-artist" title={album.artist_name}>
        {album.artist_name}
      </a>
      <div className="mlo-album-card-meta">
        <span>{album.year}</span>
        {album.track_count > 0 && (
          <>
            <span>·</span>
            <span>
              {album.track_count} {album.track_count === 1 ? "track" : "tracks"}
            </span>
          </>
        )}
      </div>
    </article>
  );
}

export function AlbumListPage({
  albums,
  nav,
  selectedLetter,
  uniqueAlbumLetters,
  albumListBaseUrl,
  musicHomeUrl,
}: AlbumListProps) {
  const headingLetter = selectedLetter === "other" ? "#" : selectedLetter.toUpperCase();

  return (
    <div className="music-library-os mlo-list-page">
      <div className="mlo-list-bar">
        <div className="mlo-breadcrumb">
          <a href={musicHomeUrl}>/bordercore/music/</a>
          <span className="mlo-breadcrumb-active">albums</span>
          <span> / </span>
          <span className="mlo-breadcrumb-letter">{headingLetter}</span>
        </div>
      </div>

      <div className="mlo-list-head">
        <h1 className="mlo-pagehead-title">
          Albums <span className="mlo-pagehead-title-dim">— browse by title</span>
        </h1>
        <p className="mlo-pagehead-meta">
          {albums.length} {albums.length === 1 ? "album" : "albums"} starting with{" "}
          <span className="mlo-pagehead-meta-letter">{headingLetter}</span>
        </p>
      </div>

      <LetterNav
        nav={nav}
        selectedLetter={selectedLetter}
        uniqueAlbumLetters={uniqueAlbumLetters}
        albumListBaseUrl={albumListBaseUrl}
      />

      {albums.length === 0 ? (
        <div className="mlo-list-empty">
          No albums starting with <strong>{headingLetter}</strong>.
        </div>
      ) : (
        <div className="mlo-list-grid">
          {albums.map(album => (
            <AlbumCard key={album.uuid} album={album} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AlbumListPage;
