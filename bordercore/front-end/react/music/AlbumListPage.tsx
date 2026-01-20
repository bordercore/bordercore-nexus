import React from "react";
import type { AlbumListArtist, AlbumListUrls } from "./types";

interface AlbumListPageProps {
  artists: AlbumListArtist[];
  nav: string[];
  selectedLetter: string;
  uniqueArtistLetters: string[];
  urls: AlbumListUrls;
  imagesUrl: string;
}

interface LetterNavigationProps {
  nav: string[];
  selectedLetter: string;
  uniqueArtistLetters: string[];
  albumListBaseUrl: string;
}

function LetterNavigation({
  nav,
  selectedLetter,
  uniqueArtistLetters,
  albumListBaseUrl,
}: LetterNavigationProps) {
  return (
    <div className="d-flex flex-column ms-3 text-center">
      <div className="fs-4 w-100">
        <span className="me-3">
          <strong>Artist name</strong>
        </span>
        {nav.map((letter) => {
          const hasArtists = uniqueArtistLetters.includes(letter);
          const isSelected = letter === selectedLetter;

          return (
            <span key={letter} className="ms-2">
              {hasArtists ? (
                isSelected ? (
                  <strong>{letter}</strong>
                ) : (
                  <a href={`${albumListBaseUrl}?letter=${letter}`}>{letter}</a>
                )
              ) : (
                letter
              )}
            </span>
          );
        })}
      </div>
      <hr className="divider" />
    </div>
  );
}

interface ArtistCardProps {
  artist: AlbumListArtist;
  imagesUrl: string;
  artistDetailUrl: string;
}

function ArtistCard({ artist, imagesUrl, artistDetailUrl }: ArtistCardProps) {
  return (
    <div className="hoverable d-flex flex-column w-25 p-5">
      <div>
        <a href={artistDetailUrl}>
          <img
            src={`${imagesUrl}artist_images/${artist.uuid}`}
            className="mw-100"
            alt={artist.name}
          />
        </a>
      </div>
      <div className="fs-4">{artist.name}</div>
      <div className="text-value">
        Albums: <strong>{artist.album_count}</strong>, Songs:{" "}
        <strong>{artist.song_count}</strong>
      </div>
    </div>
  );
}

export function AlbumListPage({
  artists,
  nav,
  selectedLetter,
  uniqueArtistLetters,
  urls,
  imagesUrl,
}: AlbumListPageProps) {
  const getArtistDetailUrl = (artistUuid: string) => {
    return urls.artistDetail.replace(
      /00000000-0000-0000-0000-000000000000/,
      artistUuid
    );
  };

  return (
    <>
      <LetterNavigation
        nav={nav}
        selectedLetter={selectedLetter}
        uniqueArtistLetters={uniqueArtistLetters}
        albumListBaseUrl={urls.albumListBase}
      />

      <div className="card-grid d-flex ms-3">
        <div className="d-flex flex-wrap justify-content-evenly">
          {artists.map((artist) => (
            <ArtistCard
              key={artist.uuid}
              artist={artist}
              imagesUrl={imagesUrl}
              artistDetailUrl={getArtistDetailUrl(artist.uuid)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export default AlbumListPage;
