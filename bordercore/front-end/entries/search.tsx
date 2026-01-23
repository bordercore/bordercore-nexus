import React from "react";
import { createRoot } from "react-dom/client";
import SearchPage from "../react/search/SearchPage";
import type { SearchMatch, Aggregation, Paginator } from "../react/search/types";

const container = document.getElementById("react-root");
if (container) {
  // Get URLs from data attributes
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const tagsChangedUrl = container.getAttribute("data-tags-changed-url") || "";
  const termSearchUrl = container.getAttribute("data-term-search-url") || "";
  const semanticSearchUrl = container.getAttribute("data-semantic-search-url") || "";
  const tagUrl = container.getAttribute("data-tag-url") || "";
  const imagesUrl = container.getAttribute("data-images-url") || "";
  const currentDoctype = container.getAttribute("data-current-doctype") || "";
  const exactMatchInitial = container.getAttribute("data-exact-match") || "No";
  const sortByInitial = container.getAttribute("data-sort-by") || "_score";
  const hasRequest = container.getAttribute("data-has-request") === "true";
  const count = parseInt(container.getAttribute("data-count") || "0", 10);

  // Parse JSON data from script tags
  let results: SearchMatch[] = [];
  let aggregations: Aggregation[] = [];
  let paginator: Paginator = {
    page_number: 1,
    num_pages: 1,
    has_next: false,
    has_previous: false,
    range: [1],
  };
  let searchTerm = "";
  let searchSemantic = "";

  try {
    const resultsEl = document.getElementById("results");
    if (resultsEl) {
      results = JSON.parse(resultsEl.textContent || "[]");
    }
  } catch (e) {
    console.error("Error parsing results:", e);
  }

  try {
    const aggregationsEl = document.getElementById("aggregations");
    if (aggregationsEl) {
      aggregations = JSON.parse(aggregationsEl.textContent || "[]");
    }
  } catch (e) {
    console.error("Error parsing aggregations:", e);
  }

  try {
    const paginatorEl = document.getElementById("paginator");
    if (paginatorEl) {
      paginator = JSON.parse(paginatorEl.textContent || "{}");
    }
  } catch (e) {
    console.error("Error parsing paginator:", e);
  }

  try {
    const searchTermEl = document.getElementById("searchTerm");
    if (searchTermEl) {
      searchTerm = JSON.parse(searchTermEl.textContent || '""') || "";
    }
  } catch (e) {
    console.error("Error parsing searchTerm:", e);
  }

  try {
    const searchSemanticEl = document.getElementById("searchSemantic");
    if (searchSemanticEl) {
      searchSemantic = JSON.parse(searchSemanticEl.textContent || '""') || "";
    }
  } catch (e) {
    console.error("Error parsing searchSemantic:", e);
  }

  const root = createRoot(container);
  root.render(
    <SearchPage
      results={results}
      aggregations={aggregations}
      paginator={paginator}
      count={count}
      currentDoctype={currentDoctype}
      searchTerm={searchTerm}
      searchSemantic={searchSemantic}
      exactMatchInitial={exactMatchInitial}
      sortByInitial={sortByInitial}
      tagSearchUrl={tagSearchUrl}
      tagsChangedUrl={tagsChangedUrl}
      termSearchUrl={termSearchUrl}
      semanticSearchUrl={semanticSearchUrl}
      tagUrl={tagUrl}
      imagesUrl={imagesUrl}
      hasRequest={hasRequest}
    />
  );
}
