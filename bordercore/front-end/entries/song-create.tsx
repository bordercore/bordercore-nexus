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

  // Get CSRF token from BASE_TEMPLATE_DATA
  const data = (window as any).BASE_TEMPLATE_DATA || {};
  const csrfToken = data.csrfToken || "";

  if (submitUrl && cancelUrl && csrfToken) {
    const root = createRoot(container);
    root.render(
      <SongCreatePage
        submitUrl={submitUrl}
        cancelUrl={cancelUrl}
        csrfToken={csrfToken}
        tagSearchUrl={tagSearchUrl}
        artistSearchUrl={artistSearchUrl}
        dupeCheckUrl={dupeCheckUrl}
        id3InfoUrl={id3InfoUrl}
        tagSuggestions={tagSuggestions}
        sourceOptions={sourceOptions}
        initialSourceId={initialSourceId}
      />
    );
  } else {
    console.error(
      "SongCreatePage: Missing required URLs or CSRF token.",
      "submitUrl:",
      submitUrl,
      "cancelUrl:",
      cancelUrl,
      "csrfToken:",
      csrfToken ? "present" : "missing"
    );
  }
}
