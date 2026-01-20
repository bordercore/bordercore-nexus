import React from "react";
import { createRoot } from "react-dom/client";
import AlbumListPage from "../react/music/AlbumListPage";
import type { AlbumListArtist, AlbumListUrls } from "../react/music/types";

// Get data from data attributes on #react-root
const container = document.getElementById("react-root");

if (container) {
  // Parse JSON data from data attributes
  const artists: AlbumListArtist[] = JSON.parse(container.dataset.artists || "[]");
  const nav: string[] = JSON.parse(container.dataset.nav || "[]");
  const selectedLetter: string = container.dataset.selectedLetter || "a";
  const uniqueArtistLetters: string[] = JSON.parse(container.dataset.uniqueArtistLetters || "[]");

  // Build URLs object from data attributes
  const urls: AlbumListUrls = {
    albumListBase: container.dataset.albumListBaseUrl || "",
    artistDetail: container.dataset.artistDetailUrlTemplate || "",
  };

  const imagesUrl = container.dataset.imagesUrl || "";

  // Validate required data
  if (urls.albumListBase && urls.artistDetail) {
    const root = createRoot(container);
    root.render(
      <AlbumListPage
        artists={artists}
        nav={nav}
        selectedLetter={selectedLetter}
        uniqueArtistLetters={uniqueArtistLetters}
        urls={urls}
        imagesUrl={imagesUrl}
      />
    );
  } else {
    console.error(
      "AlbumListPage: Missing required data. urls:",
      urls
    );
  }
}
