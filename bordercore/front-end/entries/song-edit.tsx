import React from "react";
import { createRoot } from "react-dom/client";
import SongEditPage from "../react/music/SongEditPage";

// Get URLs and data from data attributes
const container = document.getElementById("react-root");
if (container) {
  const formAjaxUrl = container.getAttribute("data-form-ajax-url") || "";
  const submitUrl = container.getAttribute("data-submit-url") || "";
  const cancelUrl = container.getAttribute("data-cancel-url") || "";
  const artistSearchUrl = container.getAttribute("data-artist-search-url") || "";
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const dupeCheckUrl = container.getAttribute("data-dupe-check-url") || "";

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

  // Get CSRF token from BASE_TEMPLATE_DATA
  const data = (window as any).BASE_TEMPLATE_DATA || {};
  const csrfToken = data.csrfToken || "";

  if (submitUrl && cancelUrl && csrfToken) {
    const root = createRoot(container);
    root.render(
      <SongEditPage
        formAjaxUrl={formAjaxUrl}
        submitUrl={submitUrl}
        cancelUrl={cancelUrl}
        csrfToken={csrfToken}
        tagSearchUrl={tagSearchUrl}
        artistSearchUrl={artistSearchUrl}
        dupeCheckUrl={dupeCheckUrl}
        tagSuggestions={tagSuggestions}
      />
    );
  } else {
    console.error(
      "SongEditPage: Missing required URLs or CSRF token.",
      "submitUrl:",
      submitUrl,
      "cancelUrl:",
      cancelUrl,
      "csrfToken:",
      csrfToken ? "present" : "missing"
    );
  }
}
