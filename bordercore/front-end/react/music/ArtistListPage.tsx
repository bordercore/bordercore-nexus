import React from "react";
import type { ArtistListArtist, ArtistListUrls } from "./types";

interface ArtistListPageProps {
  artists: ArtistListArtist[];
  nav: string[];
  selectedLetter: string;
  uniqueArtistLetters: string[];
  urls: ArtistListUrls;
  imagesUrl: string;
}

interface LetterNavProps {
  nav: string[];
  selectedLetter: string;
  uniqueArtistLetters: string[];
  artistListBaseUrl: string;
}

function LetterNav({
  nav,
  selectedLetter,
  uniqueArtistLetters,
  artistListBaseUrl,
}: LetterNavProps) {
  return (
    <nav className="mlo-letter-nav">
      {nav.map(letter => {
        const has = uniqueArtistLetters.includes(letter);
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
          <a key={letter} href={`${artistListBaseUrl}?letter=${letter}`} className={className}>
            {display}
          </a>
        );
      })}
    </nav>
  );
}

interface ArtistCardProps {
  artist: ArtistListArtist;
  imagesUrl: string;
  artistDetailUrl: string;
}

function ArtistCard({ artist, imagesUrl, artistDetailUrl }: ArtistCardProps) {
  return (
    <article className="mlo-artist-card">
      <a href={artistDetailUrl} className="mlo-artist-card-cover">
        <img src={`${imagesUrl}artist_images/${artist.uuid}`} alt={artist.name} />
      </a>
      <a href={artistDetailUrl} className="mlo-artist-card-name" title={artist.name}>
        {artist.name}
      </a>
      <div className="mlo-artist-card-meta">
        <span>
          <strong>{artist.album_count}</strong> {artist.album_count === 1 ? "album" : "albums"}
        </span>
        <span>·</span>
        <span>
          <strong>{artist.song_count}</strong> {artist.song_count === 1 ? "song" : "songs"}
        </span>
      </div>
    </article>
  );
}

export function ArtistListPage({
  artists,
  nav,
  selectedLetter,
  uniqueArtistLetters,
  urls,
  imagesUrl,
}: ArtistListPageProps) {
  const getArtistDetailUrl = (artistUuid: string) => {
    return urls.artistDetail.replace(/00000000-0000-0000-0000-000000000000/, artistUuid);
  };
  const headingLetter = selectedLetter === "other" ? "#" : selectedLetter.toUpperCase();

  return (
    <div className="music-library-os mlo-list-page">
      <div className="mlo-list-bar">
        <div className="mlo-breadcrumb">
          <a href={urls.musicHome}>/bordercore/music/</a>
          <span className="mlo-breadcrumb-active">artists</span>
          <span> / </span>
          <span className="mlo-breadcrumb-letter">{headingLetter}</span>
        </div>
      </div>

      <div className="mlo-list-head">
        <h1 className="mlo-pagehead-title">
          Artists <span className="mlo-pagehead-title-dim">— browse by name</span>
        </h1>
        <p className="mlo-pagehead-meta">
          {artists.length} {artists.length === 1 ? "artist" : "artists"} starting with{" "}
          <span className="mlo-pagehead-meta-letter">{headingLetter}</span>
        </p>
      </div>

      <LetterNav
        nav={nav}
        selectedLetter={selectedLetter}
        uniqueArtistLetters={uniqueArtistLetters}
        artistListBaseUrl={urls.artistListBase}
      />

      {artists.length === 0 ? (
        <div className="mlo-list-empty">
          No artists starting with <strong>{headingLetter}</strong>.
        </div>
      ) : (
        <div className="mlo-list-grid">
          {artists.map(artist => (
            <ArtistCard
              key={artist.uuid}
              artist={artist}
              imagesUrl={imagesUrl}
              artistDetailUrl={getArtistDetailUrl(artist.uuid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ArtistListPage;
