import React from "react";
import { createRoot } from "react-dom/client";
import SongCreatePage from "../react/music/SongCreatePage";

// Get URLs and data from data attributes
const container = document.getElementById("react-root");
if (container) {
  const submitUrl = container.getAttribute("data-submit-url") || "";
  const cancelUrl = container.getAttribute("data-cancel-url") || "";
  const artistSearchUrl = container.getAttribute("data-artist-search-url") || "";
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const dupeCheckUrl = container.getAttribute("data-dupe-check-url") || "";
  const id3InfoUrl = container.getAttribute("data-id3-info-url") || "";

  // Parse tag suggestions from JSON
  let tagSuggestions: Array<{ name: string; count: number }> = [];
  const tagSuggestionsJson = container.getAttribute("data-tag-suggestions");
  if (tagSuggestionsJson) {
    try {
      tagSuggestions = JSON.parse(tagSuggestionsJson);
    } catch (e) {
      console.error("Error parsing tag suggestions:", e);
    }
  }

  // Parse source options from JSON
  let sourceOptions: Array<{ id: number; name: string }> = [];
  const sourceOptionsJson = container.getAttribute("data-source-options");
  if (sourceOptionsJson) {
    try {
      sourceOptions = JSON.parse(sourceOptionsJson);
    } catch (e) {
      console.error("Error parsing source options:", e);
    }
  }

  // Get initial source ID
  let initialSourceId: number | null = null;
  const initialSourceIdStr = container.getAttribute("data-initial-source-id");
  if (initialSourceIdStr) {
    initialSourceId = parseInt(initialSourceIdStr, 10);
  }

  // Parse the library snapshot rendered into the sidebar's "Library at a
  // glance" card. The view sends totals + a last-upload ISO timestamp, but
  // gracefully tolerate missing or malformed JSON (e.g. brand-new accounts
  // with an empty library).
  let libraryStats: {
    total_songs: number;
    total_artists: number;
    last_upload_iso: string | null;
  } | null = null;
  const libraryStatsJson = container.getAttribute("data-library-stats");
  if (libraryStatsJson) {
    try {
      libraryStats = JSON.parse(libraryStatsJson);
    } catch (e) {
      console.error("Error parsing library stats:", e);
    }
  }

  if (submitUrl && cancelUrl) {
    const root = createRoot(container);
    root.render(
      <SongCreatePage
        submitUrl={submitUrl}
        cancelUrl={cancelUrl}
        tagSearchUrl={tagSearchUrl}
        artistSearchUrl={artistSearchUrl}
        dupeCheckUrl={dupeCheckUrl}
        id3InfoUrl={id3InfoUrl}
        tagSuggestions={tagSuggestions}
        sourceOptions={sourceOptions}
        initialSourceId={initialSourceId}
        libraryStats={libraryStats}
      />
    );
  } else {
    console.error(
      "SongCreatePage: Missing required URLs.",
      "submitUrl:",
      submitUrl,
      "cancelUrl:",
      cancelUrl
    );
  }
}
