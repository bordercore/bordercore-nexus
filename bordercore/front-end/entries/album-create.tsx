import React from "react";
import { createRoot } from "react-dom/client";
import AlbumCreatePage from "../react/music/AlbumCreatePage";

// Get URLs and data from data attributes
const container = document.getElementById("react-root");
if (container) {
  const scanUrl = container.getAttribute("data-scan-url") || "";
  const addUrl = container.getAttribute("data-add-url") || "";
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";

  // Parse song sources from JSON
  let songSources: Array<{ id: number; name: string }> = [];
  const songSourcesJson = container.getAttribute("data-song-sources");
  if (songSourcesJson) {
    try {
      songSources = JSON.parse(songSourcesJson);
    } catch (e) {
      console.error("Error parsing song sources:", e);
    }
  }

  // Get default source ID
  let defaultSourceId: number | null = null;
  const defaultSourceIdStr = container.getAttribute("data-default-source-id");
  if (defaultSourceIdStr) {
    defaultSourceId = parseInt(defaultSourceIdStr, 10);
  }

  // Get CSRF token from BASE_TEMPLATE_DATA
  const data = (window as any).BASE_TEMPLATE_DATA || {};
  const csrfToken = data.csrfToken || "";

  if (scanUrl && addUrl && csrfToken) {
    const root = createRoot(container);
    root.render(
      <AlbumCreatePage
        scanUrl={scanUrl}
        addUrl={addUrl}
        tagSearchUrl={tagSearchUrl}
        songSources={songSources}
        defaultSourceId={defaultSourceId}
        csrfToken={csrfToken}
      />
    );
  } else {
    console.error(
      "AlbumCreatePage: Missing required URLs or CSRF token.",
      "scanUrl:",
      scanUrl,
      "addUrl:",
      addUrl,
      "csrfToken:",
      csrfToken ? "present" : "missing"
    );
  }
}
