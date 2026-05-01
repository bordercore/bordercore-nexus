import React from "react";
import { createRoot } from "react-dom/client";
import AlbumListPage from "../react/music/AlbumListPage";
import type { AlbumListAlbum } from "../react/music/types";

const container = document.getElementById("react-root");

if (container) {
  const albums: AlbumListAlbum[] = JSON.parse(container.dataset.albums || "[]");
  const nav: string[] = JSON.parse(container.dataset.nav || "[]");
  const selectedLetter: string = container.dataset.selectedLetter || "a";
  const uniqueAlbumLetters: string[] = JSON.parse(container.dataset.uniqueAlbumLetters || "[]");
  const albumListBaseUrl: string = container.dataset.albumListBaseUrl || "";
  const musicHomeUrl: string = container.dataset.musicHomeUrl || "/music/";

  if (albumListBaseUrl) {
    const root = createRoot(container);
    root.render(
      <AlbumListPage
        albums={albums}
        nav={nav}
        selectedLetter={selectedLetter}
        uniqueAlbumLetters={uniqueAlbumLetters}
        albumListBaseUrl={albumListBaseUrl}
        musicHomeUrl={musicHomeUrl}
      />
    );
  } else {
    console.error("AlbumListPage: missing albumListBaseUrl");
  }
}
