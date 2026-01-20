import React from "react";
import { createRoot } from "react-dom/client";
import CollectionListPage from "../react/collection/CollectionListPage";
import type { Collection, CollectionListUrls } from "../react/collection/types";

const container = document.getElementById("react-root");

if (container) {
  // Read JSON data from script tag (Django's json_script filter)
  const collectionDataEl = document.getElementById("collection-list-data");
  const collections: Collection[] = collectionDataEl
    ? JSON.parse(collectionDataEl.textContent || "[]")
    : [];

  const urls: CollectionListUrls = {
    createCollection: container.dataset.createCollectionUrl || "",
    tagSearch: container.dataset.tagSearchUrl || "",
  };

  const csrfToken = container.dataset.csrfToken || "";

  const root = createRoot(container);
  root.render(
    <CollectionListPage
      collections={collections}
      urls={urls}
      csrfToken={csrfToken}
    />
  );
}
