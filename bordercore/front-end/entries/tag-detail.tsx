import React from "react";
import { createRoot } from "react-dom/client";
import TagDetailPage from "../react/search/TagDetailPage";
import type { TagDetailResults, DoctypeCount, TagCount } from "../react/search/types";

const container = document.getElementById("react-root");
if (container) {
  // Get URLs from data attributes
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const tagsChangedUrl = container.getAttribute("data-tags-changed-url") || "";
  const termSearchUrl = container.getAttribute("data-term-search-url") || "";
  const storeInSessionUrl = container.getAttribute("data-store-in-session-url") || "";
  const savedTab = container.getAttribute("data-saved-tab") || "";

  // Parse JSON data from script tags
  let results: TagDetailResults = {
    blob: [],
    book: [],
    bookmark: [],
    document: [],
    note: [],
    drill: [],
    song: [],
    todo: [],
    album: [],
  };
  let doctypeCounts: DoctypeCount[] = [];
  let tagCounts: TagCount[] = [];
  let initialTags: string[] = [];
  let doctypes: string[] = [];

  try {
    const doctypesEl = document.getElementById("doctypes");
    if (doctypesEl) {
      doctypes = JSON.parse(doctypesEl.textContent || "[]");
    }
  } catch (e) {
    console.error("Error parsing doctypes:", e);
  }

  try {
    const resultsEl = document.getElementById("results");
    if (resultsEl) {
      results = JSON.parse(resultsEl.textContent || "{}");
    }
  } catch (e) {
    console.error("Error parsing results:", e);
  }

  try {
    const doctypeCountsEl = document.getElementById("doctypeCounts");
    if (doctypeCountsEl) {
      doctypeCounts = JSON.parse(doctypeCountsEl.textContent || "[]");
    }
  } catch (e) {
    console.error("Error parsing doctypeCounts:", e);
  }

  try {
    const tagCountsEl = document.getElementById("tagCounts");
    if (tagCountsEl) {
      tagCounts = JSON.parse(tagCountsEl.textContent || "[]");
    }
  } catch (e) {
    console.error("Error parsing tagCounts:", e);
  }

  try {
    const initialTagsEl = document.getElementById("initial-tags");
    if (initialTagsEl) {
      initialTags = JSON.parse(initialTagsEl.textContent || "[]");
    }
  } catch (e) {
    console.error("Error parsing initial-tags:", e);
  }

  const root = createRoot(container);
  root.render(
    <TagDetailPage
      results={results}
      doctypeCounts={doctypeCounts}
      tagCounts={tagCounts}
      initialTags={initialTags}
      savedTab={savedTab}
      doctypes={doctypes}
      tagSearchUrl={tagSearchUrl}
      tagsChangedUrl={tagsChangedUrl}
      termSearchUrl={termSearchUrl}
      storeInSessionUrl={storeInSessionUrl}
    />
  );
}
