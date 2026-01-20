import React from "react";
import { createRoot } from "react-dom/client";
import TagSearchPage from "../react/music/TagSearchPage";
import type { TagSearchSong, TagSearchAlbum, TagSearchUrls } from "../react/music/types";

// Get data from data attributes on #react-root
const container = document.getElementById("react-root");

if (container) {
  // Parse JSON data from data attributes
  const tagName: string = container.dataset.tagName || "";
  const songs: TagSearchSong[] = JSON.parse(container.dataset.songs || "[]");
  const albums: TagSearchAlbum[] = JSON.parse(container.dataset.albums || "[]");

  // Build URLs object from data attributes
  const urls: TagSearchUrls = {
    songMedia: container.dataset.songMediaUrl || "",
    markListenedTo: container.dataset.markListenedToUrlTemplate || "",
    albumDetail: container.dataset.albumDetailUrlTemplate || "",
    artistDetail: container.dataset.artistDetailUrlTemplate || "",
    imagesUrl: container.dataset.imagesUrl || "",
    musicList: container.dataset.musicListUrl || "",
  };

  const staticUrl = container.dataset.staticUrl || "";
  const csrfToken = container.dataset.csrfToken || "";

  // Validate required data
  if (tagName && urls.songMedia) {
    const root = createRoot(container);
    root.render(
      <TagSearchPage
        tagName={tagName}
        songs={songs}
        albums={albums}
        urls={urls}
        staticUrl={staticUrl}
        csrfToken={csrfToken}
      />
    );
  } else {
    console.error(
      "TagSearchPage: Missing required data. tagName:",
      tagName,
      "urls:",
      urls
    );
  }
}
