import React from "react";
import { createRoot } from "react-dom/client";
import ArtistListPage from "../react/music/ArtistListPage";
import type { ArtistListArtist, ArtistListUrls } from "../react/music/types";

// Get data from data attributes on #react-root
const container = document.getElementById("react-root");

if (container) {
  // Parse JSON data from data attributes
  const artists: ArtistListArtist[] = JSON.parse(container.dataset.artists || "[]");
  const nav: string[] = JSON.parse(container.dataset.nav || "[]");
  const selectedLetter: string = container.dataset.selectedLetter || "a";
  const uniqueArtistLetters: string[] = JSON.parse(container.dataset.uniqueArtistLetters || "[]");

  // Build URLs object from data attributes
  const urls: ArtistListUrls = {
    artistListBase: container.dataset.artistListBaseUrl || "",
    artistDetail: container.dataset.artistDetailUrlTemplate || "",
    musicHome: container.dataset.musicHomeUrl || "/music/",
  };

  const imagesUrl = container.dataset.imagesUrl || "";

  // Validate required data
  if (urls.artistListBase && urls.artistDetail) {
    const root = createRoot(container);
    root.render(
      <ArtistListPage
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
      "ArtistListPage: Missing required data. urls:",
      urls
    );
  }
}
