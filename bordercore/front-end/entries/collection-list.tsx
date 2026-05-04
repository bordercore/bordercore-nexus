import React from "react";
import { createRoot } from "react-dom/client";
import CollectionListPage from "../react/collection/CollectionListPage";
import type { Collection, CollectionListUrls, TagCounts } from "../react/collection/types";

const container = document.getElementById("react-root");

if (container) {
  const collectionDataEl = document.getElementById("collection-list-data");
  const collections: Collection[] = collectionDataEl
    ? JSON.parse(collectionDataEl.textContent || "[]")
    : [];

  const tagCountsEl = document.getElementById("tag-counts-data");
  const tagCounts: TagCounts = tagCountsEl
    ? JSON.parse(tagCountsEl.textContent || "{}")
    : {};

  const urls: CollectionListUrls = {
    createCollection: container.dataset.createCollectionUrl || "",
    tagSearch: container.dataset.tagSearchUrl || "",
  };

  const root = createRoot(container);
  root.render(
    <CollectionListPage
      collections={collections}
      tagCounts={tagCounts}
      urls={urls}
    />,
  );
}
